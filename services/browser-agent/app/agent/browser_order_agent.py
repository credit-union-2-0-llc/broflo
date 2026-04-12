"""BrowserOrderAgent — the core agent that navigates retailer sites and purchases gifts.

Flow:
1. Create isolated browser session via provider
2. Navigate to retailer URL
3. Search for product using search terms
4. AI matches best product to original suggestion (Sonnet 4.6 vision)
5. [preview mode] Return found product details — stop here
6. [place mode] Add to cart → enter address → enter payment (virtual card) → confirm
7. Capture confirmation number
8. Return AgentResult

CAPTCHA detected at any step → immediate abort, no retry.
Non-transient failures (captcha, out_of_stock, price_mismatch) → no retry.
Transient failures (timeout, unknown) → up to 2 retries with exponential backoff.
"""

import asyncio
import logging
import time
from typing import Optional

from playwright.async_api import async_playwright, Page, Browser

from ..captcha import CaptchaDetector, CaptchaDetectedError
from ..config import (
    MAX_EXECUTION_SECONDS,
    MAX_STEPS,
    PRICE_MISMATCH_THRESHOLD_PCT,
    MAX_RETRIES,
    RETRY_BACKOFF_SECONDS,
    RETRY_MAX_WALL_CLOCK_SECONDS,
    TRANSIENT_FAILURE_REASONS,
)
from ..providers.base import BrowserProvider
from ..schemas import ExecuteRequest, ExecuteMode, AgentResult, StepResult
from ..storage import ScreenshotStore
from ..ai.product_matcher import ProductMatcher

logger = logging.getLogger("broflo-browser-agent.agent")

# Out-of-stock detection indicators
OOS_TEXT_INDICATORS = [
    "out of stock",
    "sold out",
    "unavailable",
    "currently unavailable",
    "notify me when available",
    "notify me",
    "not available",
    "no longer available",
    "temporarily out of stock",
    "back in stock",
    "waitlist",
]

OOS_BUTTON_SELECTORS = [
    'button[disabled]:has-text("Add to Cart")',
    'button[disabled]:has-text("Add to Bag")',
    'button[disabled]:has-text("Add to basket")',
    'button:has-text("Notify Me")',
    'button:has-text("Sold Out")',
    'button:has-text("Out of Stock")',
]


