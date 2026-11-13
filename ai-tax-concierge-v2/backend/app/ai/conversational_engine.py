"""Conversational engine — retrieval-grounded chat + journeys + recommendations."""

from __future__ import annotations

import logging
from typing import List, Optional

from app.adapters.base import LLMAdapter
from app.ai.prompts import DISCLAIMER, build_system_prompt, mock_package_reply
from app.ai.recommendations import answer_inclusions_question, recommend_for_message
from app.analytics.events import AnalyticsRecorder
from app.catalog.service import all_packages_flat
from app.core.config import Settings, get_settings
from app.core.errors import ValidationConciergeError
from app.core.privacy import privacy_flags, redact_pii
from app.journeys.engine import (
    advance_journey,
    get_journey,
    journey_context_blurb,
    start_journey,
)
from app.knowledge.retrieval import retrieve
from app.knowledge.tax_year import resolve_tax_year
from app.knowledge.verification import confidence_from_sources, verify_ranked
from app.models.schemas import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    JourneyState,
    SourceReference,
)

logger = logging.getLogger(__name__)

CONSULTATION_HINT = (
    "Need personalised help? TaxSimba offers a £99 accountant consultation. "
    "Live booking is not connected yet in this phase."
)


class ConversationalEngine:
    def __init__(
        self,
        llm: LLMAdapter,
        analytics: Optional[AnalyticsRecorder] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self._llm = llm
        self._analytics = analytics or AnalyticsRecorder()
        self._settings = settings or get_settings()

    async def handle(self, request: ChatRequest) -> ChatResponse:
        tax_year = resolve_tax_year(request.tax_year)
        journey_state = self._resolve_journey(request)

        # Journey step in progress: ask one question, no LLM required
        if journey_state and not journey_state.complete and journey_state.current:
            reply = journey_state.current.prompt or "Please choose an option to continue."
            packages, calculators, follow_ups = recommend_for_message(
                request.message,
                journey=journey_state,
                website_base=self._settings.website_base_url,
            )
            self._record(request, tax_year, "journey_step", [], "high")
            return ChatResponse(
                session_id=request.session_id,
                reply=reply,
                tax_year=tax_year,
                sources=[],
                confidence="high",
                disclaimer=DISCLAIMER,
                consultation_hint=None,
                follow_ups=follow_ups,
                packages=packages,
                calculators=calculators,
                journey=journey_state,
                llm_mode=self._llm.mode,  # type: ignore[arg-type]
            )

        inclusions = answer_inclusions_question(request.message)
        catalog_fast = mock_package_reply(request.message)

        ranked = retrieve(request.message, tax_year)
        # Boost retrieval with journey tags
        if journey_state and journey_state.tags:
            tag_query = " ".join(journey_state.tags) + " " + request.message
            ranked = retrieve(tag_query, tax_year) or ranked

        sources: List[SourceReference] = verify_ranked(ranked)
        year_matches = sum(
            1 for r in ranked if r.year_match and r.fact.id in {s.id for s in sources}
        )
        confidence = confidence_from_sources(sources, year_matches)

        if inclusions:
            reply = inclusions
        elif catalog_fast and self._llm.mode == "mock":
            reply = catalog_fast
            if journey_state and journey_state.complete and journey_state.summary:
                reply = f"{journey_state.summary}\n\n{reply}"
        else:
            system_prompt = build_system_prompt(
                tax_year,
                sources,
                journey_blurb=journey_context_blurb(journey_state),
                llm_mode=self._llm.mode,
            )
            if journey_state and journey_state.complete and journey_state.summary:
                user_message = (
                    f"{request.message}\n\n[Journey summary for context: {journey_state.summary}]"
                )
            else:
                user_message = request.message
            reply = await self._llm.complete(
                system_prompt=system_prompt,
                messages=list(request.history),
                user_message=user_message,
            )

        packages, calculators, follow_ups = recommend_for_message(
            request.message,
            journey=journey_state,
            website_base=self._settings.website_base_url,
        )

        consultation_hint = None
        if (
            confidence == "low"
            or "consult" in request.message.lower()
            or "accountant" in request.message.lower()
            or (journey_state and "consult" in journey_state.tags)
        ):
            consultation_hint = CONSULTATION_HINT
            # Ensure consultation package card surfaces when relevant
            if not any(p.code == "ACCOUNTANT_CONSULT_99" for p in packages):
                flat = all_packages_flat().get("ACCOUNTANT_CONSULT_99")
                if flat and (confidence == "low" or "consult" in request.message.lower()):
                    from app.ai.recommendations import to_package_cards

                    packages = packages + to_package_cards(["ACCOUNTANT_CONSULT_99"])

        self._record(request, tax_year, "chat_turn", [s.id for s in sources], confidence)

        return ChatResponse(
            session_id=request.session_id,
            reply=reply,
            tax_year=tax_year,
            sources=sources,
            confidence=confidence,  # type: ignore[arg-type]
            disclaimer=DISCLAIMER,
            consultation_hint=consultation_hint,
            follow_ups=follow_ups,
            packages=packages,
            calculators=calculators,
            journey=journey_state,
            llm_mode=self._llm.mode,  # type: ignore[arg-type]
        )

    def start_guided(self, journey_id: str, session_id: str) -> ChatResponse:
        if not get_journey(journey_id):
            raise ValidationConciergeError(f"Unknown journey: {journey_id}")
        state = start_journey(journey_id)
        tax_year = resolve_tax_year(None)
        prompt = state.current.prompt if state.current else "Let's begin."
        return ChatResponse(
            session_id=session_id,
            reply=f"Let's walk through {state.journey_title} together. {prompt}",
            tax_year=tax_year,
            sources=[],
            confidence="high",
            disclaimer=DISCLAIMER,
            follow_ups=[],
            packages=[],
            calculators=[],
            journey=state,
            llm_mode=self._llm.mode,  # type: ignore[arg-type]
        )

    def _resolve_journey(self, request: ChatRequest) -> Optional[JourneyState]:
        if request.journey_option_id and request.journey_state:
            try:
                return advance_journey(request.journey_state, request.journey_option_id)
            except ValueError as exc:
                raise ValidationConciergeError(str(exc)) from exc
        if request.journey_id and not request.journey_state:
            if not get_journey(request.journey_id):
                raise ValidationConciergeError(f"Unknown journey: {request.journey_id}")
            return start_journey(request.journey_id)
        return request.journey_state

    def _record(
        self,
        request: ChatRequest,
        tax_year: str,
        event: str,
        source_ids: List[str],
        confidence: str,
    ) -> None:
        self._analytics.record(
            event=event,
            session_id=request.session_id,
            payload={
                "tax_year": tax_year,
                "confidence": confidence,
                "source_ids": source_ids,
                "message_redacted": redact_pii(request.message),
                "pii_flags": privacy_flags(request.message),
                "llm_mode": self._llm.mode,
                "journey_id": request.journey_id or (
                    request.journey_state.journey_id if request.journey_state else None
                ),
            },
        )
