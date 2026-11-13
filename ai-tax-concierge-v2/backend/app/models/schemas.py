"""API and domain schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
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


class JourneyStepView(BaseModel):
    step_id: str
    prompt: Optional[str] = None
    options: List[Dict[str, str]] = Field(default_factory=list)


class JourneyState(BaseModel):
    journey_id: str
    journey_title: str
    step_id: str
    complete: bool = False
    answers: Dict[str, str] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    current: Optional[JourneyStepView] = None
    summary: Optional[str] = None
    suggested_package_codes: List[str] = Field(default_factory=list)
    suggested_calculator_ids: List[str] = Field(default_factory=list)
    follow_ups: List[str] = Field(default_factory=list)


class PackageCard(BaseModel):
    code: str
    name: str
    price_gbp: float
    billing: str
    vat_note: str
    family: str
    inclusions_status: str = "not_specified_in_catalog"
    pressure_free_note: str = (
        "Optional support — only if useful. Full inclusions are confirmed with TaxSimba, "
        "not invented by this assistant."
    )


class CalculatorCard(BaseModel):
    id: str
    title: str
    description: str
    url_status: str
    url: Optional[str] = None
    note: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    message: str = Field(..., min_length=1, max_length=4000)
    tax_year: Optional[str] = Field(
        default=None,
        description="UK tax year label e.g. 2025-26. Defaults to current.",
    )
    history: List[ChatMessage] = Field(default_factory=list, max_length=20)
    journey_id: Optional[str] = None
    journey_option_id: Optional[str] = None
    journey_state: Optional[JourneyState] = None

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


class RouteCard(BaseModel):
    id: str
    label: str
    path: str
    status: str
    url: Optional[str] = None
    note: Optional[str] = None
    kind: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    tax_year: str
    sources: List[SourceReference]
    confidence: Literal["high", "medium", "low"]
    disclaimer: str
    assistant_name: str = "SIMBA AI"
    is_ai_disclosure: str = (
        "I am SIMBA AI — an AI assistant, not a qualified human accountant or HMRC representative."
    )
    consultation_hint: Optional[str] = None
    follow_ups: List[str] = Field(default_factory=list)
    packages: List[PackageCard] = Field(default_factory=list)
    calculators: List[CalculatorCard] = Field(default_factory=list)
    routes: List[RouteCard] = Field(default_factory=list)
    journey: Optional[JourneyState] = None
    llm_mode: Literal["openai", "mock"]
    mock_notice: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class JourneyStartRequest(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    journey_id: str


class JourneyAdvanceRequest(BaseModel):
    session_id: str
    option_id: str
    journey_state: JourneyState


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    phase: int = 3
    product: str = "SIMBA AI"
    llm_mode: Literal["openai", "mock"]
    current_tax_year: str
    mock_notice: Optional[str] = None


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
    effective_date: Optional[str] = None
    knowledge_version: Optional[str] = None
    review_status: Optional[str] = None


class ErrorBody(BaseModel):
    error: Dict[str, Any]
