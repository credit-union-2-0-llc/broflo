"""Prompt assembly for the Gift Brain AI service."""

import json

from .schemas import SuggestRequest, SurpriseFactor, SubscriptionTier
from .sanitize import sanitize_prompt_field

SUGGESTION_JSON_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "required": [
            "title",
            "description",
            "estimated_price_min_cents",
            "estimated_price_max_cents",
            "reasoning",
            "confidence_score",
            "delight_score",
            "novelty_score",
        ],
        "properties": {
            "title": {"type": "string"},
            "description": {"type": "string"},
            "estimated_price_min_cents": {"type": "integer"},
            "estimated_price_max_cents": {"type": "integer"},
            "reasoning": {"type": "string"},
            "confidence_score": {"type": "number", "minimum": 0, "maximum": 1},
            "delight_score": {"type": "number", "minimum": 0, "maximum": 1},
            "novelty_score": {"type": "number", "minimum": 0, "maximum": 1},
            "retailer_hint": {"type": ["string", "null"]},
            "suggested_message": {"type": ["string", "null"]},
        },
    },
}

TIER_INSTRUCTIONS = {
    SubscriptionTier.free: (
        "Provide solid, practical gift suggestions. Keep rationale concise."
    ),
    SubscriptionTier.pro: (
        "Provide deeply personalized suggestions. Reference specific details "
        "from the dossier in every rationale. Be creative and specific — "
        "not generic gift lists."
    ),
    SubscriptionTier.elite: (
        "You are the premium Gift Brain. Every suggestion must feel like it was "
        "chosen by someone who truly knows and cares about the recipient. "
        "Reference multiple dossier signals. Suggest experiences, not just "
        "products. Include a suggested personal message for each gift in the "
        "suggested_message field."
    ),
}

SURPRISE_INSTRUCTIONS = {
    SurpriseFactor.safe: (
        "Prioritize crowd-pleasing, proven gift choices that are likely to "
        "delight. Weight reliability over surprise."
    ),
    SurpriseFactor.bold: (
        "Prioritize unique, unexpected, experience-based gifts. Be adventurous. "
        "Weight novelty and surprise over safe choices."
    ),
}

BLOCKLIST_CATEGORIES = [
    "weapons",
    "firearms",
    "ammunition",
    "adult content",
    "pornography",
    "prescription medication",
    "controlled substances",
    "live animals",
]


def build_system_prompt(req: SuggestRequest) -> str:
    """Build the system prompt (cacheable across requests)."""
    tier_instruction = TIER_INSTRUCTIONS[req.tier]
    surprise_instruction = SURPRISE_INSTRUCTIONS[req.surprise_factor]
    schema_str = json.dumps(SUGGESTION_JSON_SCHEMA, indent=2)

    include_message = req.tier == SubscriptionTier.elite
    message_note = (
        "Include a suggested_message field with a personal message draft "
        "for each gift."
        if include_message
        else "Set suggested_message to null for all suggestions."
    )

    return f"""You are Broflo's Gift Brain — a brilliant, discreet gift concierge. You produce \
personalized gift suggestions that feel like they came from someone who truly knows \
the recipient. You are NOT a generic gift list generator.

{tier_instruction}

{surprise_instruction}

{message_note}

HARD RULES (never violate):
1. NEVER suggest items on the NEVER-AGAIN list below.
2. NEVER repeat or closely resemble items in GIFT HISTORY below.
3. ALL suggestions MUST have estimated_price_min_cents and estimated_price_max_cents \
within the BUDGET range (allow 10% overage for shipping).
4. Return ONLY valid JSON matching the OUTPUT SCHEMA below. No prose, no markdown, \
no explanation outside the JSON.
5. NEVER suggest: {", ".join(BLOCKLIST_CATEGORIES)}.
6. NEVER assume gender, religion, or cultural background unless explicitly stated.
7. Prices are in cents (e.g., 5000 = $50.00).
8. ALLERGEN RESTRICTIONS are HARD RULES: NEVER suggest gifts containing or related \
to any listed allergen. These are safety-critical.
9. Respect DIETARY RESTRICTIONS: avoid food/drink gifts that violate them.
10. Use INTEREST TAGS and WISHLIST ITEMS as strong signals for gift categories.

OUTPUT SCHEMA:
{schema_str}"""


