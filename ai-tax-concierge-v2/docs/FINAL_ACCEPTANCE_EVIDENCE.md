# SIMBA AI Tax Concierge V2 — Final Acceptance Evidence

**Product:** SIMBA AI — Your UK Tax Assistant  
**Repository:** `ahsanali-taxsimba/-taxsimba-platform`  
**PR:** [#35](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/35)  
**Branch:** `cursor/ai-tax-concierge-v2-phase1-0f84`  
**Scope:** `ai-tax-concierge-v2/` only  
**Date:** 2026-11-13 (Europe/London)  
**Release gate:** **HOLD** — do not merge, do not deploy, not production-ready while external integrations remain BLOCKED.

> Evidence commit: 

---

## A. Complete original requirements checklist

Statuses: **PASS** · **PARTIAL** · **FAIL** · **BLOCKED** · **NOT TESTED**

| ID | Requirement | Status |
|----|-------------|--------|
| R1 | Isolated under `ai-tax-concierge-v2/`; no live website edits | PASS |
| R2 | Server-side OpenAI only; no browser secrets | PASS |
| R3 | Mock vs live clearly labelled | PASS |
| R4 | HMRC/GOV.UK grounding with dated sources | PASS |
| R5 | MTD £50k/2026, £30k/2027, £20k/2028; VAT £90k + timing tests | PASS |
| R6 | Helpful-first; no hard sell / no invented inclusions | PASS |
| R7 | Existing clients → dashboard messaging | PARTIAL (copy + journey; portal E2E BLOCKED) |
| R8 | SA packages £119 / £149 / £299 | PASS (catalogue prices) |
| R9 | MTD £29.99 / £59.99 / £89.99 VAT included | PASS (catalogue prices) |
| R10 | £99 / 30-min accountant consultation | PARTIAL (explained; Calendly/Stripe BLOCKED) |
| R11 | All 17 calculators linked (`live_verified`) | PASS (HTTP title checks) |
| R12 | Official TaxSimba logo; emerald `#006B3C` / `#078A4B`; no mascots/gold | PASS |
| R13 | Floating Ask SIMBA launcher; no auto-popup | PASS |
| R14 | Desktop left sidebar — 6 working sections + accountant/existing-client guidance | PASS |
| R15 | Mobile compact nav + drawer; conversation preserved | PASS (Playwright + screenshots) |
| R16 | Loading / retry / offline / timeout / error states | PASS (code + error/loading screenshots) |
| R17 | Natural-language Q&A, clarifying questions, context, British English | PASS (live harness) |
| R18 | Distinguish general info vs personalised advice; no HMRC endorsement claim | PASS |
| R19 | Analytics: engagement clicks ≠ verified conversions | PASS (allowlist + contract) |
| R20 | Stripe checkout E2E | BLOCKED |
| R21 | Calendly / Google Meet booking E2E | BLOCKED |
| R22 | Registration / email verify / dashboard E2E | BLOCKED |
| R23 | Staging HTTPS embed on taxsimba.co.uk | BLOCKED |
| R24 | Full screen-reader audit | NOT TESTED (keyboard/ARIA basics PASS) |
| R25 | DPIA / legal retention policy sign-off | NOT TESTED |

Detail matrix: `docs/verification/REQUIREMENTS_TRACEABILITY.md`

---

## B. Implemented functionality and evidence

### Backend / AI
- FastAPI app, OpenAI adapter (`gpt-4o-mini`), mock fallback, rate limit, injection scrubbing, token budget
- Knowledge corpus + TF-IDF grounding + grounding guard
- Guided journeys (SA, MTD, landlords, freelancers, CIS, VAT, existing client, etc.)
- Packages / calculators / routes catalogues

### Widget / UX
- Emerald Signature UI (Manrope + Public Sans, official logo)
- `embed.js` floating launcher
- Desktop workspace sidebar; mobile nav + drawer; Escape closes drawer
- Panels: Chat, Guided Help, Calculators, Packages, Consultation, FAQs, Existing-client guidance
- AbortController timeout/offline messaging; loading and error UI

### Screenshots (running software)
Directory: `docs/verification/screenshots/` (also copied under `/opt/cursor/artifacts/`)

| Evidence | File |
|----------|------|
| Desktop launcher closed | `simba-desktop-launcher-closed.png` |
| Desktop launcher / embed open | `simba-desktop-launcher-open.png`, `simba-desktop-embed-welcome.png` |
| Desktop sidebar + welcome | `simba-desktop-sidebar-welcome.png`, `simba-desktop-workspace-sidebar.png` |
| Guided conversation / long grounded answer | `simba-desktop-conversation.png`, `simba-desktop-long-answer.png` |
| Calculators | `simba-desktop-calculators-panel.png` |
| Packages | `simba-desktop-packages-panel.png`, `simba-desktop-packages-full.png` |
| Consultation | `simba-desktop-consultation-panel.png` |
| FAQs | `simba-desktop-faqs-panel.png` |
| Loading / error | `simba-desktop-loading-state.png`, `simba-desktop-error-state.png` |
| Mobile welcome / nav / drawer | `simba-mobile-welcome-390.png`, `simba-mobile-sidebar-drawer.png` |
| Mobile packages / consultation / chat | `simba-mobile-packages.png`, `simba-mobile-consultation.png`, `simba-mobile-conversation-390.png` |
| Width 375 / 430 | `simba-width-375-welcome.png`, `simba-width-430-welcome.png` |

### Screen recordings
| Recording | Path |
|-----------|------|
| Playwright visitor journey (launcher → VAT Q&A → sidebar sections) | `docs/verification/recordings/simba_visitor_journey_demo.webm` · `/opt/cursor/artifacts/simba_visitor_journey_demo.webm` |
| GUI workspace navigation (manual computer-use session) | `/opt/cursor/artifacts/simba_gui_workspace_navigation.mp4` (artifact; not committed to git due to size) |

---

## C. Missing or partial requirements

| Item | Status | Notes |
|------|--------|-------|
| Verified Stripe purchase | BLOCKED | Stub adapter only; clicks ≠ paid |
| Verified Calendly booking | BLOCKED | Booking URL stub until Toxel configures event |
| Registration / email verify | BLOCKED | No staging portal credentials |
| Authenticated existing-client messaging | BLOCKED | Guidance copy only |
| Soft website routes (`/faqs`, `/book-consultation`, `/articles`, …) | PARTIAL | Titles soft/generic — confirm with Toxel |
| Package **inclusions** text | PARTIAL | Prices configured; inclusions explicitly `not_specified_in_catalog` |
| Durable analytics / CRM | PARTIAL | In-memory engagement only |
| Full SR / WCAG audit | NOT TESTED | |

---

## D. Automated and live AI test results

### Automated (mock / unit / integration)
```text
cd ai-tax-concierge-v2/backend && source .venv/bin/activate
pytest -q
# Result 2026-11-13: 212 passed in 0.81s
```
Log: `/tmp/simba_final_pytest.txt`

### Live OpenAI (mock disabled)
```text
export CONCIERGE_FORCE_MOCK_LLM=false
python scripts/live_openai_verification.py
```
| Metric | Result |
|--------|--------|
| Report | `docs/verification/live_openai_report_20261113T062823Z.json` (also `live_openai_report_latest.json`) |
| Connectivity | OK · model `gpt-4o-mini` · key present (length logged only) |
| Single-turn cases | **33 / 33 live** |
| Accuracy flags | **0** |
| Multi-turn | 3 cases included in harness |

**Not claimed as payment/booking/registration success.** Mock tests are separate from live OpenAI.

---

## E. Real screenshots and screen recording

See section **B**. Capture script: `scripts/capture_final_evidence.py` against `http://127.0.0.1:8090` with `llm_mode=openai`.

Health at capture time:
```json
{"status":"ok","version":"0.3.0","phase":3,"product":"SIMBA AI","llm_mode":"openai","current_tax_year":"2026-27","mock_notice":null}
```

---

## F. Security and privacy review

Summary from `docs/verification/SECURITY_PRIVACY_REVIEW.md`:

| Control | Status |
|---------|--------|
| OpenAI key server-only | PASS |
| No secrets in widget/embed | PASS |
| Prompt-injection resistance | PASS |
| Rate limiting + token budget | PASS |
| Session delete / isolation | PASS |
| Analytics PII scrub + click≠conversion | PASS |
| Payment / booking authenticity | BLOCKED (no live path) |
| DPIA / production WAF | NOT TESTED |

---

## G. Verified prices, tax rules and links

### Prices (catalogue — confirm inclusions with TaxSimba before purchase claims)
| Offer | Configured price |
|-------|------------------|
| SA Simple / Smart / Elite | £119 / £149 / £299 per tax year |
| MTD Starter / Growth / Complete | £29.99 / £59.99 / £89.99 per month, VAT included |
| Private accountant consultation | £99 / 30 minutes |

### Tax rules checked in corpus + live harness
| Rule | Configured figure | Official reference basis |
|------|-------------------|--------------------------|
| VAT registration threshold | £90,000 | GOV.UK VAT registration guidance |
| VAT rolling 12-month + 30-day forward look | In corpus + live VAT answers | GOV.UK timing guidance |
| MTD ITSA >£50k | from 6 April 2026 | GOV.UK MTD for Income Tax |
| MTD ITSA >£30k | from 6 April 2027 | GOV.UK |
| MTD ITSA >£20k | from 6 April 2028 (subject to legislation) | GOV.UK |
| SA online deadline pattern | 31 January following tax year | GOV.UK Self Assessment deadlines |
| Personal Allowance (referenced) | £12,570 (2024-25 fact retained) | GOV.UK |

### Calculators
- 17 items in `backend/app/catalog/calculators.json` with `url_status: live_verified`

### Website destinations
- Live-verified service pages include Self Assessment, MTD, pricing (see journey matrix)
- Soft/generic: FAQs / book-consultation / articles / register / login until Toxel confirms

---

## H. Real customer conversion journeys

Layers: **L1** conversation · **L2** configured link · **L3** public page · **L4** staging transaction

| Journey | L1 | L2 | L3 | L4 |
|---------|----|----|----|----|
| Understand SA → packages → register/pay | PASS | PASS | PASS (pricing/SA pages) | **BLOCKED** |
| MTD eligibility → MTD plans → checkout | PASS | PASS | PASS | **BLOCKED** |
| Calculator recommendation → calculator page | PASS | PASS | PASS (17) | N/A |
| £99 consultation explain → book | PASS | PARTIAL | soft | **BLOCKED** |
| Existing client → dashboard message | PASS (guidance) | stub | **BLOCKED** | **BLOCKED** |
| Helpful-first (won’t buy) | PASS | N/A | N/A | N/A |

Full matrix: `docs/verification/CUSTOMER_JOURNEY_MATRIX.md`

---

## I. Outstanding Toxel integration dependencies

1. HTTPS staging host for API + widget embed (iPhone URL)
2. Secure `OPENAI_API_KEY` in staging secret store (never commit)
3. Stripe test checkout + webhook → verified conversion events only
4. Calendly £99 / 30-min Google Meet event URL + booking verification
5. Portal staging: registration, email verify, existing-client dashboard messaging
6. Confirm soft routes and package **inclusions** copy
7. Durable analytics sink (do not invent a competing CRM)
8. Human accountant spot-check of material tax answers before any wider launch
9. Rollback plan on staging (see `docs/toxel/DEPLOYMENT_CHECKLIST.md`)

Handover pack: `docs/toxel/HANDOVER.md`, `EMBEDDING.md`, `INTEGRATION_CONTRACTS.md`, `SECURITY_CHECKLIST.md`, `STAGING_IPHONE.md`

---

## J. Final PASS / FAIL / BLOCKED status

| Area | Status |
|------|--------|
| Isolated SIMBA package + Emerald Signature UI + sidebar | **PASS** |
| Live OpenAI grounded answers (33 cases, 0 accuracy flags) | **PASS** |
| Tax threshold / VAT / MTD fixtures + guard | **PASS** |
| 17 calculator destinations | **PASS** |
| Package & consultation **price** display | **PASS** |
| Analytics honesty (clicks ≠ conversions) | **PASS** |
| Security basics (key isolation, injection, rate limit) | **PASS** |
| Stripe / Calendly / registration / dashboard E2E | **BLOCKED** |
| Staging website embed | **BLOCKED** |
| **Overall release** | **HOLD — FAIL for production; PASS for controlled staging prep after Toxel wiring** |

---

## K. Exact commit SHA and reproducible verification steps

**Commit SHA:** 

### Reproduce locally
```bash
cd ai-tax-concierge-v2/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=***          # server-side only
export CONCIERGE_FORCE_MOCK_LLM=false
uvicorn app.main:app --host 127.0.0.1 --port 8090

# Terminal A — automated
pytest -q

# Terminal B — live OpenAI
python scripts/live_openai_verification.py

# Terminal C — UI evidence
python ../scripts/capture_final_evidence.py
# Preview: http://127.0.0.1:8090/widget/preview.html
# Panel:   http://127.0.0.1:8090/widget/index.html
```

### Redacted live API evidence
- Key present: yes · length: 164 · prefix shape: sk-like  
- Endpoint: `https://api.openai.com/v1/chat/completions`  
- Model: `gpt-4o-mini`  
- **No raw API key in logs, screenshots, or this document.**

---

## L. Recommendation for controlled staging (with limitations)

**Recommend:** proceed to **Toxel-controlled staging embed only** after visual approval.

**Do not:** merge to production, deploy to live taxsimba.co.uk, or declare production-ready.

**Limitations to state explicitly to stakeholders:**
- Payment, booking, registration and authenticated portal journeys are **not proven**
- Soft website routes need confirmation
- Package inclusions must be confirmed by TaxSimba before marketing claims
- In-memory analytics/sessions are not production durability
- Full accessibility / legal DPIA sign-off is outstanding

**Cursor / this PR proves:** isolated product, premium UI, live grounded AI, catalogues, security basics, and local evidence.  
**Toxel must prove:** staging host, Stripe, Calendly, portal auth, and end-to-end conversion authenticity.

---

## Defect log (this final pass)

| Defect | Resolution | Regression |
|--------|------------|------------|
| Engagement analytics incomplete / conversion ambiguity | Allowlisted track events; response note “not a verified conversion”; widget tracks launcher/conversation/panel/calculator clicks | 212 pytest PASS |
| Weak timeout/offline UX | `AbortController` + offline/timeout messages in `concierge.js` | Manual error/loading screenshots |
| Mobile drawer Escape not wired | `keydown` Escape closes `nav-open` | Capture script + pytest PASS |
| Accidental `.bak` / debug HTML (prior) | Removed earlier on branch | N/A |

No critical code FAIL remaining inside `ai-tax-concierge-v2/` for the in-scope local product. Remaining blockers are external integrations.
