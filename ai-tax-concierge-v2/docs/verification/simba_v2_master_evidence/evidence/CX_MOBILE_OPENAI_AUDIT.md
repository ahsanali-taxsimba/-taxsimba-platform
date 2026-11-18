# SIMBA V2 — Customer experience, mobile & OpenAI audit

**Date:** 2026-11-18 (Europe/London)  
**Branch:** `cursor/simba-v2-final-corrected-6522`  
**PR:** https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/39  
**Production:** HOLD

## 1. Consultation booking correction

**Status:** Corrected in product copy + UI + tests.

- Standard journey: explain options → customer selects → Calendly → Stripe → Google Meet after confirmation.
- Email `info@taxsimba.co.uk` only for general enquiries / when booking unavailable — not default booking method.
- UI: Select this option + honest “Online booking unavailable” when `CONSULTATION_BOOKING_LIVE` is false.
- Code: `src/knowledge/consultation_booking.ts`, engine wiring, widget consultation panel, prompts/recommendations.
- Tests: `tests/consultation_booking.test.ts` PASS.
- Toxel must complete: real Calendly URLs per tier, Stripe Checkout, Meet link issuance, set `CONSULTATION_BOOKING_LIVE=true` only after E2E verification.

## 2. Mobile responsive audit

**Method:** Chrome headless CDP device metrics — **browser emulation**. Physical iPhone Safari: **BLOCKED**.

Screenshots: `screenshots/responsive/` (18 PNG files) including 360/375/390/430/768/1280/1440 and consultations panel.

Findings:
- Branding, welcome, AI disclosure, input/Send present.
- Mobile uses horizontal nav pills; sidebar drawer — does not permanently consume chat width.
- No horizontal overflow observed on audited welcome/consult views.
- Consultation cards show correct prices and unavailable booking honesty.

## 3. Mobile scrolling

Scroll stick-to-bottom + Jump to latest remain in widget JS. Emulated scroll top/bottom captures attempted; physical keyboard/Safari: **BLOCKED for Toxel**.

## 4. Conversation readability

Prompt rules already prefer 40–120 words, answer-first, one follow-up. Consultation/clarifier paths shortened away from email-as-default. Open-ended samples in model comparison folder.

## 5. Model comparison

See `evidence/model_comparison/MODEL_COMPARISON_REPORT.md`.
**Recommendation:** keep `gpt-4o-mini` (no auto-switch).

## 6. Conversion journeys A–E

Live transcripts: `evidence/conversion_journeys_AE.json`  
Visual: `screenshots/responsive/journeys_AE_*.png`, `widget/conversion_journeys_evidence.html`

## Remaining staging dependencies

- Physical iPhone Safari scroll/keyboard
- Stripe + Calendly + Meet E2E
- Portal registration/checkout handoff
- Owner/accountant acceptance before lifting HOLD
