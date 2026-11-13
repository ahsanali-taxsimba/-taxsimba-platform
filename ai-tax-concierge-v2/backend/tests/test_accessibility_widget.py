"""Widget HTML/CSS/JS accessibility and SIMBA branding assertions."""

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
        ("css/concierge.css", "focus-visible"),
        ("css/concierge.css", "#0b3d2e"),
        ("js/concierge.js", "ts-mock-banner"),
        ("js/concierge.js", "/api/v1/sessions/delete"),
        ("embed.js", "focus-visible"),
        ("embed.js", "Ask SIMBA"),
        ("embed.js", "aria-expanded"),
        ("preview.html", "SIMBA AI"),
        ("assets/simba-emblem.svg", "temporary emblem placeholder"),
    ],
    ids=[
        "html-aria-label",
        "html-live",
        "html-delete",
        "css-focus",
        "css-emerald",
        "js-mock-banner",
        "js-delete-api",
        "embed-focus",
        "embed-brand",
        "embed-aria",
        "preview-brand",
        "emblem-placeholder",
    ],
)
def test_widget_file_contains_accessibility_marker(file, needle):
    content = _read(file).lower() if file.endswith(".svg") else _read(file)
    assert needle.lower() in content.lower()


def test_simba_ai_branding_in_index():
    html = _read("index.html")
    assert "SIMBA AI" in html
    assert "Your UK Tax Assistant" in html


def test_emerald_brand_token_in_stylesheet():
    css = _read("css/concierge.css")
    assert "--simba-emerald" in css
    assert "#0b3d2e" in css.lower()


def test_emblem_svg_uses_emerald_fill():
    svg = _read("assets/simba-emblem.svg")
    assert "#0B3D2E" in svg.upper() or "#0b3d2e" in svg.lower()
