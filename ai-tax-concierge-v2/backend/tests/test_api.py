from app.core.config import Settings


def test_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["llm_mode"] == "mock"
    assert "current_tax_year" in body


def test_public_config_hides_secrets(client):
    res = client.get("/api/v1/config")
    assert res.status_code == 200
    body = res.json()
    assert "openai" not in str(body).lower() or body["llm_mode"] == "mock"
    assert "api_key" not in body
    assert "OPENAI" not in str(body)
    assert body["consultation_price_gbp"] == 99


def test_chat_happy_path(client):
    res = client.post(
        "/api/v1/chat",
        json={
            "session_id": "api-sess-1",
            "message": "Do I need to register for Self Assessment as a sole trader?",
            "tax_year": "2025-26",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["session_id"] == "api-sess-1"
    assert body["reply"]
    assert body["tax_year"] == "2025-26"
    assert isinstance(body["sources"], list)
    assert body["disclaimer"]
    assert body["llm_mode"] == "mock"


def test_chat_validation_blank_message(client):
    res = client.post("/api/v1/chat", json={"message": "   "})
    assert res.status_code == 422


def test_chat_invalid_tax_year(client):
    res = client.post(
        "/api/v1/chat",
        json={"message": "What is personal allowance?", "tax_year": "not-a-year"},
    )
    assert res.status_code == 422


def test_root(client):
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["phase"] == 2


def test_settings_never_expose_key_in_safe_config():
    settings = Settings(OPENAI_API_KEY="sk-super-secret-key-1234", CONCIERGE_FORCE_MOCK_LLM=False)
    public = settings.safe_public_config()
    assert "sk-super-secret" not in str(public)
    assert public["llm_mode"] == "openai"
