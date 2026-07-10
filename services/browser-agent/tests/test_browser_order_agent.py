"""Covers the double-checkout retry bug fix: a failure occurring after the
"Place Order" click has fired must never be classified as retryable, since a
retry would re-run checkout with the same virtual card against a retailer
that may have already charged and shipped the first attempt.
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.agent.browser_order_agent import BrowserOrderAgent
from app.ai.product_matcher import MatchResult
from app.providers.mock_provider import MockProvider
from app.schemas import ExecuteMode, ExecuteRequest, ShippingAddress


def make_request(mode: ExecuteMode) -> ExecuteRequest:
    return ExecuteRequest(
        job_id="job-1",
        retailer_url="https://example.com",
        search_terms="cozy blanket",
        max_budget_cents=5000,
        shipping_address=ShippingAddress(
            name="Test Person",
            address1="123 Main St",
            city="Portland",
            state="OR",
            zip="97201",
        ),
        mode=mode,
    )


class FakePage:
    def __init__(self):
        self.url = "https://example.com"

    async def goto(self, *args, **kwargs):
        pass

    async def content(self):
        return "<html></html>"


class FakeContext:
    def __init__(self, page):
        self.pages = [page]

    async def new_page(self):
        return self.pages[0]


class FakeBrowser:
    def __init__(self, page):
        self.contexts = [FakeContext(page)]

    async def close(self):
        pass


class FakeChromium:
    def __init__(self, browser):
        self._browser = browser

    async def connect_over_cdp(self, _url):
        return self._browser


class FakePlaywright:
    def __init__(self, browser):
        self.chromium = FakeChromium(browser)


class FakePlaywrightContextManager:
    def __init__(self, page):
        self._page = page

    async def start(self):
        return FakePlaywright(FakeBrowser(self._page))


def _stub_common_steps(agent: BrowserOrderAgent) -> None:
    """Stub every internal step up through a successful confirm-order click."""
    agent._search_for_product = AsyncMock(return_value=None)
    agent._detect_out_of_stock = AsyncMock(return_value=None)
    agent._add_to_cart = AsyncMock(return_value=None)
    agent._enter_shipping = AsyncMock(return_value=None)
    agent._enter_payment = AsyncMock(return_value=None)
    agent._extract_checkout_price = AsyncMock(return_value=None)
    agent._confirm_order = AsyncMock(return_value=None)
    agent._captcha.check_page = AsyncMock(return_value=None)
    agent._matcher.find_best_match = AsyncMock(
        return_value=MatchResult(
            title="Cozy Blanket",
            price_cents=4999,
            url="https://example.com/product/1",
            confidence=0.9,
            model_used="mock",
            reasoning="test",
        )
    )


@pytest.mark.asyncio
async def test_failure_before_confirm_click_is_retried():
    page = FakePage()
    agent = BrowserOrderAgent(provider=MockProvider())
    _stub_common_steps(agent)
    # Fails during add-to-cart — well before the "Place Order" click.
    agent._add_to_cart = AsyncMock(side_effect=RuntimeError("boom"))

    with (
        patch(
            "app.agent.browser_order_agent.async_playwright",
            lambda: FakePlaywrightContextManager(page),
        ),
        patch("asyncio.sleep", new=AsyncMock()),
    ):
        result = await agent.execute(make_request(ExecuteMode.place))

    # "unknown" is transient — retries are expected and safe here, since
    # nothing has been charged or purchased yet.
    assert result.failure_reason == "unknown"


@pytest.mark.asyncio
async def test_failure_after_confirm_click_is_never_retried():
    page = FakePage()
    agent = BrowserOrderAgent(provider=MockProvider())
    _stub_common_steps(agent)
    # The "Place Order" click itself succeeds, but reading back the
    # confirmation number afterward throws — e.g. a lost connection right
    # after checkout, when the order may have already gone through.
    agent._extract_confirmation = AsyncMock(side_effect=RuntimeError("lost connection"))

    create_session_spy = AsyncMock(wraps=agent._provider.create_session)
    agent._provider.create_session = create_session_spy

    with (
        patch(
            "app.agent.browser_order_agent.async_playwright",
            lambda: FakePlaywrightContextManager(page),
        ),
        patch("asyncio.sleep", new=AsyncMock()),
    ):
        result = await agent.execute(make_request(ExecuteMode.place))

    assert result.failure_reason == "post_confirmation_uncertain"
    # Must never be retried — a second attempt would risk a second real
    # checkout against the same retailer with the same virtual card.
    assert create_session_spy.call_count == 1
