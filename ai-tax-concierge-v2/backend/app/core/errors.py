"""Structured application errors."""

from __future__ import annotations

from typing import Any, Optional


class ConciergeError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "concierge_error",
        status_code: int = 500,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class ValidationConciergeError(ConciergeError):
    def __init__(self, message: str, **kwargs: Any) -> None:
        super().__init__(message, code="validation_error", status_code=400, **kwargs)


class LLMUnavailableError(ConciergeError):
    def __init__(self, message: str = "AI service temporarily unavailable") -> None:
        super().__init__(message, code="llm_unavailable", status_code=503)
