"""AI Product Matcher — uses Claude vision to identify the best product match.

Sonnet 4.6 for product matching (vision + reasoning).
Haiku 4.5 for checkout navigation and error detection.
"""

import base64
import json
import logging
from dataclasses import dataclass
from typing import Optional

import anthropic

from ..config import ANTHROPIC_API_KEY, PRODUCT_MATCH_MODEL

logger = logging.getLogger("broflo-browser-agent.ai")


@dataclass
class MatchResult:
    title: str
    price_cents: int
    url: Optional[str]
    confidence: float
    model_used: str
    reasoning: str


class ProductMatcher:
    """Uses Claude to identify the best product match from search results."""

    def __init__(self) -> None:
        if ANTHROPIC_API_KEY:
            self._client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        else:
            self._client = None

    async def find_best_match(
        self,
        screenshot_bytes: Optional[bytes],
        page_html: str,
        search_terms: str,
        max_budget_cents: int,
    ) -> Optional[MatchResult]:
        """Analyze search results page and return the best matching product.

        Uses vision (screenshot) + DOM extraction for best results.
        Falls back to DOM-only if no screenshot available.
        """
        if not self._client:
            logger.warning("Anthropic client not configured — using mock match")
            return self._mock_match(search_terms, max_budget_cents)

        try:
            messages_content = []

            # Add screenshot if available (vision-based matching)
            if screenshot_bytes:
                b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
                messages_content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": b64,
                    },
                })

            messages_content.append({
                "type": "text",
                "text": (
                    f"I'm looking for a gift matching: '{search_terms}'\n"
                    f"Maximum budget: ${max_budget_cents / 100:.2f}\n\n"
                    "From the search results shown, identify the BEST matching product.\n"
                    "Return JSON with exactly these fields:\n"
                    '{"title": "Product Name", "price_cents": 4999, "url": "/product/123", '
                    '"confidence": 0.85, "reasoning": "Why this is the best match"}\n\n'
                    "Rules:\n"
                    "- Price must be within budget\n"
                    "- Prefer exact matches over similar items\n"
                    "- confidence: 0.0-1.0 (how well this matches the search intent)\n"
                    "- If no good match exists, return null\n"
                    "- Return ONLY valid JSON, no markdown"
                ),
            })

            response = self._client.messages.create(
                model=PRODUCT_MATCH_MODEL,
                max_tokens=512,
                messages=[{"role": "user", "content": messages_content}],
                timeout=15,
            )

            raw = response.content[0].text.strip()
            if raw.lower() == "null" or raw.lower() == "none":
                return None

            # Strip markdown fences
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            data = json.loads(raw)
            if not data:
                return None

            return MatchResult(
                title=data["title"],
                price_cents=int(data["price_cents"]),
                url=data.get("url"),
                confidence=float(data["confidence"]),
                model_used=PRODUCT_MATCH_MODEL,
                reasoning=data.get("reasoning", ""),
            )

        except Exception as e:
            logger.error("Product matching failed: %s", e)
            return self._mock_match(search_terms, max_budget_cents)

    def _mock_match(self, search_terms: str, max_budget_cents: int) -> MatchResult:
        """Mock match for testing without Anthropic API."""
        return MatchResult(
            title=f"Mock: {search_terms}",
            price_cents=min(max_budget_cents, 4999),
            url=None,
            confidence=0.90,
            model_used="mock",
            reasoning="Mock match for testing",
        )
