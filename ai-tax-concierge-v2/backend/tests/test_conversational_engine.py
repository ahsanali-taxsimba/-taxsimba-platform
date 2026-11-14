import pytest

from app.adapters.llm_mock import MockLLMAdapter
from app.ai.conversational_engine import ConversationalEngine
from app.analytics.events import AnalyticsRecorder
from app.models.schemas import ChatRequest


@pytest.mark.asyncio
async def test_engine_grounded_reply_includes_sources():
    analytics = AnalyticsRecorder()
    engine = ConversationalEngine(llm=MockLLMAdapter(), analytics=analytics)
    response = await engine.handle(
        ChatRequest(
            session_id="sess-1",
            message="When is the Self Assessment online filing deadline?",
            tax_year="2025-26",
        )
    )
    assert response.llm_mode == "mock"
    assert response.tax_year == "2025-26"
    assert response.sources
    assert all(s.verified for s in response.sources)
    assert "HMRC" in response.reply or "GOV.UK" in response.reply or "verified" in response.reply.lower()
    assert response.disclaimer
    events = analytics.all()
    assert len(events) == 1
    assert events[0].payload["source_ids"]


@pytest.mark.asyncio
async def test_engine_low_confidence_offers_consultation():
    engine = ConversationalEngine(llm=MockLLMAdapter())
    response = await engine.handle(
        ChatRequest(
            session_id="sess-2",
            message="What is the capital gains tax rate on my yacht in outer space?",
            tax_year="2025-26",
        )
    )
    # Obscure query may still match CGT loosely; force check on consultation for accountant ask
    response2 = await engine.handle(
        ChatRequest(
            session_id="sess-3",
            message="I want to speak to an accountant about my tax",
            tax_year="2025-26",
        )
    )
    assert response2.consultation_hint is not None
    assert "£99" in response2.consultation_hint


@pytest.mark.asyncio
async def test_analytics_redacts_pii():
    analytics = AnalyticsRecorder()
    engine = ConversationalEngine(llm=MockLLMAdapter(), analytics=analytics)
    await engine.handle(
        ChatRequest(
            session_id="sess-pii",
            message="My email is secret@example.com and UTR 1234567890 — SA deadline?",
            tax_year="2025-26",
        )
    )
    payload = analytics.all()[0].payload
    assert "secret@example.com" not in payload["message_redacted"]
    assert "1234567890" not in payload["message_redacted"]
    assert payload["pii_flags"]["email"] is True
