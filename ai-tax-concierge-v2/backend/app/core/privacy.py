"""Privacy helpers — redact PII before analytics / logs."""

from __future__ import annotations

import re
from typing import Dict

# UK-oriented patterns (conservative; over-redact rather than leak)
_UTR = re.compile(r"\b\d{10}\b")
# Over-redact NI-shaped tokens (2 letters + 6 digits + 1 letter), including invalid prefixes
_NI = re.compile(r"\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-Z]\b", re.IGNORECASE)
_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PHONE = re.compile(r"\b(?:\+44\s?|0)(?:7\d{3}|\d{4})\s?\d{3}\s?\d{3,4}\b")
_CARD = re.compile(r"\b(?:\d[ -]*?){13,19}\b")


def redact_pii(text: str) -> str:
    """Replace likely PII with placeholders."""
    if not text:
        return text
    out = text
    out = _EMAIL.sub("[REDACTED_EMAIL]", out)
    out = _NI.sub("[REDACTED_NI]", out)
    out = _UTR.sub("[REDACTED_UTR]", out)
    out = _PHONE.sub("[REDACTED_PHONE]", out)
    out = _CARD.sub("[REDACTED_CARD]", out)
    return out


def privacy_flags(text: str) -> Dict[str, bool]:
    """Indicate whether common PII classes were detected in the raw text."""
    return {
        "email": bool(_EMAIL.search(text or "")),
        "ni": bool(_NI.search(text or "")),
        "utr": bool(_UTR.search(text or "")),
        "phone": bool(_PHONE.search(text or "")),
        "card": bool(_CARD.search(text or "")),
    }
