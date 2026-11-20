# SIMBA V2 — Final Intelligence, Conversion & Evidence Gate

**Date:** 2026-11-20 (Europe/London)  
**Baseline:** PR #41 @ `48b45ca` → PR #40 → PR #39  
**Branch:** `cursor/simba-v2-evidence-gate-6522`  
**Engine:** Node `ConversationalEngine` (authoritative)  
**Production:** **NO-GO / HOLD**

Statuses: **PASS** · **FAIL** · **BLOCKED** · **MOCK** · **AWAITING PROFESSIONAL REVIEW**

---

## 1. Requirement-by-requirement audit (gap vs PR #41)

| Area | PR #41 state | Gap found | This pass |
|------|--------------|-----------|-----------|
| Help-first / zero cards | Working | — | Retained |
| One primary package | Working | — | Retained |
| Handoff continuity | Working (code) | Staging browsers | Unchanged **BLOCKED** |
| Scroll-to-latest | Code PASS | Real devices | **BLOCKED** |
| TaxSimba-first software (Xero/TaxCalc/portal) | Partial via MTD ops | No dedicated buy-Xero / TaxCalc / portal-filing / DIY handlers | **Fixed** |
| Signup / support / consult | Working (code) | Staging E2E | **BLOCKED** |
| ≥40 live OpenAI multi-turn journeys | Not done | Required | **Done (42)** agent env |
| Full 400 live OpenAI | Not done | Cost/time | **Partial:** 40 live + 400 mock |
| HMRC ops / SMTP / Calendly / portal | BLOCKED | Access | Still **BLOCKED** |
| Asim tax sign-off | BLOCKED | — | **AWAITING PROFESSIONAL REVIEW** |

---

## 2. Confirmed defects and root causes (this pass)

| Defect | Root cause | Correction |
|--------|------------|------------|
| “Buy Xero / TaxCalc / portal files to HMRC?” underspecified | Relied on generic MTD ops / LLM | `knowledge/taxsimba_service_model.ts` + engine precedence |
| Bare `register` triggered package cards | `wantsServiceRecommendation` matched HMRC “register for SA” | Narrowed to TaxSimba signup phrasing |
| “I want to sign up” could hit catalogue mock dump | No dedicated signup-link path | `signupLinkQ` → onboarding/register reply |

---

## 3. Exact code changes

| Path | Change |
|------|--------|
| `src/knowledge/taxsimba_service_model.ts` | **New** TaxSimba-first / DIY software / portal filing answers |
| `src/ai/conversational_engine.ts` | Wire service model; signup link; package suppression |
| `src/ai/recommendations.ts` | Narrow signup/buy triggers |
| `src/ai/prompts.ts` | Operating-model grounding |
| `src/knowledge/mtd_operations.ts` | TaxSimba-first Xero wording |
| `tests/taxsimba_service_model.test.ts` | **New** |
| `scripts/runLiveCustomerJourneys40.ts` | **New** 42 multi-turn journeys |
| `docs/verification/simba_v2_evidence_gate/**` | This evidence pack |

---

## 4. Real OpenAI conversation evidence

| Suite | Mode | Result | Evidence |
|-------|------|--------|----------|
| 42 multi-turn journeys | **openai** (agent env) | **42/42 PASS** heuristics; all `llm_mode=openai` | `evidence/live40_journeys_openai_latest.json` (+ compact) |
| Same 42 journeys | mock | 42/42 PASS | `evidence/live40_journeys_mock_latest.json` |
| TaxSimba staging OpenAI | — | — | **BLOCKED** |

Tax content of live journeys: **AWAITING PROFESSIONAL REVIEW** (Asim). Heuristic PASS ≠ independently verified tax accuracy.

---

## 5. Complete 400-question evaluation

| Run | IDs | Mode | Heuristic | Tax accuracy |
|-----|-----|------|-----------|--------------|
| Full pack | T001–T400 | **MOCK** | 400 RECORDED / 0 heuristic fail | **AWAITING PROFESSIONAL REVIEW** |
| Live sample | T001–T040 | **openai** (agent) | 40 RECORDED | **AWAITING PROFESSIONAL REVIEW** |
| Remaining T041–T400 live | — | — | Not run this pass | **BLOCKED** (full live cost) / pending |
| Staging live 400 | — | — | — | **BLOCKED** |

Evidence: audit-completion `simba_400_results_mock_latest.json`; `evidence/simba_400_live_first40_compact.json`.

**Do not treat 400/400 MOCK RECORDED as tax PASS.** Running the pack does not train OpenAI.

---

## 6. HMRC source and tax-rule validation

| Check | Status |
|-------|--------|
| Deterministic MTD/SA handlers + tax_intelligence_150 (152) | **PASS** (MOCK automated) |
| Live journey threshold / eligibility heuristics | **PASS** (agent OpenAI) |
| Consequential tax conclusions signed by Asim | **AWAITING PROFESSIONAL REVIEW** |
| Staging HMRC monitor cycle | **BLOCKED** |

---

## 7. Asim outstanding review items

1. All live journey tax conclusions (J01–J42 replies).  
2. Live T001–T040 answers.  
3. Mock T041–T400 sampled consequential IDs (eligibility, thresholds, mixed income).  
4. Service claims: Xero-included wording, SA/MTD dual-obligation guidance, consultation copy.  
5. Any statutory change before production monitor enablement.

---

## 8. SA / MTD service-classification evidence

