"""Configuration for the AI service."""

import os

from .schemas import SubscriptionTier

# Service authentication
SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "dev-ai-service-key")

# Anthropic API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Model routing by tier
TIER_MODELS: dict[SubscriptionTier, str] = {
    SubscriptionTier.free: "claude-haiku-4-5-20251001",
    SubscriptionTier.pro: "claude-sonnet-4-20250514",
    SubscriptionTier.elite: "claude-sonnet-4-6",
}

# Suggestion counts by tier
TIER_COUNTS: dict[SubscriptionTier, int] = {
    SubscriptionTier.free: 3,
    SubscriptionTier.pro: 5,
    SubscriptionTier.elite: 5,
}

# Enrichment model routing (S-11)
# Wishlist parsing: Haiku for all tiers (structured extraction)
WISHLIST_MODEL = "claude-haiku-4-5-20251001"
# Tag generation: Haiku for Free/Pro, Sonnet 4 for Elite (nuance detection)
TAG_MODELS: dict[SubscriptionTier, str] = {
    SubscriptionTier.free: "claude-haiku-4-5-20251001",
    SubscriptionTier.pro: "claude-haiku-4-5-20251001",
    SubscriptionTier.elite: "claude-sonnet-4-20250514",
}
# Insight generation: Sonnet 4.6 only (Elite-only, synthesis task)
INSIGHT_MODEL = "claude-sonnet-4-6"

# Page content truncation for wishlist parsing
MAX_PAGE_CHARS = 6000

# S-12: Photo analysis model routing (Kirk's G19 decision)
# Free = no analysis (store only), Pro = Haiku, Elite = Sonnet 4.6
VISION_MODELS: dict[SubscriptionTier, str] = {
    SubscriptionTier.pro: "claude-haiku-4-5-20251001",
    SubscriptionTier.elite: "claude-sonnet-4-6",
}

# Timeouts
ANTHROPIC_TIMEOUT_S = 30
VISION_TIMEOUT_S = 45  # Vision calls are heavier
MAX_RETRIES = 1
