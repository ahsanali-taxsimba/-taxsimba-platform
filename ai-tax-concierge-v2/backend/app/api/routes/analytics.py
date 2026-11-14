"""Privacy-conscious analytics summary (ops only — no PII)."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter(tags=["analytics"])


class TrackBody(BaseModel):
    session_id: str
    event: str = Field(..., pattern=r"^[a-z0-9_]+$")
    meta: dict = Field(default_factory=dict)


@router.get("/analytics/summary")
async def analytics_summary(request: Request) -> dict:
    return request.app.state.analytics.summary()


@router.post("/analytics/track")
async def analytics_track(body: TrackBody, request: Request) -> dict:
    # Only allow click-style events from the widget; conversions must be verified server-side later
    allowed = {
        "launcher_open",
        "conversation_started",
        "panel_view",
        "topic_click",
        "journey_start",
        "package_click",
        "calculator_click",
        "consultation_click",
        "route_click",
        "registration_click",
        "satisfaction_yes",
        "satisfaction_no",
    }
    if body.event not in allowed:
        return {"accepted": False, "reason": "event_not_allowed"}
    # Never store raw free text from meta
    safe_meta = {
        k: v
        for k, v in body.meta.items()
        if k in {"code", "id", "path", "label", "panel", "journey"}
    }
    request.app.state.analytics.record(body.event, body.session_id, safe_meta)
    return {
        "accepted": True,
        "note": "Engagement event recorded — not a verified registration, purchase or booking",
    }
