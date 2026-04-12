"""Abstract browser provider interface — swap Browserbase/Steel/Mock without changing agent logic."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BrowserSession:
    session_id: str
    connect_url: str
    provider: str
    metadata: dict = field(default_factory=dict)


class BrowserProvider(ABC):
    """Abstract base for managed browser session providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str: ...

    @abstractmethod
    async def create_session(self) -> BrowserSession:
        """Create an isolated browser session. Each session is fresh — no shared state."""
        ...

    @abstractmethod
    async def close_session(self, session_id: str) -> None:
        """Terminate and destroy a browser session."""
        ...

    @abstractmethod
    async def take_screenshot(self, page: object) -> Optional[bytes]:
        """Capture a screenshot of the current page. Returns PNG bytes or None."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is available."""
        ...
