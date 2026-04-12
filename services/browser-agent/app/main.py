"""Broflo Browser Agent Service — purchases from any retailer via managed browser sessions."""

import logging

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from .config import SERVICE_KEY, BROWSERBASE_API_KEY
from .schemas import ExecuteRequest, AgentResult
from .providers import BrowserbaseProvider, MockProvider

logger = logging.getLogger("broflo-browser-agent")

app = FastAPI(title="Broflo Browser Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Provider selection: Browserbase if configured, else Mock
if BROWSERBASE_API_KEY:
    _provider = BrowserbaseProvider()
    logger.info("Using Browserbase provider")
else:
    _provider = MockProvider()
    logger.info("Using Mock provider (no BROWSERBASE_API_KEY)")


def _verify_key(key: str) -> None:
    if key != SERVICE_KEY:
        raise HTTPException(403, "Invalid service key")


@app.get("/health")
async def health() -> dict:
    provider_ok = await _provider.health_check()
    return {
        "status": "ok" if provider_ok else "degraded",
        "service": "broflo-browser-agent",
        "version": "0.1.0",
        "provider": _provider.provider_name,
        "provider_healthy": provider_ok,
    }


@app.post("/agent/execute", response_model=AgentResult)
async def execute(
    req: ExecuteRequest,
    x_service_key: str = Header(alias="X-Service-Key"),
) -> AgentResult:
    """Execute a browser agent job. Called by NestJS API.

    In preview mode: navigates retailer, finds product, returns preview.
    In place mode: completes checkout with virtual card.
    """
    _verify_key(x_service_key)

    from .agent.browser_order_agent import BrowserOrderAgent

    agent = BrowserOrderAgent(provider=_provider)

    try:
        result = await agent.execute(req)
        return result
    except Exception as e:
        logger.error("Agent execution failed for job %s: %s", req.job_id, e)
        return AgentResult(
            job_id=req.job_id,
            status="failed",
            failure_reason="unknown",
            steps=[],
        )
