"""Health and public config endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app import __version__
from app.core.config import Settings
from app.knowledge.tax_year import tax_year_label
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    mode = "mock" if settings.use_mock_llm else "openai"
    return HealthResponse(
        version=__version__,
        phase=3,
        product="SIMBA AI",
        llm_mode=mode,
        current_tax_year=tax_year_label(),
        mock_notice="MOCK MODE — not live OpenAI." if mode == "mock" else None,
    )


@router.get("/config")
async def public_config(request: Request) -> dict:
    settings: Settings = request.app.state.settings
    return settings.safe_public_config()
