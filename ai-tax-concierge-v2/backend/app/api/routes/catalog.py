"""Public catalogue / bootstrap for the embeddable SIMBA widget."""

from __future__ import annotations

from fastapi import APIRouter, Request
from uuid import uuid4

from app.ai.conversational_engine import ConversationalEngine
from app.ai.prompts import WELCOME_MESSAGE
from app.catalog.service import public_catalog_payload, starters_catalog
from app.core.config import Settings
from app.journeys.engine import list_journeys
from app.knowledge.tax_year import tax_year_label
from app.routes_registry.service import calculator_count, list_routes

router = APIRouter(tags=["catalog"])


@router.get("/bootstrap")
async def bootstrap(request: Request) -> dict:
    settings: Settings = request.app.state.settings
    catalog = public_catalog_payload(settings.website_base_url)
    llm_mode = "mock" if settings.use_mock_llm else "openai"
    return {
        "product": "SIMBA AI",
        "subtitle": "Your UK Tax Assistant",
        "phase": 3,
        "assistant_name": "SIMBA AI",
        "welcome_message": WELCOME_MESSAGE,
        "ai_disclosure": (
            "SIMBA is an AI assistant from TaxSimba — not a qualified human accountant, "
            "not an HMRC representative, and not government-approved AI."
        ),
        "llm_mode": llm_mode,
        "mock_notice": "MOCK MODE — not live OpenAI." if llm_mode == "mock" else None,
        "current_tax_year": tax_year_label(),
        "disclaimer": (
            "General UK tax information only — not personalised advice. "
            "Sources are verified GOV.UK / HMRC links when available."
        ),
        "starters": catalog["starters"],
        "journeys": list_journeys(),
        "packages": catalog["packages"],
        "calculators": catalog["calculators"],
        "routes": list_routes(),
        "calculator_registry_count": calculator_count(),
        "consultation": {
            **catalog["packages"]["consultation"],
            "duration_minutes": catalog["packages"]["consultation"].get("duration_minutes", 30),
            "meeting": catalog["packages"]["consultation"].get("meeting", "Google Meet"),
        },
        "brand": {
            "primary": "#006B3C",
            "primary_action": "#078A4B",
            "background_soft": "#F1F8F4",
            "border": "#E3E7E4",
            "text": "#161B18",
            "fonts": {"heading": "Manrope", "body": "Public Sans"},
            "logo": "/widget/assets/taxsimba-logo.svg",
            "logo_status": "official_taxsimba_co_uk_asset",
            "source": "design_guidelines.json + taxsimba.co.uk/images/logo.svg",
        },
        "integrations": {
            "openai": llm_mode,
            "payment": "mock_unavailable",
            "calendly": "stub",
            "website_nav": "partial_live_verified",
            "client_portal": "mock_unavailable",
            "analytics": "in_memory",
        },
        "embed": {
            "script_path": "/widget/embed.js",
            "iframe_path": "/widget/index.html",
        },
    }


@router.get("/welcome")
async def welcome(request: Request, session_id: str | None = None) -> dict:
    engine: ConversationalEngine = request.app.state.engine
    sid = session_id or str(uuid4())
    resp = engine.welcome(sid)
    return resp.model_dump()


@router.get("/catalog/packages")
async def packages(request: Request) -> dict:
    settings: Settings = request.app.state.settings
    return public_catalog_payload(settings.website_base_url)["packages"]


@router.get("/catalog/starters")
async def starters() -> dict:
    return starters_catalog()


@router.get("/catalog/routes")
async def routes() -> dict:
    return list_routes()
