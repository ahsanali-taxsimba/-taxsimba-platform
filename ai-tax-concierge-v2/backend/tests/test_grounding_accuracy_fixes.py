"""Regression tests for live OpenAI accuracy failures (MTD £30k date + VAT £90k)."""

from __future__ import annotations

import pytest

from app.ai.conversational_engine import ConversationalEngine
from app.ai.prompts import build_system_prompt
from app.adapters.llm_mock import MockLLMAdapter
from app.knowledge.grounding import (
    MAX_FACT_EXCERPT_CHARS,
    apply_grounding_guard,
    fact_excerpt,
)
from app.knowledge.loader import reload_facts
from app.knowledge.retrieval import retrieve
from app.knowledge.verification import verify_ranked
from app.models.schemas import ChatRequest, SourceReference


@pytest.fixture(autouse=True)
def _fresh_facts():
    reload_facts()
    yield
    reload_facts()


def test_excerpt_preserves_mtd_30k_april_2027_dates():
    ranked = retrieve(
        "What MTD Income Tax start date applies if qualifying income is over £30,000 in 2025-26?",
        "2026-27",
        limit=3,
    )
    sources = verify_ranked(ranked)
    joined = " ".join((s.excerpt or "") for s in sources)
    assert "30,000" in joined or "£30,000" in joined
    assert "2027" in joined
    assert any(s.id == "mtd-threshold-30k-april-2027" for s in sources)
    # Critical: old 280-char clip must not still be in force
    assert MAX_FACT_EXCERPT_CHARS >= 800
    assert len(fact_excerpt(ranked[0].fact.summary)) > 280


def test_prompt_includes_full_mtd_30k_guidance():
    ranked = retrieve(
        "qualifying income over £30,000 in 2025-26 MTD start date",
        "2026-27",
        limit=3,
    )
    sources = verify_ranked(ranked)
    prompt = build_system_prompt("2026-27", sources, llm_mode="openai")
    assert "6 April 2027" in prompt or "april 2027" in prompt.lower()
    assert "£30,000" in prompt or "30,000" in prompt
    assert "NOT April 2026" in prompt or "not April 2026" in prompt.lower() or "6 April 2027" in prompt
    assert "£90,000" in prompt or "GROUNDING RULES" in prompt


def test_vat_retrieval_and_prompt_use_90000():
    ranked = retrieve("When do I need to register for VAT?", "2025-26", limit=5)
    assert any(r.fact.id == "vat-threshold-overview" for r in ranked)
    sources = verify_ranked(ranked)
    vat = next(s for s in sources if s.id == "vat-threshold-overview")
    assert "90,000" in (vat.excerpt or "") or "£90,000" in (vat.excerpt or "")
    prompt = build_system_prompt("2025-26", sources, llm_mode="openai")
    assert "90,000" in prompt
    assert "do not use a remembered £85,000" in prompt.lower() or "not £85,000" in prompt.lower()


def test_grounding_guard_fixes_stale_vat_85000():
    sources = [
        SourceReference(
            id="vat-threshold-overview",
            title="VAT registration threshold",
            publisher="GOV.UK / HMRC",
            url="https://www.gov.uk/vat-registration-thresholds",
            tax_years=["2025-26"],
            verified=True,
            excerpt="Businesses must register for VAT if turnover is more than £90,000.",
        )
    ]
    reply = "The VAT registration threshold is £85,000 for 2025-26."
    fixed, flags = apply_grounding_guard(reply, "When do I need to register for VAT?", sources)
    assert "85,000" not in fixed.replace(" ", "")
    assert "90,000" in fixed
    assert any("vat" in f for f in flags)


def test_grounding_guard_fixes_mtd_30k_wrong_april_2026():
    sources = [
        SourceReference(
            id="mtd-threshold-30k-april-2027",
            title="MTD Income Tax £30,000 threshold starts 6 April 2027",
            publisher="GOV.UK / HMRC",
            url="https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
            tax_years=["2025-26", "2026-27"],
            verified=True,
            excerpt=(
                "If your qualifying income is more than £30,000 for the 2025-26 tax year, "
                "you need to use Making Tax Digital for Income Tax from 6 April 2027. "
                "This is not April 2026."
            ),
        )
    ]
    reply = (
        "If your qualifying income is over £30,000 in 2025-26, you start MTD from April 2026."
    )
    fixed, flags = apply_grounding_guard(
        reply,
        "What MTD start date applies if qualifying income is over £30,000 in 2025-26?",
        sources,
    )
    assert "2027" in fixed
    assert any("mtd_30k" in f for f in flags)
    # Must not leave an uncorrected sole April-2026 start for the £30k question
    assert "6 April 2027" in fixed or "april 2027" in fixed.lower()


def test_grounding_guard_does_not_rewrite_legitimate_50k_april_2026():
    sources = [
        SourceReference(
            id="mtd-threshold-50k-april-2026",
            title="MTD Income Tax £50,000 threshold starts 6 April 2026",
            publisher="GOV.UK / HMRC",
            url="https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
            tax_years=["2026-27"],
            verified=True,
            excerpt="More than £50,000 for 2024-25 means from 6 April 2026.",
        )
    ]
    reply = "With qualifying income over £50,000 in 2024-25 you start from 6 April 2026."
    fixed, flags = apply_grounding_guard(
        reply,
        "If my qualifying income was over £50,000 in 2024-25, when do I start MTD?",
        sources,
    )
    assert fixed == reply
    assert flags == []


@pytest.mark.asyncio
async def test_engine_answers_mtd_30k_with_april_2027():
    engine = ConversationalEngine(llm=MockLLMAdapter())
    resp = await engine.handle(
        ChatRequest(
            session_id="reg-mtd-30k",
            message=(
                "What MTD Income Tax start date applies if qualifying income "
                "is over £30,000 in 2025-26?"
            ),
            tax_year="2026-27",
        )
    )
    reply = resp.reply.lower().replace(",", "")
    assert "2027" in reply
    assert any(s.id == "mtd-threshold-30k-april-2027" for s in resp.sources)
    # Mock grounded reply should surface the verified fact text
    assert "30000" in reply or "30,000" in resp.reply


@pytest.mark.asyncio
async def test_engine_answers_vat_with_90000_not_85000():
    engine = ConversationalEngine(llm=MockLLMAdapter())
    resp = await engine.handle(
        ChatRequest(
            session_id="reg-vat-90k",
            message="When do I need to register for VAT?",
            tax_year="2025-26",
        )
    )
    compact = resp.reply.replace(",", "").replace(" ", "").lower()
    assert "90000" in compact or "£90000" in resp.reply.replace(",", "").replace(" ", "")
    assert "85000" not in compact
    assert any(s.id == "vat-threshold-overview" for s in resp.sources)


@pytest.mark.asyncio
async def test_related_mtd_bands_remain_distinct():
    engine = ConversationalEngine(llm=MockLLMAdapter())
    fifty = await engine.handle(
        ChatRequest(
            session_id="reg-mtd-50k",
            message=(
                "If my qualifying income was over £50,000 in 2024-25, "
                "when do I need to start MTD for Income Tax?"
            ),
            tax_year="2026-27",
        )
    )
    twenty = await engine.handle(
        ChatRequest(
            session_id="reg-mtd-20k",
            message="What about the £20,000 MTD threshold and April 2028?",
            tax_year="2027-28",
        )
    )
    assert "2026" in fifty.reply
    assert "2028" in twenty.reply
    assert any("50k" in s.id or "50000" in (s.excerpt or "") for s in fifty.sources) or any(
        "50,000" in (s.excerpt or "") for s in fifty.sources
    )
