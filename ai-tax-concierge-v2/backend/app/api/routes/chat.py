"""Chat API — conversational tax guidance."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.ai.conversational_engine import ConversationalEngine
from app.models.schemas import ChatRequest, ChatResponse
from app.security.ratelimit import chat_limiter

router = APIRouter(tags=["chat"])


def _client_key(request: Request, session_id: str) -> str:
    peer = request.client.host if request.client else "unknown"
    return f"{peer}:{session_id}"


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    chat_limiter.check(_client_key(request, payload.session_id))
    engine: ConversationalEngine = request.app.state.engine
    return await engine.handle(payload)
