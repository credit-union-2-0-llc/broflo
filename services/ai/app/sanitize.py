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

# Common prompt injection prefixes to strip
_INJECTION_PREFIXES = re.compile(
    r"(?i)^(?:ignore|override|system:|IMPORTANT:|forget|disregard)\s*:?\s*",
    re.MULTILINE,
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
    return result.strip()
