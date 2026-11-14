"""Widget HTML/CSS/JS accessibility and Emerald Signature branding assertions."""

from __future__ import annotations

from pathlib import Path

import pytest

WIDGET = Path(__file__).resolve().parents[2] / "widget"


def _read(name: str) -> str:
    return (WIDGET / name).read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "file,needle",
    [
        ("index.html", 'aria-label="SIMBA AI'),
        ("index.html", "aria-live"),
        ("index.html", "Delete chat"),
        ("index.html", "taxsimba-logo.svg"),
        ("index.html", "ts-topics-btn"),
        ("index.html", "ts-sidebar"),
        ("index.html", "Chat with SIMBA"),
        ("index.html", "Guided Help"),
        ("index.html", "Accountant-led service"),
        ("css/concierge.css", "focus-visible"),
        ("css/concierge.css", ".ts-sidebar"),
        ("css/concierge.css", ".ts-workspace"),
        ("css/concierge.css", "#006b3c"),
        ("css/concierge.css", "#078a4b"),
        ("css/concierge.css", "#004d2c"),
        ("css/concierge.css", "Manrope"),
        ("css/concierge.css", "Public Sans"),
        ("css/concierge.css", ".ts-topics"),
        ("js/concierge.js", "Preparing a reply"),
        ("js/concierge.js", "Self Assessment"),
        ("js/concierge.js", "Making Tax Digital"),
        ("js/concierge.js", "Landlords"),
        ("js/concierge.js", "Freelancers & CIS"),
        ("js/concierge.js", "Tax Calculators"),
        ("js/concierge.js", "enterChatView"),
        ("embed.js", "focus-visible"),
        ("embed.js", "Ask SIMBA"),
        ("embed.js", "Escape"),
        ("preview.html", "SIMBA AI"),
        ("assets/taxsimba-logo.svg", "<svg"),
    ],
)
def test_widget_file_contains_accessibility_marker(file, needle):
    assert needle.lower() in _read(file).lower()


def test_emerald_signature_tokens():
    css = _read("css/concierge.css").lower()
    assert "--ts-primary: #006b3c" in css
    assert "--ts-primary-action: #078a4b" in css
    assert "--ts-emerald-deep: #004d2c" in css
    assert "#c6a75e" not in css
    assert "--simba-emerald" not in css
    assert "@keyframes" not in css


def test_no_mascot_in_primary_ui():
    html = _read("index.html").lower()
    embed = _read("embed.js").lower()
    assert "simba-emblem.svg" not in html
    assert "simba-emblem.svg" not in embed
    assert "lion" not in _read("css/concierge.css").lower()
