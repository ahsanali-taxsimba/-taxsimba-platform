"""In-memory session store with isolation and deletion (swap for Redis later)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List, Optional
from uuid import uuid4


@dataclass
class SessionRecord:
    session_id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    history: List[Dict[str, str]] = field(default_factory=list)
    journey_state: Optional[dict] = None
    meta: Dict[str, Any] = field(default_factory=dict)
    deleted: bool = False


class SessionStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._sessions: Dict[str, SessionRecord] = {}

    def get_or_create(self, session_id: Optional[str] = None) -> SessionRecord:
        sid = session_id or str(uuid4())
        with self._lock:
            rec = self._sessions.get(sid)
            if rec and not rec.deleted:
                return rec
            rec = SessionRecord(session_id=sid)
            self._sessions[sid] = rec
            return rec

    def get(self, session_id: str) -> Optional[SessionRecord]:
        with self._lock:
            rec = self._sessions.get(session_id)
            if not rec or rec.deleted:
                return None
            return rec

    def append_turn(self, session_id: str, role: str, content: str) -> None:
        with self._lock:
            rec = self._sessions.get(session_id)
            if not rec or rec.deleted:
                return
            rec.history.append({"role": role, "content": content})
            rec.history = rec.history[-40:]
            rec.updated_at = datetime.now(timezone.utc)

    def save_journey(self, session_id: str, journey: Optional[dict]) -> None:
        with self._lock:
            rec = self._sessions.get(session_id)
            if not rec or rec.deleted:
                return
            rec.journey_state = journey
            rec.updated_at = datetime.now(timezone.utc)

    def delete(self, session_id: str) -> bool:
        with self._lock:
            rec = self._sessions.get(session_id)
            if not rec:
                return False
            rec.deleted = True
            rec.history = []
            rec.journey_state = None
            rec.meta = {}
            rec.updated_at = datetime.now(timezone.utc)
            return True

    def active_count(self) -> int:
        with self._lock:
            return sum(1 for s in self._sessions.values() if not s.deleted)


session_store = SessionStore()
