"""Build adapters from settings."""

from __future__ import annotations

from app.adapters.base import LLMAdapter
from app.adapters.llm_mock import MockLLMAdapter
from app.adapters.llm_openai import OpenAIAdapter
from app.adapters.stubs import (
    ConfigCalendlyAdapter,
    ConfigWebsiteNavAdapter,
    MockClientPortalAdapter,
    MockPaymentAdapter,
)
from app.core.config import Settings


def build_llm_adapter(settings: Settings) -> LLMAdapter:
    if settings.use_mock_llm:
        return MockLLMAdapter()
    return OpenAIAdapter(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


def build_stub_adapters(settings: Settings) -> dict:
    return {
        "website": ConfigWebsiteNavAdapter(settings),
        "payment": MockPaymentAdapter(),
        "calendly": ConfigCalendlyAdapter(settings),
        "client_portal": MockClientPortalAdapter(),
    }
