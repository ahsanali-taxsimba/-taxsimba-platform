# Toxel final evidence handover — PR #41

**Date:** 2026-11-20 (Europe/London)  
**PR:** [#41](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/41) @ `14869d13e540d40c06a4b7e1ab966fe2199c48c9`  
**Depends on:** PR #40 @ `63b183c` → PR #39 @ `e2b2d6f` → PR #36 → PR #35  
**Production:** **HOLD / NO-GO** — do not merge or deploy without approval.

Statuses used below: **PASS** = verified with evidence · **FAIL** = tested defective · **BLOCKED** = cannot verify · **MOCK** = simulated only (not live staging).

---

## Evidence checklist (items 1–8)

### 1. Compact chat and full workspace share conversation / history / context / recommendations

| Test ID | Actual result | Evidence | Status |
|---------|---------------|----------|--------|
| `CX-F` / `session_handoff.creates_and_consumes_single_use_token_without_history_in_token` | Same `session_id`; history restored; draft preserved; token opaque (no PII/history in URL); second consume fails | `backend-node/tests/cx_journeys_a_g.test.ts` (`F_compact_to_workspace_handoff_preserves_history`); `tests/session_handoff.test.ts`; `src/sessions/handoff.ts`; widget `chat-panel.js` create + `concierge.js` consume (`auto_send: false`) | **PASS** (code / automated) |
| Real browser multi-tab / refresh / back / mobile handoff | Not run on TaxSimba staging | — | **BLOCKED** |

### 2. Ordinary tax questions show zero package cards

| Test ID | Actual result | Evidence | Status |
|---------|---------------|----------|--------|
| `recommendations.ordinary_tax_question_does_not_attach_package_cards` | PAYE/SA filing Q → `packages = []` | `tests/recommendations.test.ts` | **PASS** (MOCK) |
| `CX-D` | “Do I need a TaxSimba package?” (PAYE-only) → `[]` | `cx_journeys_a_g.test.ts`; `evidence/journey_api_probes.json` id `D` | **PASS** (MOCK) |
| UI probe Test 1 | Sole-trader SA Q → 0 cards | `evidence/ui/03_test_evidence_report_tests_1_2.webp` | **PASS** (MOCK API/UI local) |
| Live OpenAI ordinary Qs | T001, T002, T050, T150, T200, T250, T300 → `packages: []` | `evidence/live_openai_sample_compact.json` | **PASS** (live OpenAI in **agent** env — not staging) |

### 3. One appropriate package only after understanding / explaining needs

| Test ID | Actual result | Evidence | Status |
|---------|---------------|----------|--------|
| `CX-A` | Explain SA first (0 cards) → “which package?” → **one** `SA_SIMPLE` | `cx_journeys_a_g.test.ts`; `journey_api_probes.json` id `A` | **PASS** (MOCK) |
| `recommendations.recommendation_ask_returns_one_primary_package` | Length 1, `SA_SIMPLE`, `recommended: true` | `tests/recommendations.test.ts` | **PASS** (MOCK) |
| `owner_commercial…recommendations_and_links_for_common_profiles` | Landlord / sole / CIS / multi → length 1 each | `tests/owner_commercial_decisions.test.ts` | **PASS** (MOCK) |
| Live T100 | OpenAI returned one card `SA_SMART` | `live_openai_sample_compact.json` | **PASS** (live OpenAI agent env) |
| Compare-only exception | Explicit compare → up to 3 SA cards | `journey_api_probes.json` id `COMPARE` | **PASS** (MOCK) — intentional |

### 4. Recommendations supported by verified inclusions and eligibility rules

| Test ID | Actual result | Evidence | Status |
|---------|---------------|----------|--------|
| Catalogue card builder | Only approved / customer-facing inclusions on cards; otherwise `inclusions_status: not_listed` — no invented inclusions | `src/ai/recommendations.ts` `toPackageCards`; `tests/recommendations.test.ts` price/inclusions guards; `package_journeys_50` | **PASS** (MOCK / code) |
| MTD eligibility precedence | Deterministic MTD handlers override sales blurb (e.g. MS-0009) | `tests/master_scenario_suite_505.test.ts`; `mtd_eligibility` | **PASS** (MOCK) |
| Tax-intelligence suite | 152 automated tax rule cases | `tests/tax_intelligence_150.test.ts` | **PASS** (MOCK) |
| Accountant sign-off of consequential claims | Not obtained | Asim review still required | **BLOCKED** |

### 5. Correct signup / email support / accountant consultation paths

| Test ID | Actual result | Evidence | Status |
|---------|---------------|----------|--------|
| `CX-A` onboarding ask | Register → verify → select → pay → dashboard explained; `taxsimba.co.uk/register` | `cx_journeys_a_g`; `journey_api_probes.json` `ONBOARD` | **PASS** (MOCK — links/copy) |
| `CX-G` | Support → `info@taxsimba.co.uk`; no fake phone onboarding | `cx_journeys_a_g`; probe `G`; UI `04_…summary.webp` | **PASS** (MOCK) |
| `CX-C` | Consult options £99/20m + £149/40m; no invented booking | `cx_journeys_a_g` | **PASS** (MOCK) |
| `CX-E` | Existing client → dashboard messaging; 0 packages | probe `E` | **PASS** (MOCK) |
| Staging portal checkout / email verify / dashboard | Not accessible | — | **BLOCKED** |
| Live Calendly payment + Google Meet | Not authorised / not configured for test | — | **BLOCKED** |

### 6. Scroll-to-latest in both interfaces

| Test ID | Actual result | Evidence | Status |
|---------|---------------|----------|--------|
| Compact (`chat-panel.js`) | After send/reply: `stickToBottom=true` + `scrollIntoView` on latest message; `#sp-jump-latest` | `widget/js/chat-panel.js`; `widget/chat.html`; `widget/css/chat-panel.css` | **PASS** (code review) |
| Workspace (`concierge.js`) | Same pattern + `#ts-jump-latest` | `widget/js/concierge.js`; `widget/css/concierge.css` | **PASS** (code review) |
| Real iPhone Safari / Android / desktop staging scroll behaviour | Not executed on staging devices | Computer-use note: jump/scroll not fully exercised in real browser matrix | **BLOCKED** |

### 7. Live OpenAI vs mock-only evaluation

| Scope | IDs | Mode | Status |
|-------|-----|------|--------|
| **Live OpenAI (agent environment only)** | **T001, T002, T050, T100, T150, T200, T250, T300, T301, T305, T310, T320, T350, T380, T400** (15 total) | `llm_mode=openai` | **PASS** as recorded sample — **not** staging; **not** tax-accuracy PASS |
| **Mock-only full pack** | **T001–T400** (all 400; multi-turn T301–T320) | `mode=mock` | **MOCK** — 400/400 heuristic **RECORDED** ≠ tax PASS |
| Staging OpenAI | — | — | **BLOCKED** |

Evidence:  
- Live: `docs/verification/simba_v2_cx_readiness/evidence/live_openai_sample_compact.json`  
- Mock: `docs/verification/simba_v2_audit_completion/evidence/simba_400_results_mock_latest.json` (+ compact)

### 8. Exact remaining blockers

| # | Blocker | Owner | Classification |
|---|---------|-------|----------------|
| 1 | Staging HTTPS URL + exact CORS / embed origins | Toxel | **BLOCKED** |
| 2 | Confirm staging `OPENAI_API_KEY` / health `llm_mode=openai` | Toxel | **BLOCKED** |
| 3 | HMRC monitor enabled + ops cycle with header `x-concierge-ops-token` | Toxel | **BLOCKED** |
| 4 | SMTP real delivery (not outbox MOCK) | Toxel | **BLOCKED** |
| 5 | Calendly live booking + consultation payment + Meet confirmation | Business / Toxel | **BLOCKED** |
| 6 | Portal register → email verify → package checkout → dashboard (test accounts) | Toxel | **BLOCKED** |
| 7 | Real-device matrix: iPhone Safari, Android, desktop (handoff, scroll, multi-tab) | Toxel | **BLOCKED** |
| 8 | Asim accountant approval of tax-sensitive answers / service claims | Asim | **BLOCKED** |
| 9 | Multi-node durable lead storage approval | Architecture / Toxel | **BLOCKED** |
| 10 | Deploy / rollback approval after gates | Toxel | **BLOCKED** — production **HOLD** |

---

## Dependency chain (do not break)

```
main ← PR #35 ← PR #36 ← PR #39 (e2b2d6f) ← PR #40 (63b183c) ← PR #41 (14869d1)
```

Authoritative engine: Node `ConversationalEngine`. Python tree = legacy.

---

## Toxel staging test script (remaining real-environment work)

1. Deploy **PR #41** tip to staging only (not production).  
2. Set env (names only): `CONCIERGE_FORCE_MOCK_LLM=false`, `OPENAI_API_KEY`, `CONCIERGE_CORS_ORIGINS` (exact), `CONCIERGE_OPS_TOKEN`, `CONCIERGE_HMRC_MONITOR_ENABLED=true`, `CONSULTATION_BOOKING_LIVE=false` until Calendly approved.  
3. Prove: `GET /api/v1/health` → `llm_mode=openai`.  
4. Compact → workspace handoff on mobile + desktop (refresh, back, second tab, expired token).  
5. Ordinary tax Q → 0 cards; recommend ask → 1 card; compare ask → ≤3.  
6. Signup links hit correct portal routes; one controlled test registration if authorised.  
7. Support email path; consult path without claiming a booking.  
8. One SMTP test to controlled inbox; one HMRC ops run with header token; retain logs.  
9. Scroll-to-latest + Jump to latest on iPhone Safari and Android.  
10. Asim reviews live sample + critical tax IDs before any GO.

**Rollback:** redeploy PR #40 `63b183c` (or PR #39 `e2b2d6f`).

---

## Final assessment

| Gate | Status |
|------|--------|
| Automated CX / handoff / zero-card / one-primary (this branch) | **PASS** (MOCK + agent live sample) |
| Live staging integrations & real devices | **BLOCKED** |
| Tax sign-off | **BLOCKED** |
| **Production** | **NO-GO / HOLD** |
