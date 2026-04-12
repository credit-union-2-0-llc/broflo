"""Configuration for the browser agent service."""

import os

# Service authentication
SERVICE_KEY = os.getenv("BROWSER_AGENT_SERVICE_KEY", "dev-browser-agent-key")

# Browserbase
BROWSERBASE_API_KEY = os.getenv("BROWSERBASE_API_KEY", "")
BROWSERBASE_PROJECT_ID = os.getenv("BROWSERBASE_PROJECT_ID", "")

# Anthropic API (for AI product matching + navigation)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Azure Blob Storage (screenshots)
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
SCREENSHOT_CONTAINER = "agent-screenshots"

# Callback URL (NestJS API)
CALLBACK_URL = os.getenv("CALLBACK_URL", "http://localhost:3001/orders/agent/callback")
CALLBACK_HMAC_SECRET = os.getenv("CALLBACK_HMAC_SECRET", "dev-hmac-secret")

# Agent execution limits
MAX_EXECUTION_SECONDS = 180  # 3-minute hard timeout
MAX_STEPS = 15
PRICE_MISMATCH_THRESHOLD_PCT = 10  # abort if checkout price > preview price + 10%

# Retry policy for transient failures
MAX_RETRIES = 2  # 3 total attempts
RETRY_BACKOFF_SECONDS = [30, 120]  # exponential backoff
RETRY_MAX_WALL_CLOCK_SECONDS = 300  # 5-minute P95 cap for all attempts
TRANSIENT_FAILURE_REASONS = {"timeout", "unknown"}  # only these get retried

# AI models
PRODUCT_MATCH_MODEL = "claude-sonnet-4-6-20260217"  # vision + reasoning for matching
NAVIGATION_MODEL = "claude-haiku-4-5-20251001"  # fast classification for nav
