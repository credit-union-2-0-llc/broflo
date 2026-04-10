"""Broflo AI Service — Gift Brain suggestion endpoint."""

import json
import time
import logging

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import anthropic

from .schemas import SuggestRequest, SuggestResponse, SuggestionItem
from .prompt import build_system_prompt, build_user_message
from .postprocess import run_pipeline
from .config import (
    SERVICE_KEY,
    ANTHROPIC_API_KEY,
    TIER_MODELS,
    ANTHROPIC_TIMEOUT_S,
    MAX_RETRIES,
)

logger = logging.getLogger("broflo-ai")

app = FastAPI(title="Broflo AI Service", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_client() -> anthropic.Anthropic:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "Anthropic API key not configured")
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def _call_anthropic(
    client: anthropic.Anthropic,
    model: str,
    system_prompt: str,
    user_message: str,
    retry: bool = False,
) -> anthropic.types.Message:
    """Call the Anthropic API with optional retry suffix."""
    extra = "\n\nReturn ONLY valid JSON. No markdown fences." if retry else ""
    return client.messages.create(
        model=model,
        max_tokens=2048,
        system=[{
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": user_message + extra}],
        timeout=ANTHROPIC_TIMEOUT_S,
    )


def _parse_suggestions(raw: str) -> list[SuggestionItem]:
    """Parse and validate JSON suggestions from model output."""
    text = raw.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    data = json.loads(text)
    if isinstance(data, dict) and "suggestions" in data:
        data = data["suggestions"]
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    return [SuggestionItem.model_validate(item) for item in data]


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "broflo-ai", "version": "0.2.0"}


@app.post("/suggest", response_model=SuggestResponse)
async def suggest(
    req: SuggestRequest,
    x_service_key: str = Header(alias="X-Service-Key"),
) -> SuggestResponse:
    """Generate AI gift suggestions."""
    if x_service_key != SERVICE_KEY:
        raise HTTPException(403, "Invalid service key")

    model = TIER_MODELS[req.tier]
    system_prompt = build_system_prompt(req)
    user_message = build_user_message(req)

    client = _get_client()
    start = time.monotonic()
    retry_count = 0
    suggestions: list[SuggestionItem] = []

    for attempt in range(1 + MAX_RETRIES):
        try:
            response = _call_anthropic(
                client, model, system_prompt, user_message,
                retry=(attempt > 0),
            )
            raw_text = response.content[0].text
            suggestions = _parse_suggestions(raw_text)
            break
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            retry_count += 1
            if attempt >= MAX_RETRIES:
                logger.error("Failed to parse AI response after retries: %s", e)
                raise HTTPException(500, "AI returned invalid response")
        except anthropic.APITimeoutError:
            raise HTTPException(504, "AI service timeout")
        except anthropic.RateLimitError:
            raise HTTPException(429, "AI service rate limited")
        except anthropic.APIError as e:
            logger.error("Anthropic API error: %s", e)
            raise HTTPException(502, "AI service error")

    elapsed_ms = int((time.monotonic() - start) * 1000)

    # Post-processing pipeline
    suggestions, filtered_count = run_pipeline(suggestions, req)

    # Check cache hit from response headers
    prompt_cache_hit = False
    if hasattr(response, "usage") and hasattr(response.usage, "cache_read_input_tokens"):
        prompt_cache_hit = (response.usage.cache_read_input_tokens or 0) > 0

    input_tokens = response.usage.input_tokens if hasattr(response, "usage") else 0
    output_tokens = response.usage.output_tokens if hasattr(response, "usage") else 0

    return SuggestResponse(
        suggestions=suggestions,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=elapsed_ms,
        prompt_cache_hit=prompt_cache_hit,
        retry_count=retry_count,
        suggestions_filtered=filtered_count,
    )
