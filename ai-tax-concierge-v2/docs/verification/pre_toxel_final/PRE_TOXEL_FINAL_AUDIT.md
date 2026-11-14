# SIMBA AI Tax Assistant — Final Pre-Toxel Audit

**Date:** 2026-11-13 (Europe/London)  
**Branch:** `cursor/ask-simba-launcher-welcome-6522` (feeds PR #35 / `cursor/ai-tax-concierge-v2-phase1-0f84`)  
**HOLD:** Do not merge PR #35 · do not deploy production · do not delete Python · do not activate live payments.

---

## Executive verdict

| Gate | Verdict |
|------|---------|
| Ready for Toxel **controlled HTTPS staging preparation** | **YES — PASS** (local Node + widget + tax/price grounding verified) |
| **Production-ready** | **NO — FAIL** (staging E2E, Stripe, Calendly, registration, live site embed, inclusions all BLOCKED) |

---

## What changed in this pass

1. Premium floating launcher: **Ask SIMBA** / **AI Tax Assistant** (`widget/embed.js`)
2. Session-dismissible white welcome card (exact copy; close persists via `sessionStorage`)
3. Compact chat panel (`widget/chat.html` + `css/chat-panel.css` + `js/chat-panel.js`) with five working actions
4. Full SIMBA workspace (`widget/index.html`) retained via expand / “Open full workspace”
5. Preview host page mirrors TaxSimba dark-green / £119 offer layout for embed QA (does **not** replace live site)
6. Automated tests for launcher, welcome dismiss, compact chat assets

---

## Test results (actual counts)

| Suite | Result |
|-------|--------|
| Vitest (full Node suite) | **450 passed** / 0 failed (23 files) |
| Live OpenAI verification | **33/33** single-turn · `accuracy_flagged_count: 0` · `all_live: true` |
| Security suite | **26 passed** |
| Privacy + recommendations | **8 passed** |
| Manual live probes (VAT £90k, MTD £50k/£30k, SA deadline, prices, Elite £299, consult £99, injection, complex) | **PASS** (see live chat transcripts in session logs) |
| OpenAI key in bootstrap/config/widget | **PASS** — no key leak |
| Node independent of Python process | **PASS** — health `llm_mode: openai` on `:8091` |
| Playwright mobile/desktop screenshots + e2e webm | **PASS** — real captures (not mocks) |

Vitest log excerpt: `Test Files 23 passed (23) · Tests 450 passed (450)`.  
Live OpenAI report: `docs/verification/live_openai_report_20261113T154937Z.json`.

---

## Evidence artefacts

| # | Artefact | Path |
|---|----------|------|
| 1 | Mobile before click (launcher + welcome) | `screenshots/01_mobile_before_click_launcher_welcome.png` |
| 2 | Mobile welcome card | `screenshots/02_mobile_welcome_card.png` |
| 3 | Mobile chat open (5 actions) | `screenshots/03_mobile_chat_open.png` |
| 4 | Desktop launcher + welcome | `screenshots/04_desktop_launcher_welcome.png` |
| 5 | Desktop chat open | `screenshots/05_desktop_chat_open.png` |
| 6 | Package recommendation journey | `screenshots/06_package_recommendation_journey.png` (+ `06b_desktop_choose_package.png`) |
| 7 | E2E demo video | `simba_pre_toxel_e2e_demo.webm` |
| 8 | Capture script | `backend-node/scripts/capture_pre_toxel_evidence.mjs` |

Copies also under `/opt/cursor/artifacts/`.

---

## PASS / FAIL / BLOCKED matrix

| Area | Status | Evidence / notes |
|------|--------|------------------|
| Ask SIMBA two-line launcher | **PASS** | Screenshots 01/04; embed tests |
| Welcome card copy + session dismiss | **PASS** | Screenshots 01/02/04; `simba_welcome_dismissed_v1` |
| Compact chat 5 actions | **PASS** | Screenshot 03; SA journey screenshot 06 hits `/api/v1/chat` |
| Close / expand / fullscreen workspace link | **PASS** | chat.html controls; expand → `/widget/index.html` |
| Persistent session conversation | **PASS** | `sessionStorage` history keys in chat-panel.js |
| Loading / error states | **PASS** | Loading bubble observed; error CSS/handlers present |
| Mobile drawer / desktop panel | **PASS** | Screenshots 03 / 05 |
| No mascots / unread badges | **PASS** | embed_launcher tests |
| Full workspace not replaced | **PASS** | index.html unchanged as primary workspace |
| VAT £90,000 grounding | **PASS** | Live chat + live OpenAI suite |
| MTD £50k from 6 Apr 2026 | **PASS** | Live probe |
| MTD £30k from 6 Apr 2027 | **PASS** | Live probe |
| SA deadlines / tax year | **PASS** | Live probe (2025-26 → 31 Jan 2027); health tax year 2026-27 |
| Prices SA £119/£149/£299 | **PASS** | Catalogue + live reply + screenshot 06 |
| MTD £29.99/£59.99/£89.99 VAT incl. | **PASS** | Catalogue API |
| Elite £299 (not £249) | **PASS** | Live probe + catalogue |
| Consultation £99 / 30 min | **PASS** | Catalogue + live (booking stub disclosed) |
| Inclusions not invented | **PASS** | `detailed_recommendations_status: blocked_pending_approved_inclusions` |
| Prompt-injection resistance | **PASS** | Live inject probe refused; security suite |
| No fabricated payment/booking success | **PASS** | Consult reply discloses stub |
| Node Express/TS production build | **PASS** | `npm run build` + `npm start` path |
| Secrets not in frontend | **PASS** | Probe |
| HTTPS staging deploy | **BLOCKED** | Needs Toxel infra / TLS |
| Live taxsimba.co.uk embed | **BLOCKED** | Staging only until signed |
| Stripe test checkout amounts | **BLOCKED** | Needs portal Stripe test keys + E2E |
| Calendly £99 + Google Meet | **BLOCKED** | `booking_status: stub` until URL + E2E |
| Registration / email verification | **BLOCKED** | Portal staging E2E |
| Authenticated dashboard messaging | **BLOCKED** | Portal staging E2E |
| Approved package inclusion wording | **BLOCKED** | Owner: TaxSimba/Toxel — supply form |
| Attached real mobile homepage image as pixel source | **BLOCKED** | No attachment found in workspace; preview uses known brand tokens + £119 offer layout |

---

## Remaining blockers (owners)

| Blocker | Owner |
|---------|-------|
| HTTPS staging host + reverse proxy to Node | **Toxel** |
| Embed script on staging website (not production) | **Toxel** |
| Stripe test-mode checkout + webhook amounts | **Toxel / portal** |
| Calendly event + `CONSULTATION_BOOKING_URL` | **Toxel** |
| Registration + email verification E2E | **Toxel / portal** |
| Authenticated dashboard handoff for existing clients | **Toxel / portal** |
| Approved SA/MTD inclusion catalogue text | **TaxSimba / Toxel** |
| Production cutover / Python retirement | **HOLD — do not proceed** |

Handover document: [`../../toxel/TOXEL_STAGING_HANDOVER.md`](../../toxel/TOXEL_STAGING_HANDOVER.md) · Embedding: [`../../toxel/EMBEDDING.md`](../../toxel/EMBEDDING.md)

---

## Staging readiness statement

**SIMBA (Node + Emerald widget + Ask SIMBA launcher) is ready for Toxel’s controlled HTTPS staging preparation.**  
**SIMBA is not production-ready.** Staging external integrations and inclusion approval remain BLOCKED until actually verified — do not fabricate those passes.
