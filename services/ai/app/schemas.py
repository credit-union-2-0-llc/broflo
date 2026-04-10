"""Pydantic schemas for the AI suggestion service."""

from enum import Enum
from pydantic import BaseModel, Field


class SurpriseFactor(str, Enum):
    safe = "safe"
    bold = "bold"


class SubscriptionTier(str, Enum):
    free = "free"
    pro = "pro"
    elite = "elite"


class PersonDossier(BaseModel):
    name: str
    relationship: str
    birthday_month_day: str | None = None  # "05/15" format, no year
    anniversary_month_day: str | None = None
    hobbies: str | None = None
    music_taste: str | None = None
    favorite_brands: str | None = None
    food_preferences: str | None = None
    clothing_size_top: str | None = None
    clothing_size_bottom: str | None = None
    shoe_size: str | None = None
    notes: str | None = None


class NeverAgainItem(BaseModel):
    description: str


class GiftHistoryItem(BaseModel):
    title: str
    given_at: str
    rating: int | None = None


class DismissedItem(BaseModel):
    title: str
    reason: str | None = None


class SuggestRequest(BaseModel):
    person: PersonDossier
    event_type: str
    event_date: str
    days_until: int
    budget_min_cents: int
    budget_max_cents: int
    budget_source: str = "default"
    never_again: list[NeverAgainItem] = Field(default_factory=list)
    gift_history: list[GiftHistoryItem] = Field(default_factory=list)
    dismissed: list[DismissedItem] = Field(default_factory=list)
    tier: SubscriptionTier
    surprise_factor: SurpriseFactor = SurpriseFactor.safe
    guidance_text: str | None = None
    count: int = 3


class SuggestionItem(BaseModel):
    title: str
    description: str
    estimated_price_min_cents: int
    estimated_price_max_cents: int
    reasoning: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    delight_score: float = Field(ge=0.0, le=1.0)
    novelty_score: float = Field(ge=0.0, le=1.0)
    retailer_hint: str | None = None
    suggested_message: str | None = None


class SuggestResponse(BaseModel):
    suggestions: list[SuggestionItem]
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    prompt_cache_hit: bool = False
    retry_count: int = 0
    suggestions_filtered: int = 0
