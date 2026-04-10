"""Configuration for the AI service."""

import os

from .schemas import SubscriptionTier

# Service authentication
SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "dev-ai-service-key")

# Anthropic API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Model routing by tier
TIER_MODELS: dict[SubscriptionTier, str] = {
    SubscriptionTier.free: "claude-haiku-4-5-20250315",
    SubscriptionTier.pro: "claude-sonnet-4-20250514",
    SubscriptionTier.elite: "claude-sonnet-4-6-20260217",
}

# Suggestion counts by tier
TIER_COUNTS: dict[SubscriptionTier, int] = {
    SubscriptionTier.free: 3,
    SubscriptionTier.pro: 5,
    SubscriptionTier.elite: 5,
}

# Timeouts
ANTHROPIC_TIMEOUT_S = 30
MAX_RETRIES = 1
