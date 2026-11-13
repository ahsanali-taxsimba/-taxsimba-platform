"""Shared pytest fixtures — always force mock LLM (no network)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(
        OPENAI_API_KEY="",
        CONCIERGE_FORCE_MOCK_LLM=True,
        CONCIERGE_CORS_ORIGINS="http://localhost:3000",
        CONSULTATION_BOOKING_URL="https://calendly.com/example/taxsimba-99-consultation",
        WEBSITE_BASE_URL="https://www.taxsimba.com",
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client
