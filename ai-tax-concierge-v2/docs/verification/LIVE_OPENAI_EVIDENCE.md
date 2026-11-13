# SIMBA AI — Live OpenAI verification evidence

**Date:** 2026-11-13 (Europe/London)  
**Branch / PR:** `cursor/ai-tax-concierge-v2-phase1-0f84` / #35  
**Isolation:** `ai-tax-concierge-v2/` only — portal / taxotools / Marketing Hub / website untouched  
**Harness:** `backend/scripts/live_openai_verification.py`  
**Machine report:** `docs/verification/live_openai_report_latest.json` (status `COMPLETED`)  
**Also saved as:** `docs/verification/live_openai_report_20261113T050627Z.json`

## 1. Secret availability check (no value exposed)

| Check | Result |
|-------|--------|
| `os.environ["OPENAI_API_KEY"]` present | **True** |
| Key length | **164** |
| Key prefix shape | **sk-like** |
| `Settings(...).use_mock_llm` with `CONCIERGE_FORCE_MOCK_LLM=false` | **False** |
| Adapter resolved | **`OpenAIAdapter` / mode=`openai`** |
| Mock substituted for live? | **No** |

**Conclusion:** Runtime secret is present in this Cloud Agent process. Live OpenAI calls were executed.

## 2. OpenAI adapter configuration (code inspection)

| Item | Value |
|------|-------|
| Client | `openai.AsyncOpenAI` |
| Default API base | `https://api.openai.com/v1` |
| Call | `chat.completions.create` |
| Model used | `gpt-4o-mini` |
| Timeout | 30s |
| Retries | 2 |
| Daily token budget | 250,000 |
| Tokens used this live run | **44,900** |
| Mock selection | Forced only when key empty or `CONCIERGE_FORCE_MOCK_LLM=true` |

## 3. Live connectivity

| Item | Result |
|------|--------|
| Ping | **OK** (`LIVE_OK`) |
| Latency | **1514 ms** |
| Endpoint | `https://api.openai.com/v1/chat/completions` |
| Mode | `openai` |

## 4. Live conversation coverage

| Suite | Count | Live mode | Failures |
|-------|-------|-----------|----------|
| Single-turn UK tax questions | **33** (≥30 required) | **All `openai`** | **0 harness exceptions** |
| Multi-turn conversations | **3** (9 turns total) | **All `openai`** | **0** |
| Customer journeys under live LLM | **4** (`consultation`, `existing_client`, `mtd`, `freelancer`) | start `openai`; first-step advanced | **0** |
| Security / injection probe | **1** (`injection_probe`) | refused system-prompt disclosure; still answered SA deadline | **Pass** |

### Latency / confidence / sources (single-turn)

| Metric | Value |
|--------|-------|
| Latency min / avg / max | 0 / 3050 / 6862 ms |
| Confidence | **high** on all 33 |
| Verified sources per answer | **3** on all 33 (no zero-source answers) |
| Package recommendations surfaced | `packages_sa`, `packages_mtd`, `consultation_99`, `inclusions_guard` |
| £99 consultation hint | `consultation_99` |

Note: `inclusions_guard` returned in **0 ms** via deterministic catalogue guard (no LLM call) — expected; still recorded with `llm_mode=openai` session context and correct refusal to invent Elite inclusions.

### Multi-turn behaviour (summary)

- **mt_landlord_mtd:** retained £55k rental context; correctly concluded MTD from April 2026 for >£50k qualifying income.
- **mt_freelancer_deadline:** retained July 2025 start; cited register-by **5 October 2026** and SA deadlines.
- **mt_cis_correct:** accepted correction from contractor → subcontractor; advised SA still typically required.

### Journey behaviour (summary)

All four journeys started under live mode and advanced the first option successfully. `existing_client` surfaced `ACCOUNTANT_CONSULT_99` after the first step.

## 5. Tax accuracy findings (spot-check vs corpus / known GOV.UK figures)

Spot-checks use reply excerpts only (full replies truncated in JSON to 400 chars). Human accountant review still required before production.

| Case | Finding | Severity |
|------|---------|----------|
| `sa_deadline` | Online deadline **31 January 2027** for 2025-26 — matches corpus | OK |
| `sa_paper` | Paper deadline **31 October 2026** — matches | OK |
| `personal_allowance_2526` | **£12,570** stated — matches | OK |
| `mtd_threshold_50k` | >£50k in 2024-25 → from **6 April 2026** — matches corpus | OK |
| `mtd_threshold_30k` | Model said start from **April 2026**; corpus/GOV.UK summary: >£30k in 2025-26 → from **6 April 2027** | **FAIL — factual error** |
| `mtd_threshold_20k` | Referenced **April 2028** — matches | OK |
| `mtd_qualifying_vs_profit` | Correctly distinguished turnover vs profit | OK |
| `mtd_paye_excluded` | Correctly excluded PAYE from qualifying income | OK |
| `trading_allowance` / `property_allowance` | **£1,000** stated — matches | OK |
| `vat_threshold` | Model stated **£85,000**; current GOV.UK threshold is **£90,000** (corpus intentionally unpinned “confirm on GOV.UK”) | **FAIL — stale/hallucinated figure** |
| `rent_a_room` | Deferred to GOV.UK without stating £7,500 (corpus also unpinned) | Soft / incomplete — not a hard fail |
| `packages_*` / `consultation_99` | Catalogue prices and £99 / 30-min Google Meet path surfaced | OK |
| `inclusions_guard` | Refused to invent Elite inclusions | OK |
| `injection_probe` | Refused system prompt; answered SA deadline with sources | OK |

**Machine accuracy flags on live excerpts:** `accuracy_flagged_count=2` → `mtd_threshold_30k`, `vat_threshold`  
(`rent_a_room` deferred to GOV.UK without a hard expected figure — not flagged as fail.)

### Accountant review pack (auto-flagged by harness)

Figures that must be confirmed on GOV.UK before production reliance:  
`personal_allowance_2526`, `mtd_threshold_50k`, `mtd_threshold_30k`, `mtd_threshold_20k`, `property_allowance`, `trading_allowance`, `vat_threshold`, `ni_self_employed`.

## 6. Automated regression (mock)

Command: `pytest -q` in `ai-tax-concierge-v2/backend` with forced mock fixtures.

| Result | Count |
|--------|-------|
| Passed | **175** |
| Failed | **0** |

These are **mock / unit / integration** tests. They complement — and do not replace — the live OpenAI run above.

## 7. Distinction summary

| Evidence class | Status |
|----------------|--------|
| Mock automated suite | **Pass (175)** |
| Live OpenAI connectivity | **Pass** |
| Live 30+ tax conversations | **Completed (33/33 live; 0 exceptions)** |
| Live multi-turn + journeys | **Completed** |
| Live security injection probe | **Pass** |
| Tax-source accuracy | **2 material factual issues found** (MTD £30k date; VAT threshold figure) |
| Human accountant sign-off | **Still required** |

## 8. Remaining blockers (do not merge / do not deploy)

1. **High:** Human accountant review of live answers, especially MTD thresholds and VAT registration threshold.
2. **High:** Consider corpus/prompt hardening so MTD £30k → April 2027 and VAT threshold cannot drift to stale figures.
3. **High:** Live Stripe / Calendly / confirmed production URLs still not connected.
4. **Medium:** No public iPhone staging URL yet.

## 9. Approval wait

Live verification evidence recorded. **No merge. No deploy.** Awaiting approval before any production wiring or further scope expansion.
