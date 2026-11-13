"""Adapter interfaces for external systems (stubs until Phase 2+)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.models.schemas import ChatMessage, SourceReference


class LLMAdapter(ABC):
    mode: str

    @abstractmethod
    async def complete(
        self,
        *,
        system_prompt: str,
        messages: List[ChatMessage],
        user_message: str,
    ) -> str:
        raise NotImplementedError


class WebsiteNavAdapter(ABC):
    @abstractmethod
    def suggest_paths(self, intent: str) -> List[Dict[str, str]]:
        raise NotImplementedError


class PaymentAdapter(ABC):
    @abstractmethod
    def create_checkout(self, package_code: str) -> Dict[str, Any]:
        raise NotImplementedError


class CalendlyAdapter(ABC):
    @abstractmethod
    def consultation_link(self, price_gbp: int = 99) -> Dict[str, Any]:
        raise NotImplementedError


class ClientPortalAdapter(ABC):
    @abstractmethod
    def account_status(self, external_ref: Optional[str]) -> Dict[str, Any]:
        raise NotImplementedError


class GroundingContext:
    """Bundle of verified sources passed into the conversational engine."""

    def __init__(self, sources: List[SourceReference], tax_year: str) -> None:
        self.sources = sources
        self.tax_year = tax_year
