from app.knowledge.loader import load_facts
from app.knowledge.retrieval import retrieve
from app.knowledge.verification import confidence_from_sources, verify_ranked
from app.models.schemas import KnowledgeFact


def test_corpus_loads_and_has_govuk_sources():
    facts = load_facts()
    assert len(facts) >= 8
    assert all(f.source_url.startswith("https://www.gov.uk") for f in facts)


def test_retrieve_self_assessment_deadline():
    ranked = retrieve("When is the Self Assessment online filing deadline?", "2025-26")
    assert ranked
    assert any("deadline" in r.fact.id or "deadline" in r.fact.title.lower() for r in ranked)
    assert ranked[0].year_match is True


def test_retrieve_personal_allowance_year_aware():
    ranked = retrieve("What is the personal allowance?", "2025-26")
    assert ranked
    assert "2025-26" in ranked[0].fact.tax_years


def test_verify_accepts_govuk_rejects_unknown_host():
    good = retrieve("Making Tax Digital quarterly updates", "2025-26")
    sources = verify_ranked(good)
    assert sources
    assert all(s.verified for s in sources)
    assert all("gov.uk" in s.url for s in sources)

    from app.knowledge.retrieval import RankedFact

    evil = KnowledgeFact(
        id="evil",
        title="Fake",
        summary="bad",
        keywords=["fake"],
        tax_years=["2025-26"],
        source_url="https://evil.example.com/tax",
        publisher="Not HMRC",
        category="general",
        last_verified="2026-01-01",
    )
    verified = verify_ranked([RankedFact(fact=evil, score=10.0, year_match=True)])
    assert verified == []


def test_confidence_levels():
    ranked = retrieve("Self Assessment payments on account 31 July", "2025-26")
    sources = verify_ranked(ranked)
    year_matches = sum(1 for r in ranked if r.year_match)
    level = confidence_from_sources(sources, year_matches)
    assert level in {"high", "medium", "low"}
    assert confidence_from_sources([], 0) == "low"
