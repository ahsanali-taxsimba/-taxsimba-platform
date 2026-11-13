"""Chat API — conversational tax guidance."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.ai.conversational_engine import ConversationalEngine
from app.models.schemas import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    engine: ConversationalEngine = request.app.state.engine
    return await engine.handle(payload)
