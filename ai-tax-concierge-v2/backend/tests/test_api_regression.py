"""API regression suite — bootstrap, health, widget assets, sessions."""

from __future__ import annotations

from pathlib import Path

import pytest

WIDGET_ROOT = Path(__file__).resolve().parents[2] / "widget"


def test_bootstrap_simba_branding(client):
    res = client.get("/api/v1/bootstrap")
    assert res.status_code == 200
    body = res.json()
    assert body["product"] == "SIMBA AI"
    assert body["assistant_name"] == "SIMBA AI"
    assert body["phase"] == 3
    assert body["brand"]["primary"].upper() == "#006B3C"
    assert body["brand"]["primary_action"].upper() == "#078A4B"
    assert "official" in body["brand"]["logo_status"]
    assert "taxsimba-logo.svg" in body["brand"]["logo"]
    assert body["calculator_registry_count"] >= 17


def test_welcome_endpoint(client):
    res = client.get("/api/v1/welcome", params={"session_id": "welcome-reg"})
    assert res.status_code == 200
    body = res.json()
    assert body["session_id"] == "welcome-reg"
    assert body["reply"]
    assert body["llm_mode"] == "mock"
    assert body["disclaimer"]


def test_health_phase_three_mock_notice(client):
    res = client.get("/api/v1/health")
    body = res.json()
    assert body["phase"] == 3
    assert body["product"] == "SIMBA AI"
    assert body["llm_mode"] == "mock"
    assert body["mock_notice"]
    assert "current_tax_year" in body


WIDGET_ASSET_PATHS = [
    "/widget/index.html",
    "/widget/preview.html",
    "/widget/embed.js",
    "/widget/css/concierge.css",
    "/widget/js/concierge.js",
    "/widget/assets/taxsimba-logo.svg",
]


@pytest.mark.parametrize("path", WIDGET_ASSET_PATHS)
def test_widget_assets_served(client, path):
    res = client.get(path)
    assert res.status_code == 200, path


def test_official_taxsimba_logo_served(client):
    res = client.get("/widget/assets/taxsimba-logo.svg")
    assert res.status_code == 200
    text = res.text.lower()
    assert "<svg" in text
    assert "lion" not in text
    assert "placeholder" not in text


def test_analytics_summary_shape(client):
    client.post(
        "/api/v1/chat",
        json={"session_id": "an-sum", "message": "When is Self Assessment deadline?", "tax_year": "2025-26"},
    )
    res = client.get("/api/v1/analytics/summary")
    body = res.json()
    assert "conversation_volume" in body
    assert body["conversation_volume"] >= 1
    assert "redacted" in body["privacy"].lower()


def test_sessions_delete_endpoint(client):
    sid = "sess-delete-reg"
    client.post("/api/v1/chat", json={"session_id": sid, "message": "Hello"})
    deleted = client.post("/api/v1/sessions/delete", json={"session_id": sid})
    assert deleted.json()["deleted"] is True
    gone = client.get(f"/api/v1/sessions/{sid}")
    assert gone.json()["found"] is False


@pytest.mark.parametrize(
    "payload,status",
    [
        ({"message": ""}, 422),
        ({"message": "   "}, 422),
        ({"message": "ok", "tax_year": "bogus"}, 422),
    ],
)
def test_chat_validation_errors(client, payload, status):
    res = client.post("/api/v1/chat", json=payload)
    assert res.status_code == status


def test_journeys_list_length_twelve(client):
    res = client.get("/api/v1/journeys")
    journeys = res.json()["journeys"]
    assert len(journeys) == 12
    titles = {j["title"] for j in journeys}
    assert "Accountant consultation (£99)" in titles
