# Emerald Signature — implementation evidence

**Date:** 2026-11-13 (Europe/London) · **PR #35** · Scope: `ai-tax-concierge-v2/` only

## Visual comparison vs approved concept

| Concept element | Implementation | Difference / why |
|-----------------|----------------|------------------|
| Emerald header | Gradient `#006B3C` → `#004D2C` | Deep emerald used as **header support only**; primary/action tokens unchanged |
| TaxSimba logo | Official SVG in white chip | Concept may show white wordmark; chip preserves official green logo asset without recolouring |
| Six topic cards + icons | Self Assessment, MTD, Landlords, Freelancers & CIS, VAT, Calculators | Static stroke icons (no mascots) |
| Suggested questions | Three chips under topics | Limited to avoid clutter |
| Conversation-first | Welcome clears after topic/message; Topics button returns | Matches “do not permanently crowd” requirement |
| Response cards | Max 2 sources, 2 tools, 1 route, 3 packages, 2 follow-ups | Concept may show denser cards — reduced for clarity |
| Typography | Manrope + Public Sans | Matches verified TaxSimba portal tokens |
| No gold / neon / glow | Confirmed in CSS | Intentional |

## Changed files (this phase)

- `widget/css/concierge.css` — Emerald Signature tokens & layout
- `widget/index.html` — emerald header + Topics control
- `widget/js/concierge.js` — topic cards, conversation view, decluttered replies
- `widget/embed.js` — launcher polish
- `widget/preview.html` — sandbox host
- `backend/app/ai/prompts.py` — circumstance-first clarifying rules
- `backend/tests/test_accessibility_widget.py`
- Screenshots under `docs/verification/screenshots/`

**Unrelated website pages:** not modified.

## Functional verification (local preview)

| Check | Result |
|-------|--------|
| Launcher open/close + Escape | PASS |
| Topic buttons → conversation | PASS |
| Free-text chat | PASS |
| Multi-turn / journey options | PASS |
| Source + calculator links (live_verified) | PASS |
| Mobile 375 / 390 / 430 no horizontal overflow | PASS |
| No auto-popup | PASS |
| No-pressure path (existing tests) | PASS |
| Stripe / Calendly / portal E2E | BLOCKED |
| Website staging embed | BLOCKED |

## Automated tests

`pytest -q` → **201 passed / 0 failed**

## Staging readiness

| Layer | Status |
|-------|--------|
| Implemented locally | YES |
| Verified in local preview | YES |
| Verified on website staging | NO — BLOCKED |
| Ready for controlled Toxel staging after visual approval | YES (embed only) |
| Production | NO |
