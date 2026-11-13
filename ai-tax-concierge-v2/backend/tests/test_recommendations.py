from app.ai.recommendations import recommend_for_message, to_package_cards
from app.catalog.service import packages_catalog


def test_sa_package_prices_match_catalogue():
    cards = to_package_cards(["SA_SIMPLE", "SA_SMART", "SA_ELITE"])
    assert [c.price_gbp for c in cards] == [119.0, 149.0, 299.0]


def test_mtd_package_prices_vat_included():
    cards = to_package_cards(["MTD_STARTER", "MTD_GROWTH", "MTD_COMPLETE"])
    assert [c.price_gbp for c in cards] == [29.99, 59.99, 89.99]
    assert all("VAT included" in c.vat_note for c in cards)


def test_consultation_price():
    cards = to_package_cards(["ACCOUNTANT_CONSULT_99"])
    assert cards[0].price_gbp == 99
    assert packages_catalog()["consultation"]["booking_status"] == "stub"


def test_recommend_packages_without_inventing_inclusions():
    packages, calculators, follow_ups = recommend_for_message(
        "What do TaxSimba Self Assessment packages cost?",
        journey=None,
        website_base="https://www.taxsimba.com",
    )
    assert len(packages) == 3
    assert all(p.inclusions_status == "not_specified_in_catalog" for p in packages)
    assert follow_ups


def test_calculator_urls_are_stubbed():
    _, calculators, _ = recommend_for_message(
        "I am a CIS subcontractor",
        journey=None,
        website_base="https://www.taxsimba.com",
    )
    assert calculators
    assert all(c.url_status == "stub" for c in calculators)
    assert all(c.url is None for c in calculators)
