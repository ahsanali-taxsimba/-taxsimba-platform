# SIMBA V2 Quality Proof — Defect Log & Retests

**Environment:** cloud agent local API (`llm_mode=openai`)  
**Date:** 2026-11-20 (Europe/London)

| ID | Defect | Severity | Root cause | Fix | Retest |
|----|--------|----------|------------|-----|--------|
| QP-001 | £8,000 freelance income described as below the £1,000 trading allowance / no SA needed | **Critical tax** | LLM free-form answer inverted GOV.UK sole-trader “more than £1,000” rule | New deterministic `sa_eligibility.ts` (history-aware) + prompt grounding; wired ahead of LLM in `conversational_engine.ts` | Live smoke + D01 retest: disclosure and explicit SA turns now state income is **above** £1,000 and SA usually required. Unit tests in `tests/sa_eligibility.test.ts`. |
| QP-002 | SA handler intercepted “When do I need to register for VAT?” | High (regression) | Over-broad `do i need to register` matcher | Narrowed SA detector; VAT excluded unless Self Assessment mentioned | `grounding_accuracy_fixes` + full Vitest **544/544 PASS** |
| QP-003 | Full live 400 interrupted: 202/400 returned HTTP 429 | Blocker for evidence | In-process OpenAI daily token budget default 250k + shared chat rate limit during concurrent deep20 | `OPENAI_DAILY_TOKEN_BUDGET` wired in `adapters/factory.ts`; `CONCIERGE_CHAT_RATE_MAX`; runner retries + `RETRY_ERRORS=1` | Full pack re-run: **400/400** `llm_mode=openai`, 0 errors |
| QP-004 | Catalogue dump when asked “what is included” after a single package recommendation | Medium CX | Existing inclusions handler lists approved catalogue | Not redesigned this pass (architecture preserved). Flagged for Asim/CX review | Observed in D01 transcript turn on inclusions |
| QP-005 | “Where is the registration link?” returns full onboarding dump | Low CX | `signupLinkQ` shares onboarding reply | Deferred (non-critical); link is present | D01 still contains `https://www.taxsimba.co.uk/register` |

## Retest evidence paths

- SA live smoke: `/tmp/sa-fix-live.log` (also reproducible via `scripts/smokeSaEligibilityLive.ts`)
- D01 fixed transcript: `evidence/deep20/D01_openai.json`
- Pack 400 live: `evidence/pack400/simba_400_results_live_latest.json`
- Tax scorer: `evidence/pack400/simba_400_results_live_latest_tax_scored.json`
- Regression: Vitest 544 passed (2026-11-20)