def build_user_message(req: SuggestRequest) -> str:
    """Build the user message with dossier context."""
    p = req.person
    budget_min = f"${req.budget_min_cents / 100:.0f}"
    budget_max = f"${req.budget_max_cents / 100:.0f}"

    # Sanitize all free-text fields (F-03)
    sanitized_notes = sanitize_prompt_field(p.notes)
    sanitized_hobbies = sanitize_prompt_field(p.hobbies)
    sanitized_music = sanitize_prompt_field(p.music_taste)
    sanitized_brands = sanitize_prompt_field(p.favorite_brands)
    sanitized_food = sanitize_prompt_field(p.food_preferences)

    dossier_lines = []
    if sanitized_hobbies:
        dossier_lines.append(f"- Hobbies: {sanitized_hobbies}")
    if sanitized_music:
        dossier_lines.append(f"- Music taste: {sanitized_music}")
    if sanitized_brands:
        dossier_lines.append(f"- Favorite brands: {sanitized_brands}")
    if sanitized_food:
        dossier_lines.append(f"- Food preferences: {sanitized_food}")
    if p.clothing_size_top:
        dossier_lines.append(f"- Clothing: top {p.clothing_size_top}")
    if p.clothing_size_bottom:
        dossier_lines.append(f"  bottom {p.clothing_size_bottom}")
    if p.shoe_size:
        dossier_lines.append(f"  shoe {p.shoe_size}")
    if sanitized_notes:
        dossier_lines.append(f"- Notes: {sanitized_notes}")

    # S-11: New dossier fields
    if p.pronouns:
        dossier_lines.append(f"- Pronouns: {p.pronouns}")
    if p.allergens:
        sanitized_allergens = [sanitize_prompt_field(a) or a for a in p.allergens]
        dossier_lines.append(f"- ALLERGENS (HARD RULES - never gift these): {', '.join(sanitized_allergens)}")
    if p.dietary_restrictions:
        sanitized_dietary = [sanitize_prompt_field(d) or d for d in p.dietary_restrictions]
        dossier_lines.append(f"- Dietary restrictions: {', '.join(sanitized_dietary)}")
    if p.tags:
        dossier_lines.append(f"- Interest tags: {', '.join(p.tags[:15])}")
    if p.wishlist_items:
        dossier_lines.append(f"- Wishlist items: {', '.join(p.wishlist_items[:10])}")

    dossier_block = "\n".join(dossier_lines) if dossier_lines else "(minimal dossier)"

    # Never-again list
    na_block = "None"
    if req.never_again:
        na_items = [sanitize_prompt_field(na.description) or na.description for na in req.never_again]
        na_block = "\n".join(f"- {item}" for item in na_items)

    # Gift history (Pro/Elite only — NestJS sends empty list for Free)
    history_block = "None"
    if req.gift_history:
        history_lines = []
        for g in req.gift_history[:20]:
            rating_str = f" — rated {g.rating}/5" if g.rating else ""
            history_lines.append(f"- {g.title} (given {g.given_at}){rating_str}")
        history_block = "\n".join(history_lines)

    # Previously dismissed suggestions for this event
    dismissed_block = ""
    if req.dismissed:
        dismissed_lines = []
        for d in req.dismissed:
            reason = f" because {d.reason}" if d.reason else ""
            dismissed_lines.append(f"- {d.title}{reason}")
        dismissed_block = f"\nPREVIOUSLY DISMISSED:\n" + "\n".join(dismissed_lines)

    # Guidance text
    guidance_block = ""
    if req.guidance_text:
        sanitized_guidance = sanitize_prompt_field(req.guidance_text)
        if sanitized_guidance:
            guidance_block = f"\nADDITIONAL GUIDANCE: {sanitized_guidance}"

    return f"""RECIPIENT: {p.name}
RELATIONSHIP: {p.relationship}
EVENT: {req.event_type} on {req.event_date} ({req.days_until} days away)
BUDGET: {budget_min} - {budget_max} (source: {req.budget_source})

DOSSIER:
{dossier_block}

NEVER-AGAIN LIST:
{na_block}

GIFT HISTORY:
{history_block}{dismissed_block}{guidance_block}

MODE: {req.surprise_factor.value}
COUNT: {req.count}

Generate {req.count} gift suggestions."""
