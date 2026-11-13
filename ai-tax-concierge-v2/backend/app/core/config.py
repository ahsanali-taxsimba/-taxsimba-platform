"""Application settings — secrets stay server-side."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")
    openai_timeout_seconds: float = Field(default=30.0, alias="OPENAI_TIMEOUT_SECONDS")

    concierge_env: str = Field(default="development", alias="CONCIERGE_ENV")
    concierge_cors_origins: str = Field(
        default=(
            "http://localhost:3000,http://127.0.0.1:3000,"
            "http://localhost:8090,http://127.0.0.1:8090,"
            "http://localhost:8091,http://127.0.0.1:8091,"
            "null"
        ),
        alias="CONCIERGE_CORS_ORIGINS",
    )
    concierge_log_level: str = Field(default="INFO", alias="CONCIERGE_LOG_LEVEL")
    concierge_force_mock_llm: bool = Field(default=False, alias="CONCIERGE_FORCE_MOCK_LLM")

    consultation_booking_url: str = Field(
        default="https://calendly.com/example/taxsimba-99-consultation",
        alias="CONSULTATION_BOOKING_URL",
    )
    website_base_url: str = Field(
        default="https://www.taxsimba.co.uk",
        alias="WEBSITE_BASE_URL",
    )

    @field_validator("concierge_force_mock_llm", mode="before")
    @classmethod
    def _parse_bool(cls, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if value is None or value == "":
            return False
        return str(value).strip().lower() in {"1", "true", "yes", "on"}

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.concierge_cors_origins.split(",") if o.strip()]

    @property
    def use_mock_llm(self) -> bool:
        if self.concierge_force_mock_llm:
            return True
        return not bool(self.openai_api_key.strip())

    def safe_public_config(self) -> dict:
        """Config safe to expose — never includes API keys."""
        return {
            "env": self.concierge_env,
            "phase": 3,
            "product": "SIMBA AI",
            "subtitle": "Your UK Tax Assistant",
            "llm_mode": "mock" if self.use_mock_llm else "openai",
            "model": self.openai_model if not self.use_mock_llm else "mock-simba-v1",
            "website_base_url": self.website_base_url,
            "consultation_available": True,
            "consultation_price_gbp": 99,
            "consultation_duration_minutes": 30,
            "consultation_meeting": "Google Meet",
            "consultation_booking_status": "stub",
            "payment_status": "mock_unavailable",
            "mock_notice": "MOCK MODE — not live OpenAI." if self.use_mock_llm else None,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
