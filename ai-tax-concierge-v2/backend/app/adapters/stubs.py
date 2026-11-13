"""Config/mock adapters for integrations not yet available."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.adapters.base import (
    CalendlyAdapter,
    ClientPortalAdapter,
    PaymentAdapter,
    WebsiteNavAdapter,
)
from app.core.config import Settings


class ConfigWebsiteNavAdapter(WebsiteNavAdapter):
    def __init__(self, settings: Settings) -> None:
        self._base = settings.website_base_url.rstrip("/")
        self._map = {
            "self_assessment": f"{self._base}/self-assessment",
            "mtd": f"{self._base}/making-tax-digital",
            "pricing": f"{self._base}/pricing",
            "consultation": f"{self._base}/book-consultation",
            "contact": f"{self._base}/contact",
        }

    def suggest_paths(self, intent: str) -> List[Dict[str, str]]:
        key = intent.lower().strip()
        url = self._map.get(key)
        if not url:
            return [{"label": "TaxSimba home", "url": self._base, "status": "stub"}]
        return [{"label": key.replace("_", " ").title(), "url": url, "status": "stub"}]


class MockPaymentAdapter(PaymentAdapter):
    def create_checkout(self, package_code: str) -> Dict[str, Any]:
        return {
            "status": "unavailable",
            "reason": "Payment integration not wired in Phase 1",
            "package_code": package_code,
            "checkout_url": None,
        }


class ConfigCalendlyAdapter(CalendlyAdapter):
    def __init__(self, settings: Settings) -> None:
        self._url = settings.consultation_booking_url

    def consultation_link(self, price_gbp: int = 99) -> Dict[str, Any]:
        return {
            "status": "stub",
            "price_gbp": price_gbp,
            "booking_url": self._url,
            "label": f"£{price_gbp} accountant consultation",
        }


class MockClientPortalAdapter(ClientPortalAdapter):
    def account_status(self, external_ref: Optional[str]) -> Dict[str, Any]:
        return {
            "status": "unavailable",
            "reason": "Client portal adapter not wired in Phase 1",
            "external_ref": external_ref,
        }
