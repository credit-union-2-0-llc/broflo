"""Request/response schemas for the browser agent service."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ExecuteMode(str, Enum):
    preview = "preview"
    place = "place"


class ShippingAddress(BaseModel):
    name: str
    address1: str
    address2: Optional[str] = None
    city: str
    state: str
    zip: str


class ExecuteRequest(BaseModel):
    job_id: str
    retailer_url: str
    search_terms: str
    max_budget_cents: int
    shipping_address: ShippingAddress
    mode: ExecuteMode
    stripe_virtual_card_id: Optional[str] = None
    virtual_card_number: Optional[str] = None
    virtual_card_exp: Optional[str] = None
    virtual_card_cvc: Optional[str] = None


class StepResult(BaseModel):
    step_number: int
    action: str
    status: str
    screenshot_url: Optional[str] = None
    page_url: Optional[str] = None
    ai_model_used: Optional[str] = None
    ai_confidence: Optional[float] = None
    metadata: Optional[dict] = None


class AgentResult(BaseModel):
    job_id: str
    status: str  # completed | failed | aborted
    found_product_title: Optional[str] = None
    found_product_price: Optional[int] = None
    found_product_url: Optional[str] = None
    found_product_image: Optional[str] = None
    match_confidence: Optional[float] = None
    confirmation_number: Optional[str] = None
    failure_reason: Optional[str] = None
    steps: list[StepResult] = Field(default_factory=list)
    browser_session_id: Optional[str] = None


class CallbackPayload(BaseModel):
    job_id: str
    status: str
    result: AgentResult
    hmac_signature: str
