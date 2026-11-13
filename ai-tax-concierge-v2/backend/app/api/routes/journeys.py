"""Guided journey endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from uuid import uuid4

from app.ai.conversational_engine import ConversationalEngine
from app.core.errors import ValidationConciergeError
from app.journeys.engine import list_journeys
from app.models.schemas import ChatResponse, JourneyState
from app.security.ratelimit import chat_limiter

router = APIRouter(tags=["journeys"])


class StartBody(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    journey_id: str


class AdvanceBody(BaseModel):
    session_id: str
    option_id: str
    journey_state: JourneyState


@router.get("/journeys")
async def get_journeys() -> dict:
    return {"journeys": list_journeys()}


@router.post("/journeys/start", response_model=ChatResponse)
async def journeys_start(body: StartBody, request: Request) -> ChatResponse:
    chat_limiter.check(f"journey:{body.session_id}")
    engine: ConversationalEngine = request.app.state.engine
    return engine.start_guided(body.journey_id, body.session_id)


@router.post("/journeys/advance", response_model=ChatResponse)
async def journeys_advance(body: AdvanceBody, request: Request) -> ChatResponse:
    chat_limiter.check(f"journey:{body.session_id}")
    engine: ConversationalEngine = request.app.state.engine
    try:
        # Reuse chat handler path for completion messaging
        from app.models.schemas import ChatRequest

        label = body.option_id
        if body.journey_state.current:
            for opt in body.journey_state.current.options:
                if opt["id"] == body.option_id:
                    label = opt["label"]
                    break
        return await engine.handle(
            ChatRequest(
                session_id=body.session_id,
                message=label,
                journey_option_id=body.option_id,
                journey_state=body.journey_state,
            )
        )
    except ValidationConciergeError:
        raise
    except ValueError as exc:
        raise ValidationConciergeError(str(exc)) from exc
