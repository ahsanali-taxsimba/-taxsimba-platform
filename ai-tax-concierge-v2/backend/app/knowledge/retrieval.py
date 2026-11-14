"""Foundational keyword retrieval over the verified HMRC corpus."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Sequence

from app.knowledge.loader import load_facts
from app.knowledge.tax_year import applies_to_year
from app.models.schemas import KnowledgeFact

_TOKEN = re.compile(r"[a-z0-9%]+", re.IGNORECASE)
_STOP = {
    "a",
    "an",
    "the",
    "is",
    "are",
    "do",
    "does",
    "i",
    "my",
    "me",
    "to",
    "for",
    "of",
    "and",
    "or",
    "in",
    "on",
    "what",
    "when",
    "how",
    "please",
    "can",
    "you",
    "tell",
    "about",
}


@dataclass(frozen=True)
class RankedFact:
    fact: KnowledgeFact
    score: float
    year_match: bool


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in _TOKEN.findall(text) if t.lower() not in _STOP and len(t) > 1}


def _normalize_amounts(text: str) -> str:
    """Collapse £30,000 / 30,000 / 30000 style forms for matching."""
    compact = text.lower().replace(",", "").replace("£", "")
    compact = re.sub(r"\s+", " ", compact)
    return compact


def score_fact(query: str, fact: KnowledgeFact, tax_year: str) -> RankedFact:
    q = _tokens(query)
    title_tokens = _tokens(fact.title)
    haystack = _tokens(
        " ".join([fact.title, fact.summary, " ".join(fact.keywords), fact.category])
    )
    overlap = q & haystack
    title_overlap = q & title_tokens
    # Prefer multi-word keyword phrases present in the query
    phrase_bonus = 0.0
    q_lower = query.lower()
    q_amounts = _normalize_amounts(query)
    for kw in fact.keywords:
        if kw.lower() in q_lower:
            phrase_bonus += 2.5
        kw_amount = _normalize_amounts(kw)
        if kw_amount and kw_amount in q_amounts and any(ch.isdigit() for ch in kw_amount):
            phrase_bonus += 4.0
    if fact.title.lower() in q_lower:
        phrase_bonus += 3.0
    # Strong boost when a precise threshold figure in the summary matches the query
    for amount in ("50000", "30000", "20000", "90000", "12570"):
        if amount in q_amounts and amount in _normalize_amounts(fact.summary + " " + " ".join(fact.keywords)):
            phrase_bonus += 5.0
    # Category intent boost (e.g. VAT questions must not lose to generic "register" SA facts)
    category = (fact.category or "").lower()
    if category and category.replace("_", " ") in q_lower:
        phrase_bonus += 4.0
    if "vat" in q_lower and category == "vat":
        phrase_bonus += 6.0
    if ("mtd" in q_lower or "making tax digital" in q_lower) and category == "mtd":
        phrase_bonus += 3.0
    year_match = applies_to_year(fact.tax_years, tax_year)
    score = float(len(overlap)) + (2.0 * len(title_overlap)) + phrase_bonus
    if year_match:
        score += 1.5
    else:
        score *= 0.35
    return RankedFact(fact=fact, score=score, year_match=year_match)


def retrieve(
    query: str,
    tax_year: str,
    *,
    limit: int = 3,
    min_score: float = 1.5,
    facts: Optional[Sequence[KnowledgeFact]] = None,
) -> List[RankedFact]:
    corpus = list(facts) if facts is not None else list(load_facts())
    ranked = [score_fact(query, fact, tax_year) for fact in corpus]
    ranked = [r for r in ranked if r.score >= min_score]
    ranked.sort(key=lambda r: (r.year_match, r.score), reverse=True)
    return ranked[:limit]