| Journey | Classification behaviour | Status |
|---------|--------------------------|--------|
| J01 / J08 | Neither / PAYE-only → no package | **PASS** (live openai heuristics) |
| J02 / J10 | SA → one SA package when asked | **PASS** |
| J03 / J04 | MTD landlord → explain then one MTD when asked | **PASS** |
| J07 / J34 | Both obligations explained; no forced dual purchase dump | **PASS** |
| J31 | Existing client → dashboard | **PASS** |

---

## 9. TaxSimba-first software-positioning evidence

| Test | Result | Status |
|------|--------|--------|
| J11 buy Xero | Included in Simbian; not sent to buy separately | **PASS** (live) |
| J12 TaxCalc | Internal accountant tool | **PASS** (live) |
| J13 HMRC-compatible software | TaxSimba-first + DIY opt-in | **PASS** (live) |
| J14 / J15 filing & portal | Not direct HMRC integration | **PASS** (live) |
| J24 independent DIY | Fair GOV.UK software path | **PASS** (live) |
| `tests/taxsimba_service_model.test.ts` | 5/5 | **PASS** (MOCK) |

---

## 10. Package recommendation evidence

| Behaviour | Evidence | Status |
|-----------|----------|--------|
| Ordinary Q → 0 cards | J01, J03, J05, live T001–T005… | **PASS** |
| Recommend ask → 1 primary | J02, J04, J10 | **PASS** |
| Compare → ≤3 | J18, J37 | **PASS** |
| Decline remembered | J19, J33 | **PASS** |

---

## 11. Signup, support, consultation evidence

| Path | Evidence | Status |
|------|----------|--------|
| Register / after payment steps | J20, J21, J39 | **PASS** (copy/links; MOCK+live agent) |
| Support email | J22 → info@taxsimba.co.uk | **PASS** |
| Consult £99/£149 no fake booking | J09, J23, J38 | **PASS** |
| Staging portal / Calendly / Meet / payment | — | **BLOCKED** |

---

## 12. Compact / full continuity evidence

| Check | Status |
|-------|--------|
| Secure handoff unit + CX-F (PR #40/#41) | **PASS** (code) |
| J41 same-session memory | **PASS** (live heuristics) |
| Real mobile/desktop handoff matrix | **BLOCKED** |

---

## 13. Real mobile and desktop evidence

| Check | Status |
|-------|--------|
| Scroll-to-latest code (PR #41) | **PASS** (code) |
| iPhone Safari / Android / desktop staging | **BLOCKED** |
| Local desktop screenshots (prior CX pack) | **MOCK**/local only — not real-device sign-off |

---

## 14. Lead, SMTP, privacy

| Check | Status |
|-------|--------|
| Lead permission + unit tests | **PASS** (code) |
| SMTP real delivery | **BLOCKED** |
| Multi-node durable store | **BLOCKED** |

---

## 15. HMRC monitoring operational evidence

| Check | Status |
|-------|--------|
| Implementation present | **PASS** (code) |
| Staging scheduled cycle + quarantine/approve | **BLOCKED** |

---

## 16. Portal and Calendly integration

| Check | Status |
|-------|--------|
| Public links in answers | **PASS** (configured URLs) |
| Live registration/checkout/booking | **BLOCKED** |

---

## 17. Automated regression

| Suite | Result |
|-------|--------|
| Vitest | **538/538 PASS** |
| Mock 42 journeys | **42/42 PASS** |
| Live 42 journeys (agent OpenAI) | **42/42 PASS** (heuristics) |
| Mock 400 | **400 RECORDED** |
| Live 400 first 40 | **40 RECORDED** |

---

## 18. Security and rollback

| Item | Status |
|------|--------|
| Handoff single-use / ops header-only (PR #40) | Preserved **PASS** (code) |
| J40 injection refusal | **PASS** (live) |
| Secrets not logged | **PASS** (practice) |
| Rollback | Redeploy PR #41 tip `48b45ca` or PR #40 `63b183c` |
| Merge/deploy production | **Not done — HOLD** |

---

## 19. Consolidated remaining blockers

1. TaxSimba **staging** OpenAI confirmation (≠ agent env).  
2. Staging HTTPS / CORS / embed.  
3. Real iPhone Safari, Android, desktop (handoff + scroll).  
4. HMRC monitor ops cycle with token.  
5. SMTP delivery proof.  
6. Portal register → verify → pay → dashboard test accounts.  
7. Calendly payment + Meet live.  
8. Full T041–T400 **live** OpenAI run (optional cost) + Asim review.  
9. Asim approval of tax-sensitive answers and service claims.  
10. Toxel deploy approval.  
11. Multi-node lead durability decision.

---

## 20. Final Toxel staging handover and GO/NO-GO

**Dependency chain:** `#35 → #36 → #39 → #40 → #41 → this evidence-gate branch`

**Deploy tip (staging only):** `cursor/simba-v2-evidence-gate-6522` after review.

**Must prove on staging:** health `llm_mode=openai`; handoff; zero-card ordinary Q; one primary recommend; Xero/TaxCalc/portal positioning; register links; support email; consult no fake booking; one controlled portal/SMTP/HMRC ops test if authorised.

### Final assessment: **NO-GO for production**

Automated and agent-environment live OpenAI journey heuristics are green. Staging integrations, real devices, full live 400, and Asim/Toxel approvals remain open. Production stays on **HOLD**.
