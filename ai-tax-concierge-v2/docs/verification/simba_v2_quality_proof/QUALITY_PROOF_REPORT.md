# ASK SIMBA V2 — Final Quality Proof Report

**Branch:** `cursor/simba-v2-quality-proof-6522`  
**Baseline:** PR #42 (evidence gate)  
**Engine:** Node `ConversationalEngine` (authoritative)  
**Execution environment:** Cloud agent local development API (`http://127.0.0.1:8091`, `llm_mode=openai`)  
**Report time:** 2026-11-20, Europe/London  
**Production / merge / deploy:** **NOT performed** (HOLD)

---

## Executive verdict

**NO-GO for production.**

| Gate | Result |
|------|--------|
| Real OpenAI execution of T001–T400 | **PASS** — 400/400 `llm_mode=openai`, full transcripts |
| Independently verified tax accuracy (all 400) | **NOT MET** — 3 VERIFIED_PASS, 397 AWAITING ACCOUNTANT REVIEW |
| Accountant (Asim) sign-off | **NOT MET** — 0 ACCOUNTANT APPROVED |
| Critical tax defects unresolved | **Cleared in code for QP-001** after retest; professional sign-off still required |
| ≥40 live multi-turn journeys | **PASS** — 42/42 OpenAI (from evidence-gate, reused) |
| ≥20 deep 8–15 turn conversations | **PASS** — 20/20 OpenAI transcripts |
| UI screenshots / recordings | **PARTIAL PASS** — local preview screenshots + screen recordings captured; some mid-chat frames limited by widget input automation; SA fix verified on live :8091 API matching UI backend |
| Automated regression | **PASS** — Vitest **544/544** |

Categories (honest — generating 400 answers ≠ 400 accurate answers):

| Category | Count |
|----------|------:|
| REAL MODEL EXECUTED | 400 pack + 42 journeys + 20 deep (+ SA smoke/retests) |
| INDEPENDENTLY VERIFIED | 3 pack rows + SA £1k rule on D01 retest |
| ACCOUNTANT APPROVED | 0 |
| FAILED | 0 open after QP-001 fix |
| BLOCKED | Staging HMRC monitor / SMTP / Calendly live booking / production deploy (unchanged) |

---

## Phase 1 — Real answer accuracy (T001–T400)

| Metric | Value |
|--------|-------|
| Runner | `backend-node/scripts/runSimba400Pack.ts` with `LIVE=1` |
| Model path | Real OpenAI via `OpenAIAdapter` (not mocks) |
| Completed | **400 / 400** |
| Heuristic RECORDED | 400 |
| Heuristic FAIL | 0 |
| Execution ERROR | 0 (after budget/retry remediation) |
| Transcripts | Each row includes `question`, `turns[]` (`user`/`reply`/`packages`), final `reply`, `sources`, `llm_mode` |

**Evidence**

- `evidence/pack400/simba_400_results_live_latest.json`
- `evidence/pack400/EXECUTION_REGISTER.md` / `.csv`
- `evidence/pack400/simba_400_results_live_latest_tax_scored.json`

**Independent tax scoring** (`scoreLive400TaxAccuracy.ts`): rule/threshold/positioning checks only — never AI-as-sole-judge.

| tax_status | Count |
|------------|------:|
| VERIFIED_PASS | 3 (T050, T059, T371) |
| FAIL | 0 |
| BLOCKED | 0 |
| AWAITING_ACCOUNTANT_REVIEW | 397 |

**OpenAI usage (this quality-proof pass, approximate)**

| Suite | Live chat calls (approx.) | Notes |
|-------|---------------------------:|-------|
| Pack 400 | ≥400 (plus multi-turn extras + retries) | First attempt hit daily token budget mid-run; restarted with `OPENAI_DAILY_TOKEN_BUDGET=5000000` |
| Deep 20 | ~140 turns | D20 initially 429; retried |
| Journeys 40 | Prior evidence-gate run (42 journeys) | Reused valid OpenAI evidence |
| SA smoke / D01 retests | ~15 turns | Post-fix verification |

Exact token meter is process-local; treat counts above as **execution counts**, not billing ledger.

