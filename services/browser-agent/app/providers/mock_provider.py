"""Mock browser provider for testing — no real browser sessions.

Follows the same MockAdapter pattern from S-7. Returns deterministic results
so CI tests pass without Browserbase credentials.
"""

import logging
import uuid
from typing import Optional

from .base import BrowserProvider, BrowserSession

logger = logging.getLogger("broflo-browser-agent.mock")


class MockProvider(BrowserProvider):
    """Mock provider that simulates browser sessions for testing."""

    def __init__(self) -> None:
        self._sessions: dict[str, bool] = {}

    @property
    def provider_name(self) -> str:
        return "mock"

    async def create_session(self) -> BrowserSession:
        session_id = f"mock-{uuid.uuid4().hex[:12]}"
        self._sessions[session_id] = True
        logger.info("Created mock session: %s", session_id)
        return BrowserSession(
            session_id=session_id,
            connect_url=f"ws://localhost:0/mock/{session_id}",
            provider="mock",
        )

    async def close_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        logger.info("Closed mock session: %s", session_id)

    async def take_screenshot(self, page: object) -> Optional[bytes]:
        # Return a 1x1 transparent PNG for testing
        return (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
            b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
            b"\r\n\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )

    async def health_check(self) -> bool:
        return True
