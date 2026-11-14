"""UK tax year utilities (6 April → 5 April)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional, Union


DateLike = Union[date, datetime]


def _as_date(value: Optional[DateLike] = None) -> date:
    if value is None:
        return date.today()
    if isinstance(value, datetime):
        return value.date()
    return value


def tax_year_label(on: Optional[DateLike] = None) -> str:
    """Return label like 2025-26 for the UK tax year containing `on`."""
    d = _as_date(on)
    if d.month > 4 or (d.month == 4 and d.day >= 6):
        start = d.year
    else:
        start = d.year - 1
    end = (start + 1) % 100
    return f"{start}-{end:02d}"


def tax_year_bounds(label: str) -> tuple[date, date]:
    """Inclusive start / exclusive end style: start 6 Apr, end 5 Apr next year."""
    normalised = label.replace("/", "-")
    start_year = int(normalised.split("-")[0])
    start = date(start_year, 4, 6)
    end = date(start_year + 1, 4, 5)
    return start, end


def resolve_tax_year(explicit: Optional[str] = None, on: Optional[DateLike] = None) -> str:
    if explicit:
        return explicit.replace("/", "-")
    return tax_year_label(on)


def applies_to_year(fact_years: list[str], tax_year: str) -> bool:
    return tax_year in fact_years