class BrowserOrderAgent:
    """Executes a browser-based purchase from a retail website."""

    def __init__(self, provider: BrowserProvider) -> None:
        self._provider = provider
        self._captcha = CaptchaDetector()
        self._screenshots = ScreenshotStore()
        self._matcher = ProductMatcher()
        self._steps: list[StepResult] = []
        self._step_counter = 0

    async def execute(self, req: ExecuteRequest) -> AgentResult:
        """Execute with retry logic for transient failures.

        Non-transient failures (captcha, out_of_stock, price_mismatch) fail immediately.
        Transient failures (timeout, unknown) retry up to MAX_RETRIES times with backoff.
        Each retry gets a fresh browser session.
        """
        overall_start = time.monotonic()
        last_result: Optional[AgentResult] = None

        for attempt in range(1 + MAX_RETRIES):
            # Wall-clock guard across all attempts
            elapsed_total = time.monotonic() - overall_start
            if attempt > 0 and elapsed_total >= RETRY_MAX_WALL_CLOCK_SECONDS:
                logger.warning("Retry wall-clock exceeded for job %s after %ds", req.job_id, int(elapsed_total))
                break

            # Backoff between retries
            if attempt > 0:
                backoff = RETRY_BACKOFF_SECONDS[min(attempt - 1, len(RETRY_BACKOFF_SECONDS) - 1)]
                logger.info("Retry %d/%d for job %s after %ds backoff", attempt, MAX_RETRIES, req.job_id, backoff)
                self._steps.append(StepResult(
                    step_number=self._step_counter + 1,
                    action="error",
                    status="failed",
                    metadata={"action": "retry", "attempt_number": attempt + 1, "previous_failure_reason": last_result.failure_reason if last_result else "unknown"},
                ))
                self._step_counter += 1
                await asyncio.sleep(backoff)

            # Reset step tracking for new attempt (keep prior steps for audit)
            result = await self._execute_single_attempt(req)
            last_result = result

            # Non-transient failures — no retry
            if result.failure_reason and result.failure_reason not in TRANSIENT_FAILURE_REASONS:
                return result

            # Success or preview — done
            if result.status in ("completed", "previewing"):
                return result

            # Transient failure — retry if attempts remain
            if result.failure_reason in TRANSIENT_FAILURE_REASONS:
                logger.warning("Transient failure for job %s (attempt %d): %s", req.job_id, attempt + 1, result.failure_reason)
                continue

            # Unknown status — return as-is
            return result

        # All retries exhausted
        if last_result:
            last_result.failure_reason = last_result.failure_reason or "unknown"
            last_result.steps = self._steps
        return last_result or AgentResult(job_id=req.job_id, status="failed", failure_reason="unknown", steps=self._steps)

    async def _execute_single_attempt(self, req: ExecuteRequest) -> AgentResult:
        """Execute one attempt of the agent flow. Returns AgentResult regardless of outcome."""
        session = None
        browser: Optional[Browser] = None
        start_time = time.monotonic()

        try:
            # Create isolated browser session (fresh per attempt)
            session = await self._provider.create_session()
            logger.info("Agent started for job %s, session %s", req.job_id, session.session_id)

            # Connect via Playwright
            pw = await async_playwright().start()
            browser = await pw.chromium.connect_over_cdp(session.connect_url)
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = context.pages[0] if context.pages else await context.new_page()

            # Step 1: Navigate to retailer
            await self._step(req.job_id, "navigate", page, req.retailer_url)
            await page.goto(req.retailer_url, wait_until="domcontentloaded", timeout=30000)
            await self._captcha.check_page(page)
            await self._complete_step("completed", page)

            # Step 2: Search for product
            await self._step(req.job_id, "search", page)
            search_result = await self._search_for_product(page, req.search_terms)
            await self._captcha.check_page(page)
            await self._complete_step("completed", page)

            # Step 3: AI product matching
            await self._step(req.job_id, "select_product", page)
            screenshot_bytes = await self._provider.take_screenshot(page)
            match_result = await self._matcher.find_best_match(
                screenshot_bytes=screenshot_bytes,
                page_html=await page.content(),
                search_terms=req.search_terms,
                max_budget_cents=req.max_budget_cents,
            )

            if not match_result:
                await self._complete_step("failed", page, metadata={"reason": "no_match"})
                return AgentResult(
                    job_id=req.job_id,
                    status="failed",
                    failure_reason="out_of_stock",
                    steps=self._steps,
                    browser_session_id=session.session_id,
                )

            # Check out-of-stock indicators on product page
            oos = await self._detect_out_of_stock(page)
            if oos:
                await self._complete_step("failed", page, metadata={"reason": "out_of_stock", "indicator": oos})
                return AgentResult(
                    job_id=req.job_id,
                    status="failed",
                    failure_reason="out_of_stock",
                    found_product_title=match_result.title,
                    found_product_price=match_result.price_cents,
                    steps=self._steps,
                    browser_session_id=session.session_id,
                )

            # Budget cap check — hard stop if price exceeds budget
            if match_result.price_cents and match_result.price_cents > req.max_budget_cents:
                await self._complete_step("failed", page, metadata={
                    "reason": "price_mismatch",
                    "price_cents": match_result.price_cents,
                    "budget_cents": req.max_budget_cents,
                })
                return AgentResult(
                    job_id=req.job_id,
                    status="failed",
                    failure_reason="price_mismatch",
                    found_product_title=match_result.title,
                    found_product_price=match_result.price_cents,
                    steps=self._steps,
                    browser_session_id=session.session_id,
                )

            await self._complete_step(
                "completed",
                page,
                ai_model=match_result.model_used,
                ai_confidence=match_result.confidence,
                metadata={"product_title": match_result.title, "price_cents": match_result.price_cents},
            )

            # Preview result
            found_image_url = None
            if screenshot_bytes:
                found_image_url = await self._screenshots.upload(
                    req.job_id, self._step_counter, screenshot_bytes
                )

            # If preview mode, return the found product without purchasing
            if req.mode == ExecuteMode.preview:
                return AgentResult(
                    job_id=req.job_id,
                    status="previewing",
                    found_product_title=match_result.title,
                    found_product_price=match_result.price_cents,
                    found_product_url=match_result.url,
                    found_product_image=found_image_url,
                    match_confidence=match_result.confidence,
                    steps=self._steps,
                    browser_session_id=session.session_id,
                )

            # Place mode — continue to checkout
            self._check_timeout(start_time)

            # Step 4: Add to cart
            await self._step(req.job_id, "add_to_cart", page)
            await self._add_to_cart(page, match_result.url or "")
            await self._captcha.check_page(page)
            await self._complete_step("completed", page)

            # Step 5: Enter shipping address
            self._check_timeout(start_time)
            await self._step(req.job_id, "enter_address", page)
            await self._enter_shipping(page, req)
            await self._captcha.check_page(page)
            await self._complete_step("completed", page)

            # Step 6: Enter payment (virtual card) — NO screenshot on this step (PII)
            self._check_timeout(start_time)
            await self._step(req.job_id, "enter_payment", page)
            if req.virtual_card_number:
                await self._enter_payment(page, req)
            await self._captcha.check_page(page)
            await self._complete_step("completed", page, skip_screenshot=True)

            # Step 7: Confirm order
            self._check_timeout(start_time)
            await self._step(req.job_id, "confirm_order", page)

            # Price verification before confirming
            checkout_price = await self._extract_checkout_price(page)
            if checkout_price and match_result.price_cents:
                threshold = match_result.price_cents * (1 + PRICE_MISMATCH_THRESHOLD_PCT / 100)
                if checkout_price > threshold:
                    await self._complete_step("failed", page, metadata={
                        "reason": "price_mismatch",
                        "expected_cents": match_result.price_cents,
                        "actual_cents": checkout_price,
                    })
                    return AgentResult(
                        job_id=req.job_id,
                        status="failed",
                        failure_reason="price_mismatch",
                        found_product_title=match_result.title,
                        found_product_price=checkout_price,
                        match_confidence=match_result.confidence,
                        steps=self._steps,
                        browser_session_id=session.session_id,
                    )

            await self._confirm_order(page)
            await self._captcha.check_page(page)
            await self._complete_step("completed", page)

            # Step 8: Capture confirmation
            self._check_timeout(start_time)
            await self._step(req.job_id, "capture_confirmation", page)
            confirmation = await self._extract_confirmation(page)
            conf_screenshot = await self._provider.take_screenshot(page)
            conf_image_url = None
            if conf_screenshot:
                conf_image_url = await self._screenshots.upload(
                    req.job_id, self._step_counter, conf_screenshot
                )
            await self._complete_step("completed", page, metadata={"confirmation": confirmation})

            return AgentResult(
                job_id=req.job_id,
                status="completed",
                found_product_title=match_result.title,
                found_product_price=match_result.price_cents,
                found_product_url=match_result.url,
                found_product_image=found_image_url,
                match_confidence=match_result.confidence,
                confirmation_number=confirmation,
                steps=self._steps,
                browser_session_id=session.session_id,
            )

        except CaptchaDetectedError as e:
            logger.warning("CAPTCHA detected for job %s: %s", req.job_id, e)
            self._steps.append(StepResult(
                step_number=self._step_counter + 1,
                action="detect_captcha",
                status="failed",
                metadata={"source": e.source, "details": e.details},
            ))
            return AgentResult(
                job_id=req.job_id,
                status="aborted",
                failure_reason="captcha",
                steps=self._steps,
                browser_session_id=session.session_id if session else None,
            )

        except asyncio.TimeoutError:
            logger.error("Agent timeout for job %s", req.job_id)
            return AgentResult(
                job_id=req.job_id,
                status="failed",
                failure_reason="timeout",
                steps=self._steps,
                browser_session_id=session.session_id if session else None,
            )

        except Exception as e:
            logger.error("Agent failed for job %s: %s", req.job_id, e, exc_info=True)
            return AgentResult(
                job_id=req.job_id,
                status="failed",
                failure_reason="unknown",
                steps=self._steps,
                browser_session_id=session.session_id if session else None,
            )

        finally:
            if browser:
                try:
                    await browser.close()
                except Exception:
                    pass
            if session:
                await self._provider.close_session(session.session_id)

    def _check_timeout(self, start_time: float) -> None:
        elapsed = time.monotonic() - start_time
        if elapsed >= MAX_EXECUTION_SECONDS:
            raise asyncio.TimeoutError(f"Agent exceeded {MAX_EXECUTION_SECONDS}s limit")

    async def _step(
        self, job_id: str, action: str, page: Optional[Page] = None, url: str = ""
    ) -> None:
        self._step_counter += 1
        self._steps.append(StepResult(
            step_number=self._step_counter,
            action=action,
            status="running",
            page_url=url or (page.url if page else None),
        ))

    async def _complete_step(
        self,
        status: str,
        page: Optional[Page] = None,
        ai_model: Optional[str] = None,
        ai_confidence: Optional[float] = None,
        metadata: Optional[dict] = None,
        skip_screenshot: bool = False,
    ) -> None:
        if not self._steps:
            return
        step = self._steps[-1]
        step.status = status
        step.ai_model_used = ai_model
        step.ai_confidence = ai_confidence
        step.metadata = metadata
        if page:
            step.page_url = page.url
        if page and not skip_screenshot:
            screenshot_bytes = await self._provider.take_screenshot(page)
            if screenshot_bytes:
                step.screenshot_url = await self._screenshots.upload(
                    "", self._step_counter, screenshot_bytes
                )

    async def _search_for_product(self, page: Page, search_terms: str) -> None:
        """Find and use the retailer's search box."""
        search_selectors = [
            'input[type="search"]',
            'input[name="q"]',
            'input[name="search"]',
            'input[name="keyword"]',
            'input[placeholder*="Search"]',
            'input[placeholder*="search"]',
            'input[aria-label*="Search"]',
            'input[aria-label*="search"]',
            "#search-input",
            "#searchInput",
            ".search-input",
        ]

        for selector in search_selectors:
            try:
                el = await page.wait_for_selector(selector, timeout=3000)
                if el:
                    await el.click()
                    await el.fill(search_terms)
                    await page.keyboard.press("Enter")
                    await page.wait_for_load_state("domcontentloaded", timeout=10000)
                    return
            except Exception:
                continue

        # Fallback: navigate to search URL pattern
        url = page.url.rstrip("/")
        await page.goto(f"{url}/search?q={search_terms}", timeout=15000)

    async def _add_to_cart(self, page: Page, product_url: str) -> None:
        """Navigate to product and add to cart."""
        if product_url and product_url != page.url:
            await page.goto(product_url, wait_until="domcontentloaded", timeout=15000)

        add_selectors = [
            'button:has-text("Add to Cart")',
            'button:has-text("Add to Bag")',
            'button:has-text("Add to basket")',
            '[data-testid="add-to-cart"]',
            "#add-to-cart",
            ".add-to-cart",
        ]
        for selector in add_selectors:
            try:
                btn = await page.wait_for_selector(selector, timeout=3000)
                if btn:
                    await btn.click()
                    await page.wait_for_timeout(2000)
                    return
            except Exception:
                continue

    async def _enter_shipping(self, page: Page, req: ExecuteRequest) -> None:
        """Fill in shipping address fields."""
        addr = req.shipping_address
        field_map = {
            "name": addr.name,
            "firstName": addr.name.split()[0] if " " in addr.name else addr.name,
            "lastName": addr.name.split()[-1] if " " in addr.name else "",
            "address1": addr.address1,
            "address2": addr.address2 or "",
            "city": addr.city,
            "state": addr.state,
            "zip": addr.zip,
            "postalCode": addr.zip,
        }
        for field_name, value in field_map.items():
            if not value:
                continue
            selectors = [
                f'input[name="{field_name}"]',
                f'input[name*="{field_name}" i]',
                f'input[autocomplete*="{field_name}" i]',
            ]
            for selector in selectors:
                try:
                    el = await page.wait_for_selector(selector, timeout=2000)
                    if el:
                        await el.fill(value)
                        break
                except Exception:
                    continue

    async def _confirm_order(self, page: Page) -> None:
        """Click the final order confirmation button."""
        confirm_selectors = [
            'button:has-text("Place Order")',
            'button:has-text("Complete Order")',
            'button:has-text("Submit Order")',
            'button:has-text("Confirm Order")',
            'button:has-text("Buy Now")',
            '[data-testid="place-order"]',
        ]
        for selector in confirm_selectors:
            try:
                btn = await page.wait_for_selector(selector, timeout=3000)
                if btn:
                    await btn.click()
                    await page.wait_for_load_state("domcontentloaded", timeout=15000)
                    return
            except Exception:
                continue

    async def _extract_checkout_price(self, page: Page) -> Optional[int]:
        """Extract the total price from the checkout page in cents using AI vision."""
        try:
            screenshot_bytes = await self._provider.take_screenshot(page)
            if not screenshot_bytes:
                return None

            import anthropic
            import base64
            from ..config import NAVIGATION_MODEL, ANTHROPIC_API_KEY

            client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            b64 = base64.b64encode(screenshot_bytes).decode("utf-8")

            response = await client.messages.create(
                model=NAVIGATION_MODEL,
                max_tokens=100,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                        {"type": "text", "text": (
                            "Extract the order total from this checkout page screenshot. "
                            "Return ONLY an integer representing the total in cents. "
                            "For example, $47.99 → 4799. If you cannot find a total, return 0."
                        )},
                    ],
                }],
            )

            text = response.content[0].text.strip()
            price = int("".join(c for c in text if c.isdigit()) or "0")
            return price if price > 0 else None
        except Exception as e:
            logger.warning("Price extraction failed: %s", e)
            return None

    async def _extract_confirmation(self, page: Page) -> Optional[str]:
        """Extract order confirmation number from the confirmation page using AI vision."""
        try:
            screenshot_bytes = await self._provider.take_screenshot(page)
            if not screenshot_bytes:
                return None

            import anthropic
            import base64
            from ..config import NAVIGATION_MODEL, ANTHROPIC_API_KEY

            client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            b64 = base64.b64encode(screenshot_bytes).decode("utf-8")

            response = await client.messages.create(
                model=NAVIGATION_MODEL,
                max_tokens=100,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                        {"type": "text", "text": (
                            "Extract the order confirmation number from this confirmation page screenshot. "
                            "Return ONLY the confirmation/order number string. "
                            "If you cannot find one, return NONE."
                        )},
                    ],
                }],
            )

            text = response.content[0].text.strip()
            return None if text.upper() == "NONE" else text
        except Exception as e:
            logger.warning("Confirmation extraction failed: %s", e)
            return None

    async def _detect_out_of_stock(self, page: Page) -> Optional[str]:
        """Detect out-of-stock conditions on the current page.

        Returns the matched indicator string if OOS detected, None otherwise.
        """
        try:
            content = (await page.content()).lower()

            # Check text indicators
            for indicator in OOS_TEXT_INDICATORS:
                if indicator in content:
                    logger.info("OOS text detected: '%s'", indicator)
                    return indicator

            # Check disabled/OOS button selectors
            for selector in OOS_BUTTON_SELECTORS:
                try:
                    el = await page.wait_for_selector(selector, timeout=1000)
                    if el:
                        logger.info("OOS button detected: '%s'", selector)
                        return selector
                except Exception:
                    continue

            return None
        except Exception:
            return None

    async def _enter_payment(self, page: Page, req: ExecuteRequest) -> None:
        """Enter virtual card details into payment fields.

        Payment values are NEVER logged. All log output uses [REDACTED].
        """
        if not req.virtual_card_number:
            return
        logger.info("Entering payment for job %s: card=[REDACTED] exp=[REDACTED] cvc=[REDACTED]", req.job_id)
        # Card number, expiry, CVC — standard patterns
        payment_fields = [
            (req.virtual_card_number, ['input[name*="card" i]', 'input[autocomplete="cc-number"]']),
            (req.virtual_card_exp or "", ['input[name*="expir" i]', 'input[autocomplete="cc-exp"]']),
            (req.virtual_card_cvc or "", ['input[name*="cvc" i]', 'input[name*="cvv" i]', 'input[autocomplete="cc-csc"]']),
        ]
        for value, selectors in payment_fields:
            if not value:
                continue
            for selector in selectors:
                try:
                    el = await page.wait_for_selector(selector, timeout=3000)
                    if el:
                        await el.fill(value)
                        break
                except Exception:
                    continue
