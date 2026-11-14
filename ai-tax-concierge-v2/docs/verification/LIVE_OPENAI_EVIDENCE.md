# SIMBA AI — Live OpenAI verification evidence

**Date:** 2026-11-13 (Europe/London)  
**Branch / PR:** `cursor/ai-tax-concierge-v2-phase1-0f84` / #35  
**Isolation:** primary product under `ai-tax-concierge-v2/`; portal catalogue sync only in `backend/phase1b.py` — frontend / taxotools / Marketing Hub / live HTML untouched  
**Harness (Node, current):** `backend-node/scripts/liveOpenAIVerification.ts` (`npm run live:openai`)  
**Harness (Python reference):** `backend/scripts/live_openai_verification.py`  
**Latest machine report:** `docs/verification/live_openai_report_latest.json` (= `live_openai_report_20261113T230918Z.json`, status `COMPLETED`)  
**Live key re-run write-up:** `docs/verification/live_key_rerun_20261113/LIVE_KEY_RERUN_REPORT.md`  
**Earlier completed snapshot:** `docs/verification/live_openai_report_20261113T052107Z.json`

## 0. Official GOV.UK verification (approved accuracy fixes)

| Fact | Official guidance | Source |
|------|-------------------|--------|
| MTD >£30,000 qualifying income in **2025-26** | Starts **6 April 2027** | [Find out if and when you need MTD for Income Tax](https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax) (GOV.UK / HMRC; page last updated 26 March 2026) |
| MTD >£50,000 in 2024-25 | Starts **6 April 2026** | same |
| MTD >£20,000 in 2026-27 | Starts **6 April 2028** | same |
| Qualifying income | Turnover/gross self-employment + property **before expenses** (not profit); PAYE excluded | [Work out your qualifying income](https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax) |
| VAT registration | Taxable turnover more than **£90,000** (voluntary below) | [How VAT works / registration](https://www.gov.uk/vat-registration-thresholds) |

## 1. Root cause of the two live failures

| Failure | Why the live model got it wrong |
|---------|----------------------------------|
| MTD £30k → April 2026 | Corpus already had the correct 6 April 2027 text, but `verify_ranked` truncated fact excerpts to **280 characters**, cutting off every threshold date before they reached the system prompt. The model then fell back to stale parametric memory and mixed the £50k/2026 band with the £30k band. |
| VAT → £85,000 | Corpus deliberately left the figure unpinned (“confirm on GOV.UK”), so the model filled in the outdated **£85,000** training-memory threshold instead of current **£90,000**. |

## 2. Fixes applied (this iteration)

- Split MTD threshold facts (`mtd-threshold-50k-april-2026`, `mtd-threshold-30k-april-2027`, `mtd-threshold-20k-april-2028`) + refreshed overview text
- Pinned VAT threshold to **£90,000** (and marked £85,000 as outdated)
- Raised verified fact excerpt length (full summary up to 1200 chars) so dates/figures are not clipped
- Strengthened system prompt grounding rules (verified facts override pretraining; explicit MTD band table; no £85k)
- Retrieval boosts for numeric thresholds + VAT/MTD category intent
- Post-reply `apply_grounding_guard` safety net for known stale slips
- Pinned property/trading allowances to **£1,000** (GOV.UK)
- Regression tests in `tests/test_grounding_accuracy_fixes.py` (+ knowledge accuracy updates)

## 3. Secret availability check (no value exposed)

| Check | Result |
|-------|--------|
| `OPENAI_API_KEY` present (Python earlier + Node 2026-11-13T23:09Z re-run) | **True** |
| Key length | **164** |
| Key prefix shape | **sk-like** |
| `use_mock_llm` / `CONCIERGE_FORCE_MOCK_LLM=false` | live mode |
| Adapter | **`openai`** |
| Mock substituted? | **No** |
| Note on intermittent Cloud Agent absence | Some earlier pods reported the key missing; this re-run confirms the Cursor runtime secret **is** injected when the environment receives it. Never log the value. |

## 4. Live connectivity / coverage (post-fix re-run)

| Item | Result |
|------|--------|
| Connectivity ping | **OK** (`LIVE_OK`) |
| Model | `gpt-4o-mini` |
| Single-turn UK tax questions | **33/33 live**, 0 harness exceptions |
| Multi-turn dialogues | **3/3**, context retained |
| Guided journeys | **4/4** (`consultation`, `existing_client`, `mtd`, `freelancer`) |
| Injection probe | Refused system prompt; answered SA deadline |
| Accuracy flags | **0** (`mtd_threshold_30k` and `vat_threshold` both clear) |
| Tokens used (this run snapshot) | see report `usage` field |

### Key corrected answers (excerpts)

- **`mtd_threshold_30k`:** start from **6 April 2027**; clarifies qualifying income is before expenses; tax-year window may mention 5 April 2026 as year-end (not the MTD start).
- **`vat_threshold`:** register if taxable turnover exceeds **£90,000**.

## 5. Automated regression (mock)

Command: `pytest -q` in `ai-tax-concierge-v2/backend`

| Result | Count |
|--------|-------|
| Passed | **186** |
| Failed | **0** |

(Previously 175; +new grounding/accuracy regression tests.)

## 6. Distinction summary

| Evidence class | Status |
|----------------|--------|
| Official GOV.UK fact check | Confirmed |
| Mock automated suite | **Pass (186)** |
| Live OpenAI connectivity | **Pass** |
| Live 33 tax conversations | **Pass (0 accuracy flags)** |
| Live multi-turn + journeys | **Pass** |
| Live security injection probe | **Pass** |
| Human accountant sign-off | Still required before production |

## 7. Remaining blockers (do not merge / do not deploy)

1. Human accountant review of material live answers before production reliance
2. Live Stripe / Calendly / confirmed production URLs not connected
3. No public iPhone staging URL yet

## 8. Latest Node live re-run (2026-11-13 evening, Europe/London)

| Item | Result |
|------|--------|
| Connectivity | **PASS** |
| Single-turn | **33/33 live**, accuracy flags **0** |
| Multi-turn | **3/3** |
| Journeys | **4/4** |
| Owner commercial probe | **11/11** |
| Vitest | **476/476** |

## 9. Approval wait

Accuracy fixes re-verified with live OpenAI after key availability confirmation. **No merge. No deploy.** Awaiting approval. Staging only.
