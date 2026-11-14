#!/usr/bin/env python3
"""Capture final acceptance screenshots from the running SIMBA widget."""
from __future__ import annotations

import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "verification" / "screenshots"
ARTIFACTS = Path("/opt/cursor/artifacts")
BASE = "http://127.0.0.1:8090"
PANEL = f"{BASE}/widget/index.html?api={BASE}"
PREVIEW = f"{BASE}/widget/preview.html"

SHOTS.mkdir(parents=True, exist_ok=True)
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def save(page, name: str) -> None:
    dest = SHOTS / name
    page.screenshot(path=str(dest), full_page=False)
    art = ARTIFACTS / name
    art.write_bytes(dest.read_bytes())
    print(f"saved {name}")


def open_panel(page, panel: str) -> None:
    page.locator(f'.ts-nav-item[data-panel="{panel}"]').first.click()
    page.wait_for_timeout(450)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Desktop embed: launcher closed
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.goto(PREVIEW, wait_until="networkidle")
        page.wait_for_timeout(800)
        save(page, "simba-desktop-launcher-closed.png")
        page.locator("#ts-simba-launcher, .ts-simba-launcher, button").filter(has_text="Ask SIMBA").first.click()
        page.wait_for_timeout(1000)
        save(page, "simba-desktop-launcher-open.png")
        frame = page.frame_locator("iframe.ts-simba-frame, iframe").first
        frame.locator("#ts-body, .ts-workspace").first.wait_for(timeout=15000)
        save(page, "simba-desktop-embed-welcome.png")
        ctx.close()

        # Desktop full panel
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.goto(PANEL, wait_until="networkidle")
        page.locator("#ts-body").wait_for(timeout=15000)
        page.wait_for_timeout(1200)
        save(page, "simba-desktop-sidebar-welcome.png")
        save(page, "simba-desktop-workspace-sidebar.png")
        save(page, "simba-desktop-welcome.png")

        page.fill("#ts-input", "What is the VAT registration threshold and how does the rolling 12-month test work?")
        page.click("#ts-send")
        page.wait_for_selector(".ts-msg-assistant, .ts-bubble-assistant, .ts-msg.assistant", timeout=60000)
        page.wait_for_timeout(2500)
        save(page, "simba-desktop-conversation.png")
        save(page, "simba-desktop-long-answer.png")
        save(page, "simba-desktop-workspace-chat.png")

        open_panel(page, "guided")
        page.wait_for_timeout(600)
        save(page, "simba-desktop-guided-panel.png")

        open_panel(page, "calculators")
        page.wait_for_timeout(600)
        save(page, "simba-desktop-calculators-panel.png")

        open_panel(page, "packages")
        page.wait_for_timeout(600)
        save(page, "simba-desktop-packages-panel.png")

        open_panel(page, "consultation")
        page.wait_for_timeout(600)
        save(page, "simba-desktop-consultation-panel.png")

        open_panel(page, "faqs")
        page.wait_for_timeout(600)
        save(page, "simba-desktop-faqs-panel.png")

        # Force error state by aborting network then retry UX
        open_panel(page, "chat")
        page.route("**/api/v1/chat", lambda route: route.abort())
        page.fill("#ts-input", "Trigger a temporary API failure for evidence.")
        page.click("#ts-send")
        page.wait_for_timeout(1500)
        save(page, "simba-desktop-error-state.png")
        page.unroute("**/api/v1/chat")
        ctx.close()

        # Mobile 390
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.goto(PANEL, wait_until="networkidle")
        page.locator("#ts-body").wait_for(timeout=15000)
        page.wait_for_timeout(1200)
        save(page, "simba-mobile-welcome-390.png")
        save(page, "simba-mobile-workspace-welcome.png")
        save(page, "simba-mobile-chat-open.png")

        page.locator("#ts-nav-toggle").click()
        page.wait_for_timeout(500)
        save(page, "simba-mobile-sidebar-drawer.png")
        # Close drawer via Escape / toggle so mobile tabs are clickable again
        page.keyboard.press("Escape")
        page.wait_for_timeout(350)
        if page.locator(".ts-shell.nav-open").count():
            page.locator("#ts-nav-toggle").click()
            page.wait_for_timeout(350)
        page.evaluate("document.querySelector('.ts-shell')?.classList.remove('nav-open')")
        page.wait_for_timeout(200)

        page.locator('.ts-mnav[data-panel="packages"]').click(force=True)
        page.wait_for_timeout(600)
        save(page, "simba-mobile-packages.png")

        page.locator('.ts-mnav[data-panel="consultation"]').click(force=True)
        page.wait_for_timeout(600)
        save(page, "simba-mobile-consultation.png")

        page.locator('.ts-mnav[data-panel="chat"]').click(force=True)
        page.wait_for_timeout(400)
        page.fill("#ts-input", "I am a CIS subcontractor — what tax do I need to know about?")
        page.click("#ts-send")
        page.wait_for_selector(".ts-msg.assistant", timeout=60000)
        page.wait_for_timeout(2000)
        save(page, "simba-mobile-conversation-390.png")
        save(page, "simba-mobile-vat-chat.png")
        save(page, "simba-mobile-input-scroll-390.png")
        ctx.close()

        # Width variants
        for width, name in [(375, "simba-width-375-welcome.png"), (430, "simba-width-430-welcome.png")]:
            ctx = browser.new_context(viewport={"width": width, "height": 812}, is_mobile=True, has_touch=True)
            page = ctx.new_page()
            page.goto(PANEL, wait_until="networkidle")
            page.locator("#ts-body").wait_for(timeout=15000)
            page.wait_for_timeout(900)
            save(page, name)
            ctx.close()

        # Loading state (slow chat)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        def slow_chat(route):
            time.sleep(2.5)
            route.continue_()

        page.route("**/api/v1/chat", slow_chat)
        page.goto(PANEL, wait_until="networkidle")
        page.locator("#ts-body").wait_for(timeout=15000)
        page.fill("#ts-input", "Briefly explain payments on account.")
        page.click("#ts-send")
        page.wait_for_timeout(400)
        save(page, "simba-desktop-loading-state.png")
        page.wait_for_selector(".ts-msg-assistant, .ts-bubble-assistant, .ts-msg.assistant", timeout=60000)
        ctx.close()
        browser.close()
    print("DONE")


if __name__ == "__main__":
    main()
