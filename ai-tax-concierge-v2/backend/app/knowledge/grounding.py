"""Grounding helpers — keep verified official figures ahead of model memory."""

from __future__ import annotations

import re
from typing import List, Sequence, Tuple

from app.models.schemas import SourceReference

# Full verified summaries must reach the LLM. The prior 280-char clip truncated
# MTD threshold dates (e.g. £30,000 → 6 April 2027) out of the prompt.
MAX_FACT_EXCERPT_CHARS = 1200

_STALE_VAT = re.compile(r"£?\s*85[\s,]*000", re.IGNORECASE)
_VAT_90 = re.compile(r"£?\s*90[\s,]*000", re.IGNORECASE)
_APRIL_2026 = re.compile(r"\b(?:6\s+)?april\s+2026\b", re.IGNORECASE)
_APRIL_2027 = re.compile(r"\b(?:6\s+)?april\s+2027\b", re.IGNORECASE)
_AMOUNT_30K = re.compile(r"(?:£?\s*30[\s,]*000|30000)", re.IGNORECASE)


def fact_excerpt(summary: str, *, limit: int = MAX_FACT_EXCERPT_CHARS) -> str:
    text = (summary or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _joined_sources(sources: Sequence[SourceReference]) -> str:
    return " ".join(f"{s.title} {s.excerpt or ''}" for s in sources)


def apply_grounding_guard(
    reply: str,
    message: str,
    sources: Sequence[SourceReference],
) -> Tuple[str, List[str]]:
    """Correct known stale parametric slips when verified sources contradict them.

    Returns (possibly corrected reply, correction flags).
    """
    if not reply or not sources:
        return reply, []

    flags: List[str] = []
    out = reply
    corpus = _joined_sources(sources)
    corpus_compact = corpus.lower().replace(",", "")
    msg_compact = message.lower().replace(",", "")

    # VAT: verified £90,000 must beat stale £85,000 model memory.
    if "90000" in corpus_compact or "£90000" in corpus_compact:
        if _STALE_VAT.search(out) and not _VAT_90.search(out):
            out = _STALE_VAT.sub("£90,000", out)
            flags.append("corrected_stale_vat_threshold_85000")
        elif _STALE_VAT.search(out) and _VAT_90.search(out):
            out = _STALE_VAT.sub("£90,000", out)
            flags.append("removed_stale_vat_threshold_85000")

    # MTD £30k band: verified start is 6 April 2027, not April 2026.
    asks_30k = bool(_AMOUNT_30K.search(message)) or "30000" in msg_compact
    corpus_has_30k_2027 = (
        ("30000" in corpus_compact or "£30000" in corpus_compact)
        and "2027" in corpus_compact
    )
    if asks_30k and corpus_has_30k_2027:
        if _APRIL_2026.search(out) and not _APRIL_2027.search(out):
            out = _APRIL_2026.sub("6 April 2027", out, count=1)
            flags.append("corrected_mtd_30k_start_to_april_2027")
            if "April 2026 applies only" not in out:
                out = (
                    out.rstrip()
                    + "\n\nNote: for qualifying income over £30,000 in 2025-26, "
                    "Making Tax Digital for Income Tax starts from 6 April 2027. "
                    "6 April 2026 applies to the £50,000 (2024-25) band."
                )
                flags.append("added_mtd_band_clarification")

    return out, flags
