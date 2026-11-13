"""Load product catalogue, starters and calculators from config (no invented data)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

CATALOG_DIR = Path(__file__).resolve().parent


def _read(name: str) -> dict:
    return json.loads((CATALOG_DIR / name).read_text(encoding="utf-8"))


@lru_cache
def packages_catalog() -> dict:
    return _read("packages.json")


@lru_cache
def calculators_catalog() -> dict:
    return _read("calculators.json")


@lru_cache
def starters_catalog() -> dict:
    return _read("starters.json")


def all_packages_flat() -> Dict[str, dict]:
    cat = packages_catalog()
    out: Dict[str, dict] = {}
    for item in cat["self_assessment"]:
        out[item["code"]] = {**item, "family": "self_assessment"}
    for item in cat["mtd"]:
        out[item["code"]] = {**item, "family": "mtd"}
    consult = cat["consultation"]
    out[consult["code"]] = {**consult, "family": "consultation"}
    return out


def format_package_line(pkg: dict) -> str:
    price = pkg["price_gbp"]
    price_str = f"£{price:.2f}" if isinstance(price, float) else f"£{price}"
    return f"{pkg['name']}: {price_str} ({pkg['billing']}; {pkg.get('vat_note', '')})".strip()


def package_catalog_text() -> str:
    """Canonical price text the LLM must not contradict."""
    cat = packages_catalog()
    lines = ["Self Assessment packages:"]
    for p in cat["self_assessment"]:
        lines.append(f"- {format_package_line(p)}")
    lines.append("MTD plans:")
    for p in cat["mtd"]:
        lines.append(f"- {format_package_line(p)}")
    c = cat["consultation"]
    lines.append(f"Consultation: {format_package_line(c)} (booking status: {c.get('booking_status', 'unknown')})")
    lines.append(
        "Do not invent inclusions, discounts, or live availability. "
        f"Catalogue note: {cat['disclaimer']}"
    )
    return "\n".join(lines)


def match_calculators(message: str, limit: int = 2) -> List[dict]:
    text = message.lower()
    scored: List[tuple[int, dict]] = []
    for item in calculators_catalog()["items"]:
        score = sum(1 for t in item["topics"] if t in text)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [i for _, i in scored[:limit]]


def resolve_packages(codes: List[str]) -> List[dict]:
    flat = all_packages_flat()
    return [flat[c] for c in codes if c in flat]


def public_catalog_payload(website_base_url: str) -> dict:
    calc = calculators_catalog()
    items = []
    for item in calc["items"]:
        entry = dict(item)
        if item.get("url_status") == "stub":
            entry["url"] = None
            entry["note"] = "URL not confirmed against live website yet"
            entry["configured_path"] = item.get("path")
        else:
            entry["url"] = f"{website_base_url.rstrip('/')}{item.get('path', '')}"
        items.append(entry)
    return {
        "packages": packages_catalog(),
        "calculators": {**calc, "items": items},
        "starters": starters_catalog()["starters"],
    }
