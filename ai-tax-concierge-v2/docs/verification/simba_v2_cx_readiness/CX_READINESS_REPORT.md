# SIMBA V2 — Customer Experience, Tax Accuracy & Production Readiness

**Date:** 2026-11-20 (Europe/London)  
**Baseline:** PR #40 @ `63b183cec7d4cc8980fb820b01614bb5eb0f72e3` (on PR #39 tip `e2b2d6f`)  
**Work branch:** `cursor/simba-v2-cx-readiness-6522`  
**Engine:** Node `ConversationalEngine` (authoritative)

---

## 1. Requirements matrix (CX focus)

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| CX-1 | Help first; no automatic SA/MTD catalogue on ordinary tax Qs | **Working (code)** | `limitPackageCodes`; journey D; recommendations tests |
| CX-2 | One primary package when recommending | **Working (code)** | Journey A; owner_commercial; MS-0016 |
| CX-3 | Comparison only when asked | **Working (code)** | COMPARE probe → 3 SA cards |
| CX-4 | Secure compact↔workspace handoff (PR #40) | **Working (code)** | Journey F + `session_handoff` |
| CX-5 | Support → info@taxsimba.co.uk; no phone onboarding | **Working (code)** | Journey G |
| CX-6 | Onboarding steps after signup/payment | **Working (code)** | ONBOARD probe |
| CX-7 | Existing client → dashboard, no new sale | **Working (code)** | Journey E |
| CX-8 | Latest answer visible / Jump to latest | **Working (code)** | `scrollIntoView` + jump controls; real iPhone **BLOCKED** |
| CX-9 | Live OpenAI quality sample | **PASS (agent)** | 15/15 RECORDED; staging host **BLOCKED** |
| CX-10 | 400 pack tax accuracy sign-off | **BLOCKED** | Mock heuristics ≠ Asim PASS |
| CX-11 | Staging portal/Calendly/SMTP/HMRC ops | **BLOCKED** | Access |
| CX-12 | Production GO | **NO-GO** | Gates open |

Full prior matrix: `../simba_v2_audit_completion/REQUIREMENT_TRACEABILITY_MATRIX.md`.

---

## 2. PR #40 audit findings (starting point)

- Secure handoff, sales gating, ops header-only auth, 400 pack runner already present.
- Remaining CX defect: price/catalogue paths and broad “accountant” matching could still surface the wrong answer shape; frontend could attach up to 3 cards; mock “package” keyword still dumped overview on “which package?” / “do I need a package?”.
- This branch fixes those at source without rebuilding SIMBA.

---

## 3. Exact files changed and why

| File | Why |
|------|-----|
| `recommendations.ts` | Primary-vs-compare limits; narrower consult detect; no cards on “do I need a package?” |
| `package_selection.ts` | Missed-deadline / HMRC-letter → Smart + consult path |
| `conversational_engine.ts` | Support, onboarding, existing-client handlers; primary mock recommend without overriding MTD eligibility |
| `prompts.ts` | Lean catalogue overview; do not mock-dump on recommend/need asks |
| `chat-panel.js` / `concierge.js` | Force scroll to latest reply; compare CTA; fix 20-minute consult copy |
| `tests/*` | CX journeys A–G; recommendation expectations |
| `docs/verification/simba_v2_cx_readiness/**` | This report + evidence |

---

## 4. Automated test results

- Vitest: **533/533 PASS** (includes new `cx_journeys_a_g.test.ts`)
- Mock 400 heuristics: **400/400 RECORDED** (not tax PASS)

---

## 5. Real OpenAI evaluation

- Agent env sample (15 IDs spanning pack): **15/15 RECORDED**, `llm_mode=openai`  
  Evidence: `evidence/live_openai_sample_compact.json` (and audit completion live latest)
- Staging host OpenAI: **BLOCKED**

---

## 6. Independently reviewed tax accuracy

- Automated handlers / tax_intelligence_150: **PASS**
- Accountant (Asim) review of consequential answers: **BLOCKED**
- Do not treat mock or OpenAI HTTP 200 as tax PASS

---

## 7. Full 400-question report

- Pack T001–T400 + multi-turn T301–T320 unchanged (questions only)
- Mock: 400 RECORDED / 0 heuristic fail
- Live: sample only (cost) — not full 400 live
- Acceptance criteria still require Asim for tax-sensitive IDs

---

## 8. Customer-journey results (API)

See `evidence/journey_api_probes.json`:

| Journey | Result |
|---------|--------|
| A Simple SA → one SA_SIMPLE | **PASS (mock API)** |
| B MTD landlord ask | Covered by unit journeys / MTD handlers |
| C Complex → consult options | **PASS (unit)** |
| D No paid service / PAYE-only ask | **PASS** — 0 packages |
| E Existing customer | **PASS** — dashboard guidance, 0 packages |
| F Compact→workspace handoff | **PASS (unit)** |
| G Support email | **PASS** — info@taxsimba.co.uk |

Portal signup/payment/dashboard E2E: **BLOCKED** (staging).

---

## 9. Continuity evidence

- PR #40 handoff retained and re-tested in Journey F.
- Invalid/reuse → 409/400; no history in token.

---

## 10. Mobile scrolling / UI evidence

- Code: force `scrollIntoView` on latest message after send/reply; Jump to latest retained.
- Automated widget tests: **PASS**
- Local widget screenshots (agent desktop; not real iPhone Safari):
  - `evidence/ui/01_compact_chat_initial_welcome.webp`
  - `evidence/ui/02_workspace_index_welcome_sidebar.webp`
  - `evidence/ui/03_test_evidence_report_tests_1_2.webp` (0 cards → then 1 primary)
  - `evidence/ui/04_test_evidence_report_tests_3_summary.webp` (support path)
- Real iPhone Safari / Android / staging embed: **BLOCKED**

---

## 11. Package recommendation evidence

- Ordinary tax Q → 0 cards  
- “Which package recommend?” → **1** primary  
- “Compare / what packages offer?” → up to **3** family cards  
- Prices: SA £119/£149/£299; MTD £29.99/£59.99/£89.99 VAT incl.

---

## 12. Signup & consultation integration

- Onboarding explanation + register/SA/MTD links: **PASS (code)**  
- Live Calendly payment / Meet / portal checkout: **BLOCKED**

---

## 13. HMRC monitoring

- Code present; staging cycle: **BLOCKED** (unchanged)

---

## 14. Security & privacy

- PR #40 ops header-only preserved  
- Handoff single-use preserved  
- Lead permission model unchanged; SMTP E2E **BLOCKED**

---

## 15. Outstanding blockers

1. Staging HTTPS + embed origins (Toxel)  
2. Staging OpenAI / HMRC ops / SMTP confirmation  
3. Calendly live + Meet + consultation payment  
4. Portal registration / verify / checkout / dashboard test accounts  
5. Asim tax sign-off on 400 pack  
6. Real mobile browser matrix  
7. Multi-node durable leads approval  

---

## 16. Toxel handover & rollback

**Merge chain:** #35 → #36 → #39 → #40 → this PR (`cursor/simba-v2-cx-readiness-6522`).

```bash
git fetch origin cursor/simba-v2-cx-readiness-6522
git checkout cursor/simba-v2-cx-readiness-6522
cd ai-tax-concierge-v2/backend-node && npm ci && npm test && npm run build
# staging env as in simba_v2_final_corrected/STAGING_DEPLOYMENT_INSTRUCTIONS.md
```

**Rollback:** redeploy PR #40 tip `63b183c` (or PR #39 `e2b2d6f` if needed).

Do not merge to production without approvals.

---

## 17. Final GO / NO-GO

### **NO-GO for production**

Critical automated CX regressions for this pass are green. Staging integrations, real-device UX proof, and accountant tax sign-off remain open. Production stays on HOLD.
