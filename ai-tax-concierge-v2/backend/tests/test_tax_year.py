from datetime import date

from app.knowledge.tax_year import applies_to_year, resolve_tax_year, tax_year_bounds, tax_year_label


def test_tax_year_label_after_6_april():
    assert tax_year_label(date(2025, 4, 6)) == "2025-26"
    assert tax_year_label(date(2025, 12, 1)) == "2025-26"


def test_tax_year_label_before_6_april():
    assert tax_year_label(date(2025, 4, 5)) == "2024-25"
    assert tax_year_label(date(2026, 1, 31)) == "2025-26"


def test_tax_year_bounds():
    start, end = tax_year_bounds("2025-26")
    assert start == date(2025, 4, 6)
    assert end == date(2026, 4, 5)


def test_resolve_explicit_override():
    assert resolve_tax_year("2024/25") == "2024-25"


def test_applies_to_year():
    assert applies_to_year(["2024-25", "2025-26"], "2025-26") is True
    assert applies_to_year(["2024-25"], "2025-26") is False
