# SIMBA V2 — Final Corrections & Complete Verification Report

**Repository:** `ahsanali-taxsimba/-taxsimba-platform`  
**Branch:** `cursor/simba-v2-final-corrected-6522`  
**PR:** [#39](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/39)  
**Production status:** **HOLD — NO-GO**  
**Staging handoff:** **GO for Toxel** on the tip SHA below  

Classification legend: **IMPLEMENTED** · **MOCK TESTED** · **REAL API TESTED** · **STAGING VERIFIED** · **DEVICE VERIFIED** · **BLOCKED** · **FAILED**

---

## 1. Exact final commit SHA

Tip SHA: `eef3dd714a163fe36ce6f05db6d08793ad9d32d1`  
This report’s verification was run against the working tree that becomes that tip.

## 2. PR #39 confirmation

All corrections and evidence in this pass are committed and pushed to  
`cursor/simba-v2-final-corrected-6522` for PR #39. No new branch. No merge to `main`.

## 3. Summary of the previous ~21-file master implementation

Already on this branch before this pass (preserved):

- Long-conversation fix (`packConversationHistory`, 40 recent + memory, session cap 120, rate limit 90/min)
- Personalised package cards (`recommended`, `choose_url`, green badge UI)
- Lead capture API + outbox notifications
- Consultation honesty UX (options → booking; no free callbacks)
- Tax accuracy / MTD deterministic guards + master suite evidence
- Responsive evidence pack + OpenAI model comparison (`gpt-4o-mini` retained)
- HMRC monitor pipeline code (scheduler not enabled in this environment)

## 4. New corrections in this pass

### 4.1 Calendly-integrated payment (no separate Stripe checkout for consultations)

**Status:** **IMPLEMENTED** (copy + wiring + per-tier URLs) · live booking **BLOCKED**

- Customer journey copy now: choose option → matching Calendly event → pay **within Calendly** → Google Meet after Calendly confirmation.
- Removed “separate Stripe Checkout page” as the consultation payment path.
- Added per-tier env URLs: `CONSULTATION_BOOKING_URL_99`, `CONSULTATION_BOOKING_URL_149` (fallback `CONSULTATION_BOOKING_URL`).
- Public config exposes `consultation_payment: "calendly_integrated"` and per-code booking URLs when live.
- Widget “Book consultation” buttons open the matching Calendly URL when live; otherwise honest **Online booking unavailable**.
- Live Calendly credentials / events / payment provider are **not** configured here → booking remains disabled; **not** marked VERIFIED.

### 4.2 Mobile header Menu + drawer

**Status:** **IMPLEMENTED** · browser-emulation verified · physical device **BLOCKED**

- Root cause of “–Op…”: (1) missing `.visually-hidden` previously exposed “Open navigation”; (2) `.ts-brand span { display:none }` hid hamburger + Menu label on ≤375px.
- Fix: visible **hamburger + Menu** label; `.ts-brand-text span` scoped subtitle hiding only.
- Polished drawer with Close control, backdrop dismiss, Escape, focus return; chat state preserved.
- Removed duplicative horizontal mobile tab strip (`ts-mobile-nav`).
- Evidence: `screenshots/final_corrections/` + `mobile_menu_interaction.webm`.

---

## 5. Actual test commands and results

```bash
cd ai-tax-concierge-v2/backend-node
npm test -- --run          # 521/521 passed
npm run typecheck          # pass
PORT=8091 npm run start:dev
# Live probes against http://127.0.0.1:8091
node scripts/captureFinalCorrectionsEvidence.mjs
```

| Check | Result |
|-------|--------|
| Vitest full | **521/521 PASS** |
| Typecheck | **PASS** |
| SA £28k recommendation (live OpenAI) | SA_SIMPLE recommended £119, `choose_url` → `/self-assessment` |
| Consultation options (live) | Calendly-integrated payment copy; asks which option |
| Lead POST | Saved; `notification_channel=outbox_file` (SMTP not configured) |
| HMRC monitor on boot | `hmrc_monitor=off` (scheduler not enabled) |

---

## 6. Real 20- and 50-question transcripts

**Status:** **REAL API TESTED** (prior pass on this branch; still valid — history packing unchanged this pass)

| Artifact | Result |
|----------|--------|
| `evidence/long_conversation_20.json` | 20 turns, 0 failures, memory recalled £32k salary |
| `evidence/long_conversation_50.json` | 50 turns, 0 failures, memory retained |
| `evidence/long_conversation_summary.json` | `obtained_via: real_openai_api`, model `gpt-4o-mini` |

**Root cause of ~7–8 turn production freeze:** client/server `history.slice(-12)` truncation. Fixed via `packConversationHistory` + larger session buffer. Reproduced locally pre-fix; post-fix continuous 20/50 sessions succeed.

---

## 7. Personalised recommendation screenshots

**Status:** **IMPLEMENTED** + **REAL API TESTED** (running app)

Directory: `screenshots/final_corrections/`

| File | Shows |
|------|-------|
| `desktop_sa_simple_recommendation.png` | SA Simple £119 “Recommended for you” + Choose this package |
| `desktop_sa_complex_recommendation.png` | Complex multi-income SA recommendation |
| `desktop_mtd_comply_recommendation.png` | MTD / Simbian recommendation |
| `mobile390_sa_recommendation_cards.png` | Mobile SA cards |
| `mobile390_mtd_recommendation_cards.png` | Mobile MTD cards |
| `desktop_welcome.png` / `tablet768_welcome.png` | Welcome |

Approved prices verified in catalogue tests: SA 119/149/299; MTD 29.99/59.99/89.99 VAT included.

---

## 8. Corrected mobile navigation screenshots

| File | Shows |
|------|-------|
| `01_mobile390_header_menu_button.png` | Hamburger + **Menu** (no “–Op…”) |
| `02_mobile390_drawer_all_items.png` | Full drawer + Close |
| `03_nav_guided.png` … `07_nav_faqs.png` | Each destination |
| `08_nav_chat_restored.png` | Chat restored |
| `09` / `10` | Outside-tap close |
| `menu_closed_header_{360,375,390,430}.png` | Header at required widths |
| `menu_drawer_open_{360,375,390,430}.png` | Drawer open |
| `mobile_menu_interaction.webm` | Browser recording of interaction |

Physical iPhone Safari / Android: **BLOCKED** for Toxel.

---

## 9. Calendly payment and booking integration status

| Item | Status |
|------|--------|
| Copy & UX for Calendly-integrated payment | **IMPLEMENTED** |
| Per-tier Calendly URL config | **IMPLEMENTED** |
| Honest unavailable buttons when not live | **IMPLEMENTED** + **MOCK TESTED** |
| Real Calendly event URLs configured | **BLOCKED** |
| Calendly payment provider (Stripe/PayPal *inside* Calendly) | **BLOCKED** |
| Availability / failed payment / cancel / reschedule E2E | **BLOCKED** |
| Google Meet confirmation delivery | **BLOCKED** |
| Desktop/mobile live booking | **BLOCKED** |

**Do not set `CONSULTATION_BOOKING_LIVE=true` until Toxel completes real E2E.**

---

## 10. Lead-capture and email delivery evidence

**Status:** storage **IMPLEMENTED** + **MOCK TESTED** · SMTP inbox delivery **BLOCKED**

- API: `POST /api/v1/leads` with `follow_up_permission` required.
- This pass test lead `e0043c2e-670a-4e35-aba1-85b26ea68d0b` → `notification_channel: outbox_file`.
- Outbox sample fields: name, email, service interest, summary, session, permission note.
- No live SMTP credentials → **no real inbox delivery** claimed.
- Screenshots: `desktop_lead_capture.png`.

---

## 11. HMRC monitoring evidence

**Status:** code **IMPLEMENTED** + unit **MOCK TESTED** · operational scheduler **BLOCKED**

Boot log this environment:

```text
Dynamic systems: hmrc_monitor=off catalogue_sync=off
```

Health payload: `hmrc_monitor_enabled: false`, `ops_token_configured: false`.

Not claimed operational. Toxel must enable `CONCIERGE_HMRC_MONITOR_ENABLED`, interval, and ops token on staging, then verify change detection → approval gates → knowledge sync.

---

## 12. Tax accuracy verification results

**Status:** **IMPLEMENTED** + **MOCK TESTED** + **REAL API TESTED** (selective live MTD)

| Suite | Result | Classification |
|-------|--------|----------------|
| Master scenarios | 537/537 (prior) | MOCK + deterministic |
| Tax intelligence | 152 tests in Vitest | MOCK TESTED |
| Live MTD boundaries | 8/8 (prior evidence) | REAL API TESTED |
| Vitest this pass | 521/521 | MOCK/integration |
| Unresolved critical tax-rule fails | **0 known** | — |

Detail: `evidence/TAX_ACCURACY_VERIFICATION_REPORT.md`.  
Never claim absolute accuracy; high-risk gaps escalate to consultation / GOV.UK.

---

## 13. Registration-to-dashboard evidence

**Status:** links **IMPLEMENTED** · portal E2E **BLOCKED**

- “Choose this package” → approved TaxSimba routes (`/self-assessment`, `/making-tax-digital`).
- SIMBA does not claim to file with HMRC; TaxCalc (SA) / Xero (MTD) workflows are accountant-led.
- Registration → email verify → payment → dashboard: **not** executed end-to-end here (**BLOCKED** for Toxel staging).

---

## 14. Security and recovery tests

**Status:** **IMPLEMENTED** + **MOCK TESTED**

- Prior security evidence: `evidence/SECURITY_VERIFICATION.md`
- No invented booking/payment success when Calendly stubbed
- Lead permission gate; duplicate fingerprinting
- Chat rate limit raised for long sessions (still rate-limited)

---

## 15. OpenAI model comparison evidence

**Status:** **REAL API TESTED** (prior) · model **unchanged** (`gpt-4o-mini`)

- `evidence/model_comparison/` — both `gpt-4o-mini` and `gpt-4o` 32/32 with 0 critical fails.
- Recommendation remains: keep `gpt-4o-mini` (cost) with deterministic engine guards.

---

## 16. Outstanding blockers

1. Live Calendly events + Calendly payment integration + Meet confirmation E2E  
2. SMTP for lead notifications to TaxSimba inbox  
3. HMRC monitor scheduler + ops token on staging  
4. Portal registration → verify → payment → dashboard E2E  
5. Physical iPhone Safari / Android keyboard & scroll  
6. Owner accountant sign-off to lift PRODUCTION HOLD  

---

## 17. Exact configuration required from Toxel

```bash
# Per-tier Calendly event URLs (payment collected INSIDE Calendly — do not add a separate Stripe Checkout for consultations)
CONSULTATION_BOOKING_URL_99=https://calendly.com/<org>/<quick-99-event>
CONSULTATION_BOOKING_URL_149=https://calendly.com/<org>/<extended-149-event>
# Only after real E2E payment + Meet confirmation succeeds:
CONSULTATION_BOOKING_LIVE=true

# Lead email delivery
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
LEADS_NOTIFY_TO=info@taxsimba.co.uk

# HMRC monitor (staging ops)
CONCIERGE_HMRC_MONITOR_ENABLED=true
CONCIERGE_HMRC_MONITOR_INTERVAL_MS=21600000
CONCIERGE_OPS_TOKEN=<secure-token>

# Existing
OPENAI_API_KEY=...
WEBSITE_BASE_URL=https://www.taxsimba.co.uk
CONCIERGE_ENV=staging
```

Calendly event setup checklist for Toxel:

1. Create Quick (£99 / 20 min) and Extended (£149 / 40 min) events with Google Meet.  
2. Enable Calendly’s supported payment integration for those amounts.  
3. Confirm appointment only after payment conditions are satisfied.  
4. Wire the two event URLs into the env vars above.  
5. Test success, failed payment, no availability, cancel, reschedule on desktop and mobile.  
6. Only then set `CONSULTATION_BOOKING_LIVE=true`.

---

## 18. Requirements-to-evidence matrix (this pass)

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Calendly-integrated consultation payment | **IMPLEMENTED**; live E2E **BLOCKED** | `consultation_booking.ts`, widget consult panel, settings URLs |
| 2 | Mobile Menu + drawer | **IMPLEMENTED**; emulation verified; device **BLOCKED** | `screenshots/final_corrections/*`, webm |
| 3 | Personalised package cards | **IMPLEMENTED** + **REAL API TESTED** | desktop/mobile recommendation PNGs; API probe |
| 4 | Long chat 20/50 | **REAL API TESTED** | `long_conversation_*.json` |
| 5 | HMRC automatic updates operational | Code **IMPLEMENTED**; ops **BLOCKED** | health `hmrc_monitor_enabled:false` |
| 6 | Tax accuracy system controls | **IMPLEMENTED** + suites PASS | accuracy report; 521 Vitest |
| 7 | Lead capture + inbox notify | Capture **IMPLEMENTED**; SMTP **BLOCKED** | outbox lead + API |
| 8 | Registration → dashboard | Links only; E2E **BLOCKED** | choose_url routes |
| 9 | Readable visual proof | **IMPLEMENTED** (browser) | `final_corrections/` |
| 10 | Physical devices | **BLOCKED** | Toxel |
| 11 | Production | **HOLD** | Owner approval |

Full matrix file also updated: `REQUIREMENTS_TO_EVIDENCE_MATRIX.md`.

---

## 19. Final production GO / NO-GO

**NO-GO for production / main.**  

**GO for HTTPS staging handoff to Toxel** using this PR tip, with blockers in §16 completed before any production consideration.

Critical product defects addressed in this branch (history truncation, consultation honesty, Menu truncation, Calendly payment model) are fixed and evidenced. External integrations remain honestly **BLOCKED** until Toxel verifies them live.
