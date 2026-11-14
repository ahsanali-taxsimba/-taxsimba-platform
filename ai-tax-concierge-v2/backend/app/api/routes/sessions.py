"""Session privacy controls."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.sessions.store import session_store

router = APIRouter(tags=["sessions"])


class DeleteBody(BaseModel):
    session_id: str


@router.post("/sessions/delete")
async def delete_session(body: DeleteBody, request: Request) -> dict:
    ok = session_store.delete(body.session_id)
    analytics = request.app.state.analytics
    analytics.record(
        event="session_deleted",
        session_id=body.session_id,
        payload={"deleted": ok},
    )
    return {"deleted": ok, "session_id": body.session_id}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict:
    rec = session_store.get(session_id)
    if not rec:
        return {"found": False, "session_id": session_id}
    return {
        "found": True,
        "session_id": rec.session_id,
        "turn_count": len(rec.history),
        "has_journey": rec.journey_state is not None,
        "updated_at": rec.updated_at.isoformat(),
    }
