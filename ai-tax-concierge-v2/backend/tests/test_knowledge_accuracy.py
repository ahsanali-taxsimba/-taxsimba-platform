"""Parametrised HMRC knowledge corpus retrieval accuracy."""

from __future__ import annotations

import pytest

from app.knowledge.loader import load_facts, reload_facts
from app.knowledge.retrieval import retrieve


@pytest.fixture(autouse=True)
def _fresh_facts():
    reload_facts()
    yield
    reload_facts()


def test_corpus_sources_are_gov_uk():
    facts = load_facts()
    assert len(facts) >= 20
    for fact in facts:
        assert fact.source_url.startswith("https://www.gov.uk"), fact.id


def test_mtd_facts_carry_review_status():
    facts = {f.id: f for f in load_facts()}
    for mtd_id in (
        "mtd-who-and-when",
        "mtd-threshold-50k-april-2026",
        "mtd-threshold-30k-april-2027",
        "mtd-threshold-20k-april-2028",
        "mtd-qualifying-income-definition",
        "mtd-digital-records-quarterly",
    ):
        fact = facts[mtd_id]
        assert fact.review_status
        assert "govuk" in fact.review_status.lower()
        assert "2025-26" in fact.tax_years or "2026-27" in fact.tax_years


def test_vat_threshold_fact_is_90000_not_85000():
    facts = {f.id: f for f in load_facts()}
    vat = facts["vat-threshold-overview"]
    assert "£90,000" in vat.summary
    assert "outdated" in vat.summary.lower()
    assert "£85,000" in vat.summary  # mentioned only as outdated
    # Authoritative current figure appears before the outdated warning
    assert vat.summary.index("£90,000") < vat.summary.index("£85,000")


KNOWLEDGE_CASES = [
    pytest.param(
        "MTD £50000 qualifying income threshold 6 April 2026",
        "2025-26",
        "mtd-threshold-50k-april-2026",
        ("50000", "april 2026"),
        id="mtd-50k-2026",
    ),
    pytest.param(
        "Making Tax Digital £30000 threshold from 6 April 2027",
        "2026-27",
        "mtd-threshold-30k-april-2027",
        ("30000", "april 2027"),
        id="mtd-30k-2027",
    ),
    pytest.param(
        "MTD income tax £20000 threshold April 2028",
        "2027-28",
        "mtd-threshold-20k-april-2028",
        ("20000", "april 2028"),
        id="mtd-20k-2028",
    ),
    pytest.param(
        "When do I need to register for VAT taxable turnover threshold",
        "2025-26",
        "vat-threshold-overview",
        ("90000", "vat"),
        id="vat-90000",
    ),
    pytest.param(
        "qualifying income turnover gross not profit expenses MTD",
        "2025-26",
        "mtd-qualifying-income-definition",
        ("turnover", "profit"),
        id="mtd-qualifying-vs-profit",
    ),
    pytest.param(
        "MTD digital records quarterly updates compatible software",
        "2026-27",
        "mtd-digital-records-quarterly",
        ("quarterly", "digital records"),
        id="mtd-quarterly-records",
    ),
    pytest.param(
        "When is the Self Assessment online filing deadline?",
        "2025-26",
        "sa-deadline-online",
        ("31 january", "online"),
        id="sa-online-deadline",
    ),
    pytest.param(
        "Self Assessment paper return deadline 31 October",
        "2025-26",
        "sa-paper-deadline",
        ("31 october", "paper"),
        id="sa-paper-deadline",
    ),
    pytest.param(
        "Self Assessment penalties late filing payment",
        "2025-26",
        "sa-penalties-overview",
        ("penalt",),
        id="sa-penalties",
    ),
    pytest.param(
        "CIS construction industry scheme subcontractor deduction",
        "2025-26",
        "cis-overview",
        ("cis", "subcontract"),
        id="cis-subcontractor",
    ),
    pytest.param(
        "landlord UK property rental income Self Assessment",
        "2025-26",
        "property-income-overview",
        ("property", "rent"),
        id="landlord-property",
    ),
    pytest.param(
        "Rent a Room allowance £7500 property",
        "2025-26",
        "rent-a-room",
        ("rent a room",),
        id="landlord-rent-a-room",
    ),
    pytest.param(
        "cryptoassets tax Self Assessment disposal gains",
        "2025-26",
        "cryptoassets-tax",
        ("crypto",),
        id="crypto-tax",
    ),
    pytest.param(
        "payments on account 31 July Self Assessment",
        "2025-26",
        "payment-on-account",
        ("31 july", "payments on account"),
        id="sa-payment-on-account",
    ),
    pytest.param(
        "register for Self Assessment UTR sole trader",
        "2025-26",
        "register-self-assessment",
        ("register", "self assessment"),
        id="sa-register",
    ),
    pytest.param(
        "personal allowance 2025-26 income tax",
        "2025-26",
        "personal-allowance-2025-26",
        ("personal allowance",),
        id="allowance-2025-26",
    ),
    pytest.param(
        "Making Tax Digital income tax overview sole trader landlord",
        "2025-26",
        "mtd-income-tax-overview",
        ("making tax digital",),
        id="mtd-overview",
    ),
    pytest.param(
        "trading allowance £1000 self employment",
        "2025-26",
        "trading-allowance",
        ("trading allowance",),
        id="trading-allowance",
    ),
    pytest.param(
        "property allowance £1000 landlord",
        "2025-26",
        "property-allowance",
        ("property allowance",),
        id="property-allowance",
    ),
]


@pytest.mark.parametrize("query,tax_year,expected_id,content_bits", KNOWLEDGE_CASES)
def test_retrieval_returns_expected_fact(query, tax_year, expected_id, content_bits):
    ranked = retrieve(query, tax_year, limit=5)
    assert ranked, f"No matches for: {query!r}"
    ids = [r.fact.id for r in ranked]
    assert expected_id in ids
    top = next(r for r in ranked if r.fact.id == expected_id)
    assert top.fact.source_url.startswith("https://www.gov.uk")
    summary = top.fact.summary.lower()
    for bit in content_bits:
        assert bit.lower() in summary or any(bit.lower() in k.lower() for k in top.fact.keywords)


@pytest.mark.parametrize(
    "tax_year",
    ["2025-26", "2026-27", "2027-28"],
    ids=["ty-2526", "ty-2627", "ty-2728"],
)
def test_mtd_threshold_fact_year_applicability(tax_year):
    ranked = retrieve("Making Tax Digital threshold qualifying income", tax_year, limit=3)
    mtd_hits = [r for r in ranked if r.fact.id == "mtd-who-and-when"]
    assert mtd_hits
    assert mtd_hits[0].year_match is True


@pytest.mark.parametrize(
    "phrase,year,expected_id",
    [
        ("£50,000", "2025-26", "mtd-threshold-50k-april-2026"),
        ("£30,000", "2026-27", "mtd-threshold-30k-april-2027"),
        ("£20,000", "2027-28", "mtd-threshold-20k-april-2028"),
    ],
)
def test_mtd_threshold_phrases_in_top_fact(phrase, year, expected_id):
    ranked = retrieve(f"MTD threshold {phrase}", year)
    top = ranked[0]
    assert top.fact.id == expected_id
    assert phrase.replace(",", "") in top.fact.summary.replace(",", "")
