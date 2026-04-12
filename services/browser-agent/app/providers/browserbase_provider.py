"""Browserbase provider — production managed browser sessions."""

import logging
from typing import Optional

from browserbase import Browserbase
from playwright.async_api import Page

from .base import BrowserProvider, BrowserSession
from ..config import BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID

logger = logging.getLogger("broflo-browser-agent.browserbase")


class BrowserbaseProvider(BrowserProvider):
    """Browserbase + Stagehand managed browser sessions.

    Each session is fully isolated — separate browser context, cookies, storage.
    No session reuse between agent executions.
    """

    def __init__(self) -> None:
        if not BROWSERBASE_API_KEY:
            logger.warning("BROWSERBASE_API_KEY not set — provider unavailable")
            self._client = None
        else:
            self._client = Browserbase(api_key=BROWSERBASE_API_KEY)

    @property
    def provider_name(self) -> str:
        return "browserbase"

    async def create_session(self) -> BrowserSession:
        if not self._client:
            raise RuntimeError("Browserbase API key not configured")

        session = self._client.sessions.create(
            project_id=BROWSERBASE_PROJECT_ID,
        )

        connect_url = self._client.sessions.debug(session.id).debugger_fullscreen_url

        logger.info("Created Browserbase session: %s", session.id)

        return BrowserSession(
            session_id=session.id,
            connect_url=connect_url,
            provider="browserbase",
            metadata={"project_id": BROWSERBASE_PROJECT_ID},
        )

    async def close_session(self, session_id: str) -> None:
        if not self._client:
            return
        try:
            self._client.sessions.update(session_id, status="REQUEST_RELEASE")
            logger.info("Closed Browserbase session: %s", session_id)
        except Exception as e:
            logger.error("Failed to close session %s: %s", session_id, e)

    async def take_screenshot(self, page: object) -> Optional[bytes]:
        if not isinstance(page, Page):
            return None
        try:
            return await page.screenshot(type="png", full_page=False)
        except Exception as e:
            logger.warning("Screenshot failed: %s", e)
            return None

    async def health_check(self) -> bool:
        if not self._client:
            return False
        try:
            self._client.sessions.list(limit=1)
            return True
        except Exception:
            return False
