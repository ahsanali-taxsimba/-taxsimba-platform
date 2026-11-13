"""Full guided journey coverage — 12 personas and key completion flows."""

from __future__ import annotations

import pytest

from app.journeys.engine import advance_journey, list_journeys, start_journey

ALL_JOURNEY_IDS = [j["id"] for j in list_journeys()]


def _complete_journey(journey_id: str, pick_first: bool = True):
    state = start_journey(journey_id)
    while not state.complete:
        assert state.current and state.current.options
        opt_id = state.current.options[0]["id"] if pick_first else state.current.options[-1]["id"]
        state = advance_journey(state, opt_id)
    return state


@pytest.mark.parametrize("journey_id", ALL_JOURNEY_IDS)
def test_each_journey_starts_with_prompt(journey_id):
    state = start_journey(journey_id)
    assert state.journey_id == journey_id
    assert state.complete is False
    assert state.current is not None
    assert state.current.prompt
    assert len(state.current.options) >= 2


def test_freelancer_journey_completes_with_sa_packages():
    state = _complete_journey("freelancer")
    assert state.complete is True
    assert state.summary
    assert state.suggested_package_codes
    assert any(c.startswith("SA_") for c in state.suggested_package_codes)
    assert state.follow_ups


def test_consultation_journey_includes_accountant_package():
    state = _complete_journey("consultation")
    assert "ACCOUNTANT_CONSULT_99" in state.suggested_package_codes
    assert "£99" in (state.summary or "") or "99" in (state.summary or "")


def test_existing_client_does_not_suggest_paid_consultation():
    state = _complete_journey("existing_client")
    assert "ACCOUNTANT_CONSULT_99" not in state.suggested_package_codes
    assert state.suggested_package_codes == []


def test_missed_deadline_journey_completes():
    state = _complete_journey("missed_deadline")
    assert state.complete
    assert any("deadline" in t for t in state.tags) or "missed_deadline" in state.tags


@pytest.mark.parametrize(
    "journey_id",
    ["cis", "landlord", "mtd", "sole_trader", "self_employed", "multiple_income"],
)
def test_journey_completes_without_error(journey_id):
    state = _complete_journey(journey_id)
    assert state.complete is True
    assert state.summary


def test_invalid_journey_option_returns_400(client):
    start = client.post(
        "/api/v1/journeys/start",
        json={"journey_id": "cis", "session_id": "journey-invalid"},
    )
    assert start.status_code == 200
    state = start.json()["journey"]
    bad = client.post(
        "/api/v1/journeys/advance",
        json={
            "session_id": "journey-invalid",
            "option_id": "definitely-not-valid",
            "journey_state": state,
        },
    )
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "validation_error"


def test_consultation_api_completion_packages(client):
    sid = "consult-api"
    start = client.post("/api/v1/journeys/start", json={"journey_id": "consultation", "session_id": sid})
    state = start.json()["journey"]
    for _ in range(4):
        if state.get("complete"):
            break
        opt = state["current"]["options"][0]["id"]
        adv = client.post(
            "/api/v1/journeys/advance",
            json={"session_id": sid, "option_id": opt, "journey_state": state},
        )
        assert adv.status_code == 200
        state = adv.json()["journey"]
    codes = state.get("suggested_package_codes") or []
    assert "ACCOUNTANT_CONSULT_99" in codes
