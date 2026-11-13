"""Initial conversational engine — retrieval-grounded chat."""

from __future__ import annotations

import logging
from typing import List, Optional

from app.adapters.base import LLMAdapter
from app.ai.prompts import DISCLAIMER, build_system_prompt
from app.analytics.events import AnalyticsRecorder
from app.core.privacy import privacy_flags, redact_pii
from app.knowledge.retrieval import retrieve
from app.knowledge.tax_year import resolve_tax_year
from app.knowledge.verification import confidence_from_sources, verify_ranked
from app.models.schemas import ChatMessage, ChatRequest, ChatResponse, SourceReference

logger = logging.getLogger(__name__)

CONSULTATION_HINT = (
    "Need personalised help? TaxSimba offers a £99 accountant consultation "
    "(booking integration arrives in a later phase)."
)


class ConversationalEngine:
    def __init__(
        self,
        llm: LLMAdapter,
        analytics: Optional[AnalyticsRecorder] = None,
    ) -> None:
        self._llm = llm
        self._analytics = analytics or AnalyticsRecorder()

    async def handle(self, request: ChatRequest) -> ChatResponse:
        tax_year = resolve_tax_year(request.tax_year)
        ranked = retrieve(request.message, tax_year)
        sources: List[SourceReference] = verify_ranked(ranked)
        year_matches = sum(1 for r in ranked if r.year_match and r.fact.id in {s.id for s in sources})
        confidence = confidence_from_sources(sources, year_matches)

        system_prompt = build_system_prompt(tax_year, sources)
        history: List[ChatMessage] = list(request.history)

        reply = await self._llm.complete(
            system_prompt=system_prompt,
            messages=history,
            user_message=request.message,
        )

        consultation_hint = None
        if confidence == "low" or "consult" in request.message.lower() or "accountant" in request.message.lower():
            consultation_hint = CONSULTATION_HINT

        # Analytics never stores raw PII
        self._analytics.record(
            event="chat_turn",
            session_id=request.session_id,
            payload={
                "tax_year": tax_year,
                "confidence": confidence,
                "source_ids": [s.id for s in sources],
                "message_redacted": redact_pii(request.message),
                "pii_flags": privacy_flags(request.message),
                "llm_mode": self._llm.mode,
            },
        )

        return ChatResponse(
            session_id=request.session_id,
            reply=reply,
            tax_year=tax_year,
            sources=sources,
            confidence=confidence,  # type: ignore[arg-type]
            disclaimer=DISCLAIMER,
            consultation_hint=consultation_hint,
            llm_mode=self._llm.mode,  # type: ignore[arg-type]
        )
