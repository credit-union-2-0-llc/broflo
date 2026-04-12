"""CAPTCHA Detection Module — SEALED.

SECURITY POLICY: This module detects CAPTCHAs and IMMEDIATELY aborts agent execution.
There is NO configuration flag to disable detection. There is NO bypass mechanism.
Any detection triggers an immediate abort with reason 'captcha'.

DO NOT MODIFY this module to add bypass, skip, or disable functionality.
This file is protected by CODEOWNERS — changes require Security Expert + Kirk approval.
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger("broflo-browser-agent.captcha")

# Known CAPTCHA indicators in page content
_CAPTCHA_SIGNATURES = [
    # reCAPTCHA
    "recaptcha",
    "g-recaptcha",
    "grecaptcha",
    "www.google.com/recaptcha",
    "recaptcha-anchor",
    "rc-anchor-container",
    # hCaptcha
    "hcaptcha",
    "h-captcha",
    "www.hcaptcha.com",
    "hcaptcha-box",
    # Cloudflare Turnstile
    "cf-turnstile",
    "challenges.cloudflare.com",
    "turnstile",
    # Arkose Labs / FunCaptcha
    "arkoselabs",
    "funcaptcha",
    "arkose",
    # PerimeterX / HUMAN
    "perimeterx",
    "px-captcha",
    "human-challenge",
    # Generic indicators
    "captcha",
    "are you a robot",
    "are you human",
    "verify you are human",
    "prove you're not a robot",
    "bot detection",
    "challenge-platform",
]

# URL patterns that indicate CAPTCHA challenge pages
_CAPTCHA_URL_PATTERNS = [
    "captcha",
    "challenge",
    "human-verification",
    "bot-check",
    "geo.captcha",
]


class CaptchaDetectedError(Exception):
    """Raised when a CAPTCHA is detected. Agent must abort immediately."""

    def __init__(self, source: str, details: str = "") -> None:
        self.source = source
        self.details = details
        super().__init__(f"CAPTCHA detected via {source}: {details}")


@dataclass
class DetectionResult:
    detected: bool
    source: str
    details: str


class CaptchaDetector:
    """Detects CAPTCHAs on a page. No bypass. No skip. Detection = abort.

    Usage:
        detector = CaptchaDetector()
        await detector.check_page(page)  # raises CaptchaDetectedError if found
    """

    async def check_page(self, page: object) -> None:
        """Check the current page for CAPTCHA presence. Raises CaptchaDetectedError if found."""
        from playwright.async_api import Page as PlaywrightPage

        if not isinstance(page, PlaywrightPage):
            return

        results: list[DetectionResult] = []

        # Check 1: URL patterns
        url = page.url.lower()
        for pattern in _CAPTCHA_URL_PATTERNS:
            if pattern in url:
                results.append(DetectionResult(True, "url", f"URL contains '{pattern}': {url}"))

        # Check 2: Page content signatures
        try:
            content = await page.content()
            content_lower = content.lower()
            for sig in _CAPTCHA_SIGNATURES:
                if sig in content_lower:
                    results.append(DetectionResult(True, "content", f"Page contains '{sig}'"))
                    break  # One content match is sufficient
        except Exception as e:
            logger.warning("Could not read page content for CAPTCHA check: %s", e)

        # Check 3: Known CAPTCHA iframes
        try:
            frames = page.frames
            for frame in frames:
                frame_url = frame.url.lower()
                captcha_domains = [
                    "google.com/recaptcha",
                    "hcaptcha.com",
                    "challenges.cloudflare.com",
                    "arkoselabs.com",
                    "client-api.arkoselabs.com",
                ]
                for domain in captcha_domains:
                    if domain in frame_url:
                        results.append(DetectionResult(True, "iframe", f"CAPTCHA iframe: {frame_url}"))
                        break
        except Exception as e:
            logger.warning("Could not check frames for CAPTCHA: %s", e)

        # If any detection triggered, abort
        detected = [r for r in results if r.detected]
        if detected:
            primary = detected[0]
            logger.warning(
                "CAPTCHA DETECTED — aborting agent execution. Source: %s, Details: %s",
                primary.source,
                primary.details,
            )
            raise CaptchaDetectedError(source=primary.source, details=primary.details)

    async def check_page_content(self, html_content: str, url: str = "") -> None:
        """Check raw HTML content for CAPTCHA signatures. For use with mock provider."""
        content_lower = html_content.lower()
        for sig in _CAPTCHA_SIGNATURES:
            if sig in content_lower:
                raise CaptchaDetectedError(source="content", details=f"HTML contains '{sig}'")

        url_lower = url.lower()
        for pattern in _CAPTCHA_URL_PATTERNS:
            if pattern in url_lower:
                raise CaptchaDetectedError(source="url", details=f"URL contains '{pattern}'")
