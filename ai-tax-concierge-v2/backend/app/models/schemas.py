"""API and domain schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class SourceReference(BaseModel):
    id: str
    title: str
    publisher: str
    url: str
    tax_years: List[str]
    verified: bool = True
    excerpt: Optional[str] = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    message: str = Field(..., min_length=1, max_length=4000)
    tax_year: Optional[str] = Field(
        default=None,
        description="UK tax year label e.g. 2025-26. Defaults to current.",
    )
    history: List[ChatMessage] = Field(default_factory=list, max_length=20)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("message must not be blank")
        return cleaned

    @field_validator("tax_year")
    @classmethod
    def validate_tax_year(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        # Accept 2025-26 or 2025/26
        normalised = value.replace("/", "-")
        parts = normalised.split("-")
        if len(parts) != 2 or not parts[0].isdigit() or len(parts[0]) != 4:
            raise ValueError("tax_year must look like 2025-26")
        start = int(parts[0])
        end_token = parts[1]
        if len(end_token) == 2:
            end = int(end_token)
            if end != (start + 1) % 100:
                raise ValueError("tax_year end must be start+1 (e.g. 2025-26)")
            return f"{start}-{end_token.zfill(2)}"
        if len(end_token) == 4 and int(end_token) == start + 1:
            return f"{start}-{str(start + 1)[2:]}"
        raise ValueError("tax_year must look like 2025-26")


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    tax_year: str
    sources: List[SourceReference]
    confidence: Literal["high", "medium", "low"]
    disclaimer: str
    consultation_hint: Optional[str] = None
    llm_mode: Literal["openai", "mock"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    llm_mode: Literal["openai", "mock"]
    current_tax_year: str


class KnowledgeFact(BaseModel):
    id: str
    title: str
    summary: str
    keywords: List[str]
    tax_years: List[str]
    source_url: str
    publisher: str
    category: str
    last_verified: str
