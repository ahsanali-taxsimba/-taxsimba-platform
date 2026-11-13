"""Helpful-first behaviour: help even when the visitor declines to buy."""

from __future__ import annotations

import pytest

from app.ai.conversational_engine import ConversationalEngine
from app.ai.recommendations import recommend_for_message, visitor_declines_sales
from app.adapters.llm_mock import MockLLMAdapter
from app.models.schemas import ChatRequest


def test_visitor_declines_sales_detector():
    assert visitor_declines_sales("I don't want to buy anything, just explain MTD")
    assert visitor_declines_sales("Just information only please")
    assert not visitor_declines_sales("What do Self Assessment packages cost?")


def test_recommendations_suppress_packages_when_declining_sales():
    packages, calculators, follow_ups = recommend_for_message(
        "I do not want to buy a package — just tell me the SA online deadline",
        journey=None,
        website_base="https://www.taxsimba.co.uk",
    )
    assert packages == []
    assert any("deadline" in f.lower() or "gov.uk" in f.lower() for f in follow_ups)


@pytest.mark.asyncio
async def test_engine_helps_without_selling_when_declined():
    engine = ConversationalEngine(llm=MockLLMAdapter())
    resp = await engine.handle(
        ChatRequest(
            session_id="no-buy-1",
            message=(
                "I don't want to buy anything. Just explain who needs Self Assessment "
                "if I'm employed under PAYE with freelance side income."
            ),
            tax_year="2025-26",
        )
    )
    assert resp.packages == []
    assert resp.consultation_hint is None
    assert resp.reply
    assert "self assessment" in resp.reply.lower() or "paye" in resp.reply.lower() or "hmrc" in resp.reply.lower()


def test_live_verified_calculators_have_urls():
    _, calculators, _ = recommend_for_message(
        "income tax calculator for freelancers",
        journey=None,
        website_base="https://www.taxsimba.co.uk",
    )
    assert calculators
    assert all(c.url_status == "live_verified" for c in calculators)
    assert all(c.url and c.url.startswith("https://www.taxsimba.co.uk/calculators/") for c in calculators)
