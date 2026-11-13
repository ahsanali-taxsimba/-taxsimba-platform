"""Approved catalogue prices — Elite £299 and MTD monthly ladder.

Verifies seed constants and that Stripe Checkout receives the correct
`unit_amount` (pence) from package.price — not a stale £249 display.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from phase1b import DEFAULT_PACKAGES, LEGACY_MTD_CODES, SELF_ASSESSMENT, MTD, _checkout


def _by_code(service: str) -> dict:
    return {
        p["code"]: p
        for p in DEFAULT_PACKAGES
        if p["service_type"] == service
    }


class TestApprovedSAPrices:
    def test_sa_simple_smart_elite_prices(self):
        sa = _by_code(SELF_ASSESSMENT)
        assert sa["SIMPLE"]["price"] == 119.0
        assert sa["SMART"]["price"] == 149.0
        assert sa["ELITE"]["price"] == 299.0
        assert sa["ELITE"]["price"] != 249.0

    def test_smart_to_elite_upgrade_delta(self):
        sa = _by_code(SELF_ASSESSMENT)
        delta = round(sa["ELITE"]["price"] - sa["SMART"]["price"], 2)
        assert delta == 150.0  # was incorrectly 100 when Elite was £249


class TestApprovedMTDPrices:
    def test_mtd_starter_growth_complete_monthly(self):
        mtd = _by_code(MTD)
        assert set(mtd) == {"MTD_STARTER", "MTD_GROWTH", "MTD_COMPLETE"}
        assert mtd["MTD_STARTER"]["price"] == 29.99
        assert mtd["MTD_GROWTH"]["price"] == 59.99
        assert mtd["MTD_COMPLETE"]["price"] == 89.99
        assert mtd["MTD_STARTER"]["billing_frequency"] == "Per month"
        assert "VAT included" in mtd["MTD_STARTER"]["vat_note"]

    def test_legacy_mtd_codes_listed_for_retirement(self):
        assert "MTD_ESSENTIAL" in LEGACY_MTD_CODES
        assert "MTD_PLUS" in LEGACY_MTD_CODES
        active_codes = {p["code"] for p in DEFAULT_PACKAGES if p["service_type"] == MTD}
        assert not (set(LEGACY_MTD_CODES) & active_codes)


class TestStripeCheckoutAmounts:
    """Stripe test-mode charge path: unit_amount is package price in pence."""

    def test_elite_full_purchase_unit_amount_29900(self):
        fake = MagicMock()
        fake.id = "cs_test_elite"
        fake.url = "https://checkout.stripe.com/c/pay/cs_test_elite"
        with patch("phase1b.stripe.checkout.Session.create", return_value=fake) as create:
            session = _checkout(
                299.0,
                "Self Assessment — Elite",
                "https://example.com",
                {"kind": "SERVICE_ACTIVATION", "to_package": "ELITE"},
            )
        assert session.id == "cs_test_elite"
        kwargs = create.call_args.kwargs
        line = kwargs["line_items"][0]
        assert line["price_data"]["currency"] == "gbp"
        assert line["price_data"]["unit_amount"] == 29900
        assert line["price_data"]["unit_amount"] != 24900

    def test_smart_to_elite_upgrade_unit_amount_15000(self):
        fake = MagicMock()
        fake.id = "cs_test_upgrade"
        fake.url = "https://checkout.stripe.com/c/pay/cs_test_upgrade"
        with patch("phase1b.stripe.checkout.Session.create", return_value=fake) as create:
            _checkout(
                150.0,
                "Self Assessment upgrade — Smart to Elite",
                "https://example.com",
                {"kind": "SA_UPGRADE", "from_package": "SMART", "to_package": "ELITE"},
            )
        unit = create.call_args.kwargs["line_items"][0]["price_data"]["unit_amount"]
        assert unit == 15000
        assert unit != 10000  # obsolete Smart→Elite delta when Elite was £249

    @pytest.mark.parametrize(
        "code,price,pence",
        [
            ("MTD_STARTER", 29.99, 2999),
            ("MTD_GROWTH", 59.99, 5999),
            ("MTD_COMPLETE", 89.99, 8999),
        ],
    )
    def test_mtd_monthly_unit_amounts(self, code, price, pence):
        fake = MagicMock()
        fake.id = f"cs_test_{code}"
        fake.url = "https://checkout.stripe.com/c/pay/cs_test"
        with patch("phase1b.stripe.checkout.Session.create", return_value=fake) as create:
            _checkout(price, f"MTD — {code}", "https://example.com",
                      {"kind": "SERVICE_ACTIVATION", "to_package": code})
        assert create.call_args.kwargs["line_items"][0]["price_data"]["unit_amount"] == pence
