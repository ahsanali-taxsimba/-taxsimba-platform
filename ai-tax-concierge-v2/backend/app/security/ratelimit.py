"""Simple in-memory rate limiter for chat endpoints (Phase 2 hardening)."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict

from app.core.errors import ConciergeError


class RateLimiter:
    def __init__(self, max_calls: int = 30, window_seconds: float = 60.0) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.max_calls:
                raise ConciergeError(
                    "Too many requests. Please wait a moment and try again.",
                    code="rate_limited",
                    status_code=429,
                )
            q.append(now)


chat_limiter = RateLimiter(max_calls=40, window_seconds=60.0)
