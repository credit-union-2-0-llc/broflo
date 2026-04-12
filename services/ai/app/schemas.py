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
    # S-11 additions
    pronouns: str | None = None
    allergens: list[str] = Field(default_factory=list)
    dietary_restrictions: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    wishlist_items: list[str] = Field(default_factory=list)  # product titles


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


# --- S-11: Enrichment schemas ---


class ParseWishlistRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=5)
    tier: SubscriptionTier


class ParsedProduct(BaseModel):
    title: str
    brand: str | None = None
    category: str | None = None
    price_cents: int | None = None
    price_range_min_cents: int | None = None
    price_range_max_cents: int | None = None
    color: str | None = None
    size: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)


class ParsedUrlResult(BaseModel):
    url: str
    source_type: str  # wishlist | registry | product_page | shop_page | unknown
    products: list[ParsedProduct]
    error: str | None = None


class ParseWishlistResponse(BaseModel):
    results: list[ParsedUrlResult]
    model: str
    total_input_tokens: int
    total_output_tokens: int
    latency_ms: int


class GenerateTagsRequest(BaseModel):
    person_name: str
    relationship: str
    hobbies: str | None = None
    music_taste: str | None = None
    favorite_brands: str | None = None
    food_preferences: str | None = None
    notes: str | None = None
    tier: SubscriptionTier


class GeneratedTag(BaseModel):
    label: str
    category: str  # hobby | aesthetic | food_drink | music_media | fashion | lifestyle | tech | sports | exclusion | other
    source_field: str  # hobbies | music_taste | favorite_brands | food_preferences | notes | inferred
    confidence: float = Field(ge=0.0, le=1.0)


class GenerateTagsResponse(BaseModel):
    tags: list[GeneratedTag]
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


class GenerateInsightRequest(BaseModel):
    person_name: str
    relationship: str
    hobbies: str | None = None
    music_taste: str | None = None
    favorite_brands: str | None = None
    food_preferences: str | None = None
    clothing_size_top: str | None = None
    clothing_size_bottom: str | None = None
    shoe_size: str | None = None
    notes: str | None = None
    pronouns: str | None = None
    allergens: list[str] = Field(default_factory=list)
    dietary_restrictions: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    gift_history: list[GiftHistoryItem] = Field(default_factory=list)
    never_again: list[NeverAgainItem] = Field(default_factory=list)
    tier: SubscriptionTier  # must be elite


class GenerateInsightResponse(BaseModel):
    profile_text: str
    suggested_categories: list[str]
    data_richness: str  # sparse | moderate | rich
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


# --- S-12: Photo Analysis schemas ---


class PhotoCategory(str, Enum):
    bookshelf = "bookshelf"
    closet = "closet"
    artwork = "artwork"
    desk = "desk"
    kitchen = "kitchen"
    bar_cart = "bar_cart"
    shoes = "shoes"
    jewelry = "jewelry"
    nightstand = "nightstand"
    garage = "garage"
    garden = "garden"
    gaming_music = "gaming_music"
    pet_area = "pet_area"
    fridge = "fridge"
    car = "car"
    social_ig_fb = "social_ig_fb"
    social_spotify = "social_spotify"
    social_amazon = "social_amazon"
    other = "other"


class AnalyzePhotoRequest(BaseModel):
    image_base64: str  # base64-encoded JPEG
    category: PhotoCategory = PhotoCategory.other
    tier: SubscriptionTier  # pro or elite (free not allowed)
    person_name: str | None = None


class PriceSignal(BaseModel):
    tier: str  # budget | mid | premium | luxury
    evidence: str = ""


class ExtractedSignal(BaseModel):
    brands: list[str] = Field(default_factory=list)
    styles: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    price_signals: PriceSignal | None = None
    extracted_tags: list[str] = Field(default_factory=list)
    do_not_gift: list[str] = Field(default_factory=list)
    raw_observations: str = ""
    category_specific: dict = Field(default_factory=dict)
    image_quality: str = "good"  # good | fair | poor
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)


class AnalyzePhotoResponse(BaseModel):
    signals: ExtractedSignal
    category: PhotoCategory
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
