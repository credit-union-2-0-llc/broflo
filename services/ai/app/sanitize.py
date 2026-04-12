"""PII sanitization for AI prompts (F-03 security requirement)."""

import re

# Patterns to strip from free-text fields before sending to Anthropic
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(
    r"(?:\+?1[-.\s]?)?"
    r"(?:\(?\d{3}\)?[-.\s]?)"
    r"\d{3}[-.\s]?\d{4}"
)
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_CREDIT_CARD_RE = re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b")

# Common prompt injection prefixes to strip (expanded for S-11)
_INJECTION_PREFIXES = re.compile(
    r"(?i)^(?:ignore|override|system:|IMPORTANT:|forget|disregard|"
    r"you are|act as|pretend|roleplay|simulate|new instructions?|instead of)\s*:?\s*",
    re.MULTILINE,
)

# Injection delimiters used in adversarial prompts
_INJECTION_DELIMITERS = re.compile(
    r"<system>|<human>|<assistant>|<tool_use>|<\|im_start\|>|\[INST\]|### Instruction",
    re.IGNORECASE,
)

# HTML/XML tags
_TAGS_RE = re.compile(r"<[^>]+>")

# Control characters (except newline, tab)
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def strip_pii(text: str | None) -> str | None:
    """Remove emails, phones, SSNs, credit cards from text."""
    if not text:
        return text
    result = _EMAIL_RE.sub("[email removed]", text)
    result = _SSN_RE.sub("[SSN removed]", result)
    result = _CREDIT_CARD_RE.sub("[card removed]", result)
    result = _PHONE_RE.sub("[phone removed]", result)
    return result


def sanitize_prompt_field(text: str | None) -> str | None:
    """Full sanitization: PII strip + injection defense + tag removal."""
    if not text:
        return text
    result = strip_pii(text)
    result = _TAGS_RE.sub("", result)
    result = _CONTROL_RE.sub("", result)
    result = _INJECTION_PREFIXES.sub("", result)
    result = _INJECTION_DELIMITERS.sub("", result)
    return result.strip()


def sanitize_scraped_field(text: str | None, max_length: int = 500) -> str | None:
    """Sanitize scraped web content before storage (T3/T7 defense).

    Strips HTML, control chars, and truncates. Does NOT strip PII
    (scraped data is public product info, not user PII).
    """
    if not text:
        return text
    result = _TAGS_RE.sub("", text)
    result = _CONTROL_RE.sub("", result)
    result = result.strip()
    if len(result) > max_length:
        result = result[:max_length]
    return result


# Tag format validation (M7.1)
_TAG_VALID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9 &/\-]{0,98}[a-zA-Z0-9]$")
_TAG_BANNED_CHARS = re.compile(r"[<>\"';()]")


def sanitize_tag(tag: str) -> str | None:
    """Validate and normalize a tag string. Returns None if invalid."""
    tag = tag.strip().lower()
    if len(tag) < 2 or len(tag) > 100:
        return None
    if _TAG_BANNED_CHARS.search(tag):
        return None
    # Collapse multiple spaces
    tag = re.sub(r"\s+", " ", tag)
    return tag
