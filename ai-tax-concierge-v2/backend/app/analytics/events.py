"""Privacy-aware analytics recorder with reporting aggregates."""

from __future__ import annotations

from collections import Counter
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

    def summary(self) -> Dict[str, Any]:
        with self._lock:
            events = list(self._events)
        by_type = Counter(e.event for e in events)
        questions = [
            e.payload.get("message_redacted", "")
            for e in events
            if e.event in {"chat_turn", "journey_step"}
        ]
        unanswered = sum(1 for e in events if e.payload.get("confidence") == "low")
        clicks = sum(1 for e in events if e.event.endswith("_click"))
        conversions = sum(1 for e in events if e.event.endswith("_conversion_verified"))
        return {
            "conversation_volume": by_type.get("chat_turn", 0) + by_type.get("journey_step", 0),
            "event_counts": dict(by_type),
            "unanswered_or_low_confidence": unanswered,
            "action_clicks": clicks,
            "verified_conversions": conversions,
            "note": "Clicks are not conversions. Only *_conversion_verified events count as completed.",
            "sample_redacted_questions": [q for q in questions if q][:10],
            "privacy": "Analytics store redacted text only; no raw NI/UTR/email/phone.",
        }
