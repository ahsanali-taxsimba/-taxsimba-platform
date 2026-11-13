"""Guided journey engine — one question at a time with retained context."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.catalog.service import resolve_packages
from app.models.schemas import JourneyState, JourneyStepView

DEFS = Path(__file__).resolve().parent / "definitions.json"


@lru_cache
def _raw() -> dict:
    return json.loads(DEFS.read_text(encoding="utf-8"))


def list_journeys() -> List[dict]:
    return [
        {"id": j["id"], "title": j["title"], "description": j["description"]}
        for j in _raw()["journeys"]
    ]


def get_journey(journey_id: str) -> Optional[dict]:
    for j in _raw()["journeys"]:
        if j["id"] == journey_id:
            return j
    return None


def _step_map(journey: dict) -> Dict[str, dict]:
    return {s["id"]: s for s in journey["steps"]}


def start_journey(journey_id: str) -> JourneyState:
    journey = get_journey(journey_id)
    if not journey:
        raise ValueError(f"Unknown journey: {journey_id}")
    first = journey["steps"][0]
    return JourneyState(
        journey_id=journey_id,
        journey_title=journey["title"],
        step_id=first["id"],
        complete=False,
        answers={},
        tags=[],
        current=JourneyStepView(
            step_id=first["id"],
            prompt=first["prompt"],
            options=[{"id": o["id"], "label": o["label"]} for o in first.get("options", [])],
        ),
    )


def advance_journey(state: JourneyState, option_id: str) -> JourneyState:
    journey = get_journey(state.journey_id)
    if not journey:
        raise ValueError("Unknown journey")
    steps = _step_map(journey)
    current = steps[state.step_id]
    options = {o["id"]: o for o in current.get("options", [])}
    if option_id not in options:
        raise ValueError("Invalid option for current step")

    chosen = options[option_id]
    answers = dict(state.answers)
    answers[state.step_id] = option_id
    tags = list(dict.fromkeys([*state.tags, *chosen.get("tags", [])]))

    next_id = chosen.get("next")
    next_step = steps.get(next_id) if next_id else None
    if not next_step:
        raise ValueError("Journey graph error: missing next step")

    # Terminal wrap step (no prompt)
    if next_step.get("prompt") is None:
        packages = resolve_packages(next_step.get("suggest_packages", []))
        return JourneyState(
            journey_id=state.journey_id,
            journey_title=journey["title"],
            step_id=next_step["id"],
            complete=True,
            answers=answers,
            tags=tags,
            current=None,
            summary=next_step.get("summary_template"),
            suggested_package_codes=[p["code"] for p in packages],
            suggested_calculator_ids=list(next_step.get("suggest_calculators", [])),
            follow_ups=list(next_step.get("follow_ups", [])),
        )

    return JourneyState(
        journey_id=state.journey_id,
        journey_title=journey["title"],
        step_id=next_step["id"],
        complete=False,
        answers=answers,
        tags=tags,
        current=JourneyStepView(
            step_id=next_step["id"],
            prompt=next_step["prompt"],
            options=[{"id": o["id"], "label": o["label"]} for o in next_step.get("options", [])],
        ),
    )


def journey_context_blurb(state: Optional[JourneyState]) -> str:
    if not state:
        return ""
    bits = [f"Active guided journey: {state.journey_title} ({state.journey_id})."]
    if state.answers:
        bits.append(f"Answers so far: {state.answers}.")
    if state.tags:
        bits.append(f"Tags: {', '.join(state.tags)}.")
    if state.complete and state.summary:
        bits.append(f"Journey complete summary: {state.summary}")
    return " ".join(bits)
