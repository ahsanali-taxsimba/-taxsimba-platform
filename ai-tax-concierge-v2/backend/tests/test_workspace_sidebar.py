"""Expanded workspace sidebar and VAT rolling-period knowledge."""

from __future__ import annotations

from pathlib import Path

from app.catalog.service import calculators_catalog, packages_catalog
from app.knowledge.loader import load_facts, reload_facts
from app.knowledge.retrieval import retrieve

WIDGET = Path(__file__).resolve().parents[2] / "widget"


def test_sidebar_nav_options_present():
    html = (WIDGET / "index.html").read_text(encoding="utf-8")
    for label in [
        "Chat with SIMBA",
        "Guided Help",
        "Tax Calculators",
        "Our Packages",
        "Book a Consultation",
        "FAQs",
    ]:
        assert label in html
    assert "Accountant-led service" in html
    assert "ts-sidebar" in html
    assert "ts-mobile-nav" in html


def test_workspace_css_tokens():
    css = (WIDGET / "css/concierge.css").read_text(encoding="utf-8").lower()
    assert ".ts-sidebar" in css
    assert ".ts-workspace" in css
    assert "#006b3c" in css
    assert "#c6a75e" not in css


def test_seventeen_live_calculators():
    items = calculators_catalog()["items"]
    assert len(items) == 17
    assert all(i.get("url_status") == "live_verified" for i in items)


def test_package_prices():
    cat = packages_catalog()
    assert [p["price_gbp"] for p in cat["self_assessment"]] == [119, 149, 299]
    assert [p["price_gbp"] for p in cat["mtd"]] == [29.99, 59.99, 89.99]
    assert all("VAT included" in p["vat_note"] for p in cat["mtd"])
    assert cat["consultation"]["price_gbp"] == 99
    assert cat["consultation"]["duration_minutes"] == 30


def test_vat_corpus_includes_rolling_and_forward_look():
    reload_facts()
    facts = {f.id: f for f in load_facts()}
    assert "vat-registration-timing-tests" in facts
    summary = facts["vat-registration-timing-tests"].summary.lower()
    assert "12 months" in summary or "12-month" in summary
    assert "30 day" in summary or "30-day" in summary
    ranked = retrieve(
        "VAT registration rolling 12 months and forward looking 30 days £90000",
        "2025-26",
        limit=5,
    )
    blob = " ".join(f"{r.fact.id} {r.fact.title} {r.fact.summary}".lower() for r in ranked)
    assert "vat" in blob
