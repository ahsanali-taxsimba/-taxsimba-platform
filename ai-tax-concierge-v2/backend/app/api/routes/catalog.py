"""Public catalogue / bootstrap for the embeddable widget."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.catalog.service import public_catalog_payload, starters_catalog
from app.core.config import Settings
from app.journeys.engine import list_journeys
from app.knowledge.tax_year import tax_year_label

router = APIRouter(tags=["catalog"])


@router.get("/bootstrap")
async def bootstrap(request: Request) -> dict:
    settings: Settings = request.app.state.settings
    catalog = public_catalog_payload(settings.website_base_url)
    return {
        "product": "TaxSimba AI Tax Concierge V2",
        "phase": 2,
        "llm_mode": "mock" if settings.use_mock_llm else "openai",
        "current_tax_year": tax_year_label(),
        "disclaimer": (
            "General UK tax information only — not personalised advice. "
            "Sources are verified GOV.UK / HMRC links when available."
        ),
        "starters": catalog["starters"],
        "journeys": list_journeys(),
        "packages": catalog["packages"],
        "calculators": catalog["calculators"],
        "consultation": catalog["packages"]["consultation"],
        "integrations": {
            "payment": "mock_unavailable",
            "calendly": "stub",
            "website_nav": "stub",
            "client_portal": "mock_unavailable",
        },
        "embed": {
            "script_path": "/widget/embed.js",
            "iframe_path": "/widget/index.html",
        },
    }


@router.get("/catalog/packages")
async def packages(request: Request) -> dict:
    settings: Settings = request.app.state.settings
    return public_catalog_payload(settings.website_base_url)["packages"]


@router.get("/catalog/starters")
async def starters() -> dict:
    return starters_catalog()
