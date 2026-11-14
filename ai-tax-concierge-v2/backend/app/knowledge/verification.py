"""Source verification — only emit references that pass policy checks."""

from __future__ import annotations

from typing import Iterable, List
from urllib.parse import urlparse

from app.knowledge.grounding import fact_excerpt
from app.knowledge.retrieval import RankedFact
from app.models.schemas import SourceReference

ALLOWED_HOSTS = {
    "www.gov.uk",
    "gov.uk",
    "www.gov.uk.",
}

ALLOWED_PUBLISHER_MARKERS = ("hmrc", "gov.uk", "government digital service")


def _host_allowed(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False
    if not host:
        return False
    return host in ALLOWED_HOSTS or host.endswith(".gov.uk")


def _publisher_allowed(publisher: str) -> bool:
    p = (publisher or "").lower()
    return any(marker in p for marker in ALLOWED_PUBLISHER_MARKERS)


def verify_ranked(ranked: Iterable[RankedFact]) -> List[SourceReference]:
    """Convert ranked facts into verified source references; drop unverified.

    Uses a long excerpt (full summary up to grounding.MAX_FACT_EXCERPT_CHARS)
    so threshold dates and figures are not clipped out of the LLM prompt.
    """
    out: List[SourceReference] = []
    for item in ranked:
        fact = item.fact
        ok = (
            bool(fact.source_url)
            and _host_allowed(fact.source_url)
            and _publisher_allowed(fact.publisher)
            and bool(fact.tax_years)
        )
        if not ok:
            continue
        out.append(
            SourceReference(
                id=fact.id,
                title=fact.title,
                publisher=fact.publisher,
                url=fact.source_url,
                tax_years=list(fact.tax_years),
                verified=True,
                excerpt=fact_excerpt(fact.summary),
            )
        )
    return out


def confidence_from_sources(sources: List[SourceReference], year_matches: int) -> str:
    if not sources:
        return "low"
    if len(sources) >= 2 and year_matches >= 1:
        return "high"
    if year_matches >= 1:
        return "medium"
    return "low"
