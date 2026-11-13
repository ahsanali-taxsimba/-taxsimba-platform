"""Widget HTML/CSS/JS accessibility and TaxSimba branding assertions."""

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
        ("css/concierge.css", "focus-visible"),
        ("css/concierge.css", "#006b3c"),
        ("css/concierge.css", "#078a4b"),
        ("css/concierge.css", "Manrope"),
        ("css/concierge.css", "Public Sans"),
        ("js/concierge.js", "ts-mock-banner"),
        ("js/concierge.js", "/api/v1/sessions/delete"),
        ("js/concierge.js", "Preparing a reply"),
        ("embed.js", "focus-visible"),
        ("embed.js", "Ask SIMBA"),
        ("embed.js", "aria-expanded"),
        ("embed.js", "Escape"),
        ("preview.html", "SIMBA AI"),
        ("assets/taxsimba-logo.svg", "<svg"),
    ],
    ids=[
        "html-aria-label",
        "html-live",
        "html-delete",
        "html-logo",
        "css-focus",
        "css-primary",
        "css-action",
        "css-manrope",
        "css-public-sans",
        "js-mock-banner",
        "js-delete-api",
        "js-static-loading",
        "embed-focus",
        "embed-brand",
        "embed-aria",
        "embed-escape",
        "preview-brand",
        "logo-svg",
    ],
)
def test_widget_file_contains_accessibility_marker(file, needle):
    content = _read(file)
    assert needle.lower() in content.lower()


def test_simba_ai_branding_in_index():
    html = _read("index.html")
    assert "SIMBA AI" in html
    assert "Your UK Tax Assistant" in html
    assert "taxsimba-logo.svg" in html


def test_taxsimba_brand_tokens_in_stylesheet():
    css = _read("css/concierge.css").lower()
    assert "--ts-primary: #006b3c" in css
    assert "--ts-primary-action: #078a4b" in css
    assert "manrope" in css
    assert "public sans" in css
    # Must not keep the invented emerald/gold mascot palette as primary tokens
    assert "--simba-emerald" not in css
    assert "#c6a75e" not in css


def test_no_lion_mascot_in_primary_ui():
    html = _read("index.html").lower()
    css = _read("css/concierge.css").lower()
    embed = _read("embed.js").lower()
    assert "simba-emblem.svg" not in html
    assert "simba-emblem.svg" not in embed
    assert "lion" not in css
    assert "@keyframes ts-bounce" not in css
