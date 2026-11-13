# SIMBA AI — Requirements traceability matrix

**Date:** 2026-11-13 (Europe/London)  
**PR:** #35 (`cursor/ai-tax-concierge-v2-phase1-0f84`)  
**Scope:** `ai-tax-concierge-v2/` only  

Statuses: **PASS** / **PARTIAL** / **BLOCKED** / **NOT TESTED** / **FAIL**

| ID | Requirement | Implementation | Tests / evidence | Status |
|----|-------------|----------------|------------------|--------|
| R1 | Isolated under `ai-tax-concierge-v2/`; no production site edits | Package root + PR diff | PR #35 file list | PASS |
| R2 | Secure server-side OpenAI key | `app/adapters/llm_openai.py`, `config.py` | `test_security_suite.py`, live harness | PASS |
| R3 | Mock vs live clearly labelled | `config.safe_public_config`, widget banner | API + widget tests | PASS |
| R4 | Verified HMRC/GOV.UK grounding | `knowledge/*`, `grounding.py` | knowledge + grounding + live harness | PASS |
| R5 | MTD £30k → 6 Apr 2027; VAT £90k | corpus + prompts + guard | live report + grounding tests | PASS |
| R6 | Helpful-first; no hard sell | `prompts.py`, `recommendations.py` | `test_helpful_first_no_pressure.py` | PASS |
| R7 | Existing clients → dashboard messaging | journey `existing_client` | journey tests; E2E portal **BLOCKED** | PARTIAL |
| R8 | SA packages £119/£149/£299 | `packages.json` | catalog tests | PASS (prices) |
| R9 | MTD plans £29.99/£59.99/£89.99 VAT incl. | `packages.json` | catalog tests | PASS (prices) |
| R10 | £99 / 30 min / Google Meet consultation | packages + journeys | conversation PASS; Calendly/Stripe **BLOCKED** | PARTIAL |
| R11 | 17 live calculators linked correctly | `calculators.json` (live paths) | HTTP title checks 2026-11-13 | PASS (links) |
| R12 | No invented inclusions | `answer_inclusions_question` | inclusions tests | PASS |
| R13 | TaxSimba.co.uk branding (logo, colours, fonts) | widget CSS/HTML/embed + official logo | accessibility/brand tests + screenshots | PASS |
| R14 | No lions/mascots/decorative motion | logo SVG; static loading | accessibility tests | PASS |
| R15 | Discreet launcher; no auto-popup | `embed.js` | code review + UI screenshots | PASS |
| R16 | Responsive + a11y basics | CSS + ARIA + Escape close | widget tests; manual screenshots | PARTIAL (full SR NOT TESTED) |
| R17 | Stripe checkout E2E | stub adapter only | — | BLOCKED |
| R18 | Calendly booking E2E | stub adapter only | — | BLOCKED |
| R19 | Registration / email verify / dashboard E2E | no staging credentials | — | BLOCKED |
| R20 | Authenticated customer context | portal adapter mock | — | BLOCKED |
| R21 | Rate limit, injection, privacy | security modules | `test_security_suite.py` | PASS |
| R22 | Durable analytics / monitoring | in-memory only | — | PARTIAL |
| R23 | Embedded on live staging host | local preview only | — | BLOCKED |

## Honest distinction (journey layers)

| Layer | Meaning |
|-------|---------|
| L1 AI conversation | Model/mock answers correctly |
| L2 Link/navigation | Correct configured URL / path |
| L3 Website integration | Public page opens as expected |
| L4 Staging transaction | Payment/booking/auth actually completes |

L4 is **BLOCKED** for payment, booking, registration and authenticated portal until Toxel supplies staging credentials and live Stripe/Calendly configuration.
