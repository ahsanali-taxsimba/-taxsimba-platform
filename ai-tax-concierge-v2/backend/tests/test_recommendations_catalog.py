"""Catalogue prices, calculator stubs, and route registry matching."""

from __future__ import annotations

import pytest

from app.ai.recommendations import recommend_for_message, to_package_cards
from app.catalog.service import packages_catalog
from app.routes_registry.service import calculator_count, match_routes, list_routes

WEBSITE = "https://www.taxsimba.com"


@pytest.fixture(autouse=True)
def _clear_catalog_cache():
    packages_catalog.cache_clear()
    yield
    packages_catalog.cache_clear()


SA_PRICE_CASES = [
    ("SA_SIMPLE", 119.0),
    ("SA_SMART", 149.0),
    ("SA_ELITE", 299.0),
]

MTD_PRICE_CASES = [
    ("MTD_STARTER", 29.99),
    ("MTD_GROWTH", 59.99),
    ("MTD_COMPLETE", 89.99),
]


@pytest.mark.parametrize("code,price", SA_PRICE_CASES)
def test_sa_package_prices(code, price):
    card = to_package_cards([code])[0]
    assert card.price_gbp == price
    assert card.inclusions_status == "not_specified_in_catalog"


@pytest.mark.parametrize("code,price", MTD_PRICE_CASES)
def test_mtd_package_prices_vat_included(code, price):
    card = to_package_cards([code])[0]
    assert card.price_gbp == price
    assert "VAT included" in (card.vat_note or "")


def test_consultation_catalogue_price_and_stub():
    card = to_package_cards(["ACCOUNTANT_CONSULT_99"])[0]
    assert card.price_gbp == 99
    cat = packages_catalog()
    assert cat["consultation"]["booking_status"] == "stub"


@pytest.mark.parametrize(
    "message",
    [
        "What do TaxSimba Self Assessment packages cost?",
        "MTD plan prices for landlords",
        "How much is the accountant consultation?",
    ],
)
def test_recommendations_inclusions_status_not_invented(message):
    packages, _, _ = recommend_for_message(message, journey=None, website_base=WEBSITE)
    assert packages
    assert all(p.inclusions_status == "not_specified_in_catalog" for p in packages)


def test_calculator_recommendations_are_stubs():
    _, calculators, _ = recommend_for_message(
        "CIS subcontractor quarterly income",
        journey=None,
        website_base=WEBSITE,
    )
    assert calculators
    assert all(c.url_status == "stub" for c in calculators)
    assert all(c.url is None for c in calculators)


def test_route_registry_has_seventeen_calculator_routes():
    assert calculator_count() >= 17
    calc_routes = [r for r in list_routes()["routes"] if r.get("kind") == "calculator"]
    assert len(calc_routes) >= 17


@pytest.mark.parametrize(
    "message,topic",
    [
        ("I am a landlord with rental property income", "landlord"),
        ("mtd quarterly updates compatible software sole trader", "mtd"),
        ("Self Assessment packages and filing", "self assessment"),
    ],
)
def test_match_routes_for_landlord_and_mtd(message, topic):
    routes = match_routes(message, limit=5)
    assert routes
    topics_hit = {t for r in routes for t in r.get("topics", [])}
    assert topic in topics_hit
    assert all(r["url"] is None for r in routes)
