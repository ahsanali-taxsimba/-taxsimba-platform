"""Load curated knowledge corpus from disk."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List

from app.models.schemas import KnowledgeFact

CORPUS_DIR = Path(__file__).resolve().parent / "corpus"


@lru_cache
def load_facts() -> tuple[KnowledgeFact, ...]:
    facts: List[KnowledgeFact] = []
    for path in sorted(CORPUS_DIR.glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        for item in raw:
            facts.append(KnowledgeFact.model_validate(item))
    return tuple(facts)


def reload_facts() -> tuple[KnowledgeFact, ...]:
    load_facts.cache_clear()
    return load_facts()
