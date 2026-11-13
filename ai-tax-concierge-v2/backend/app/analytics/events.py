"""In-memory analytics recorder (Phase 1). Swap for durable sink later."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, List


@dataclass
class AnalyticsEvent:
    event: str
    session_id: str
    payload: Dict[str, Any]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AnalyticsRecorder:
    def __init__(self) -> None:
        self._events: List[AnalyticsEvent] = []
        self._lock = Lock()

    def record(self, event: str, session_id: str, payload: Dict[str, Any]) -> None:
        with self._lock:
            self._events.append(
                AnalyticsEvent(event=event, session_id=session_id, payload=payload)
            )

    def all(self) -> List[AnalyticsEvent]:
        with self._lock:
            return list(self._events)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()
