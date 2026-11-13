def test_bootstrap(client):
    res = client.get("/api/v1/bootstrap")
    assert res.status_code == 200
    body = res.json()
    assert body["phase"] == 2
    assert body["llm_mode"] == "mock"
    assert len(body["starters"]) >= 5
    assert len(body["journeys"]) == 6
    assert body["packages"]["self_assessment"][0]["price_gbp"] == 119
    assert body["integrations"]["payment"] == "mock_unavailable"
    assert "api_key" not in str(body).lower()


def test_health_phase2(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["phase"] == 2


def test_chat_returns_sources_and_follow_ups(client):
    res = client.post(
        "/api/v1/chat",
        json={"message": "When is the Self Assessment online filing deadline?", "tax_year": "2025-26"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["sources"]
    assert all("gov.uk" in s["url"] for s in body["sources"])
    assert body["follow_ups"]


def test_chat_package_recommendation(client):
    res = client.post(
        "/api/v1/chat",
        json={"message": "What Self Assessment packages does TaxSimba offer?"},
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["packages"]) == 3
    assert "£119" in body["reply"] or "119" in body["reply"]
    assert "inclusion" not in body["reply"].lower() or "not invent" in body["reply"].lower() or "don't invent" in body["reply"].lower() or "do not invent" in body["reply"].lower() or "don't invent" in body["reply"].lower() or "I don't invent" in body["reply"] or "catalogue" in body["reply"].lower() or "configured prices" in body["reply"].lower()


def test_chat_does_not_invent_inclusions(client):
    res = client.post(
        "/api/v1/chat",
        json={"message": "What is included in the Elite package?"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "invent" in body["reply"].lower() or "not invent" in body["reply"].lower() or "don't invent" in body["reply"].lower()


def test_journey_api_flow(client):
    start = client.post("/api/v1/journeys/start", json={"journey_id": "landlord", "session_id": "j1"})
    assert start.status_code == 200
    state = start.json()["journey"]
    assert state["complete"] is False
    assert state["current"]["options"]

    opt = state["current"]["options"][0]
    advance = client.post(
        "/api/v1/journeys/advance",
        json={"session_id": "j1", "option_id": opt["id"], "journey_state": state},
    )
    assert advance.status_code == 200
    assert advance.json()["journey"]["current"] or advance.json()["journey"]["complete"]


def test_journey_unknown(client):
    res = client.post("/api/v1/journeys/start", json={"journey_id": "spaceship"})
    assert res.status_code == 400


def test_widget_assets_served(client):
    for path in [
        "/widget/index.html",
        "/widget/preview.html",
        "/widget/embed.js",
        "/widget/css/concierge.css",
        "/widget/js/concierge.js",
    ]:
        res = client.get(path)
        assert res.status_code == 200, path


def test_widget_allows_embedding(client):
    res = client.get("/widget/index.html")
    assert "frame-ancestors" in res.headers.get("content-security-policy", "")


def test_root_points_to_preview(client):
    res = client.get("/")
    assert res.json()["phase"] == 2
    assert "/widget/preview.html" in res.json()["preview"]


def test_validation_error_shape(client):
    res = client.post("/api/v1/chat", json={"message": ""})
    assert res.status_code == 422