---

## Phase 2 — Natural customer journeys

### 42 multi-turn journeys (OpenAI)

- Path: `evidence/journeys40/live40_journeys_openai_latest.json`
- Result: **42 pass / 0 fail / 0 error**, all `llm_mode=openai`
- Heuristic journey PASS ≠ independently verified tax accuracy (all marked for accountant review)

### 20 deep conversations (8–15 turns)

- Path: `evidence/deep20/D01_openai.json` … `D20_openai.json`
- Scoreboard: `evidence/deep20/SCOREBOARD.json`
- Covers: first-time SA, landlord+PAYE, MTD approach, multi-income, unsure filing, no paid service, packages, Xero/TaxCalc, manage-everything, register now, professional advice, late return, existing customer, uploads, payment/onboarding, refuses package, changing facts, complex follow-ups, simpler explanations, free information only

**Scoring dimensions (1–10):** tax accuracy, understanding, clarity, follow-up relevance, memory, usefulness, British English, appropriate recommendation, absence of sales pressure, final outcome — recorded per JSON. Default tax scores remain conservative pending Asim; D01 raised after QP-001 fix for the £1k rule only.

---

## Phase 3 — Failure analysis & targeted corrections

See `DEFECT_LOG.md`.

Material code changes (existing architecture only):

| File | Change |
|------|--------|
| `src/knowledge/sa_eligibility.ts` | **New** deterministic SA / trading-income guidance |
| `src/ai/conversational_engine.ts` | Wire SA eligibility with session/history context |
| `src/ai/prompts.ts` | Trading allowance vs filing-duty grounding |
| `src/adapters/factory.ts` | `OPENAI_DAILY_TOKEN_BUDGET` |
| `src/security/ratelimit.ts` | Env-configurable chat rate max for eval |
| `scripts/runSimba400Pack.ts` | Full transcripts, retries, `RETRY_ERRORS` |
| `scripts/runDeepConversations20.ts` | Deep journey harness |
| `scripts/scoreLive400TaxAccuracy.ts` | Independent tax tags |
| `tests/sa_eligibility.test.ts` | Unit coverage |

**Regression:** Vitest **544 passed / 0 failed**.

---

## Phase 4 — Independent / accountant review

- Pack: `ASIM_ACCOUNTANT_REVIEW_PACK.md`
- Commercial claims checklist included (prices, Xero inclusion, consultations, portal limits)
- **No ACCOUNTANT APPROVED rows yet**

---

## Phase 5 — Visual / conversation evidence

| Artifact | Status |
|----------|--------|
| 20 unedited deep transcripts | Present under `evidence/deep20/` |
| 42 journey transcripts | Present under `evidence/journeys40/` |
| UI screenshots (local dev preview) | `evidence/ui/` + `/opt/cursor/artifacts/simba_quality_proof_ui/` — welcome/open frames + fix verification assets |
| Screen recordings | `evidence/ui/simba_quality_proof_three_journeys.mp4` (also `/opt/cursor/artifacts/simba_quality_proof_three_journeys.mp4`) |

**Environment label for visuals:** local cloud-agent development (not staging, not a physical customer device).

---

## Unresolved blockers

1. **Asim tax sign-off** for consequential live answers (pack + journeys + deep).  
2. **Staging / production OpenAI E2E** not claimed (agent OpenAI ≠ staging proof).  
3. **HMRC monitor / SMTP / Calendly live booking** still blocked as in prior PRs.  
4. **UI continuous recordings + full screenshot matrix** — partial at report time.  
5. **QP-004** catalogue dump on inclusions questions (non-critical CX).

---

## Final GO / NO-GO

**NO-GO.**

Reasons (acceptance criteria):

- Zero unresolved *critical* tax inaccuracies in code after QP-001 retest — **engineering cleared**.  
- **All required professional sign-offs completed** — **not met** (0 accountant approvals).  
- Cannot claim “400 accurate answers” merely because 400 model responses were generated.

Ask SIMBA is demonstrably **help-first and live-executable** in this environment, with improved SA threshold determinism, but **not production-cleared** until Asim completes the review pack and remaining visual evidence is attached.
