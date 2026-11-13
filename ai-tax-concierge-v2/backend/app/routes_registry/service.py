"""Configurable website route registry — never invent live URLs."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List

REG = Path(__file__).resolve().parent / "routes.json"


@lru_cache
def _raw() -> dict:
    return json.loads(REG.read_text(encoding="utf-8"))


def list_routes() -> dict:
    return _raw()


def match_routes(message: str, *, limit: int = 3) -> List[dict]:
    text = message.lower()
    scored = []
    for route in _raw()["routes"]:
        score = sum(1 for t in route.get("topics", []) if t in text)
        if score:
            scored.append((score, route))
    scored.sort(key=lambda x: x[0], reverse=True)
    out = []
    for _, route in scored[:limit]:
        item = dict(route)
        item["url"] = None
        item["note"] = "Route configured but not confirmed against live website"
        out.append(item)
    return out


def calculator_count() -> int:
    return sum(1 for r in _raw()["routes"] if r.get("kind") == "calculator")
