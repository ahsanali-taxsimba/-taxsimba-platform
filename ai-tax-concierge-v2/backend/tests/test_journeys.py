from app.journeys.engine import advance_journey, list_journeys, start_journey


def test_list_journeys_covers_required_personas():
    ids = {j["id"] for j in list_journeys()}
    assert len(ids) == 12
    for required in (
        "first_time",
        "freelancer",
        "landlord",
        "cis",
        "mtd",
        "consultation",
        "existing_client",
        "missed_deadline",
    ):
        assert required in ids


def test_journey_asks_one_question_at_a_time():
    state = start_journey("freelancer")
    assert state.complete is False
    assert state.current is not None
    assert state.current.prompt
    assert len(state.current.options) >= 2


def test_freelancer_journey_completes_with_recommendations():
    state = start_journey("freelancer")
    state = advance_journey(state, state.current.options[0]["id"])
    assert state.complete is False
    state = advance_journey(state, state.current.options[0]["id"])
    assert state.complete is True
    assert state.summary
    assert state.suggested_package_codes
    assert state.follow_ups


def test_invalid_option_raises():
    state = start_journey("cis")
    try:
        advance_journey(state, "not-a-real-option")
        assert False, "expected ValueError"
    except ValueError:
        pass
