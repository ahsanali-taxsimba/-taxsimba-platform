# Ask SIMBA V2 — Independent verification & generalisation proof

**Branch:** `cursor/simba-v2-independent-verify-6522` (PR #45, stacked on PR #43)  
**Generated:** 2026-11-21 (Europe/London)  
**Professional tax approval:** **NOT OBTAINED** (Asim not performing verification)  
**PR #43 / #45 status:** **HOLD — do not merge or deploy**

---

## Verdict

# NOT READY FOR STAGING

### Exact remaining blockers

1. **Blind generalisation pass rate too low for staging:** 298 exact + 74 acceptable = **372/500 (74.4%)** on a new locked unseen bank — not evidence that customers can ask almost any normal UK SA/MTD question safely.
2. **Independent GOV.UK VERIFIED coverage still thin:** of **200 tax-category** rows, live re-query source-backed VERIFIED = **64** (0 live INCORRECT post-fix); deterministic-handler-only VERIFIED = **16**; remaining **~135** left unverified honestly. Frozen pack also showed **5 INCORRECT** historical answers (engine fixed; not re-marked VERIFIED merely because fixed).
3. **Clarification / classification defects remain:** 92 missed-clarification tags, 27 wrong-service tags, 28 premature-package tags on the 500-set.
4. **Multi-turn evidence degraded by LLM timeouts:** 450/664 multi turns (67.8%) returned `[NO_REPLY_TIMEOUT]` under live load — memory/no-buy heuristics on completed turns look good (0 memory defects, 0 premature-on-nobuy), but conversational A–M proof is incomplete until timeout/rate-limit reliability is fixed.
5. **No accountant/professional sign-off** on remaining unverified tax propositions.

---

## 1. Tax knowledge verification (GOV.UK / HMRC primary)

### Method

- VERIFIED **only** when an official GOV.UK/HMRC rule establishes the factual claim.
- Sounds-reasonable / matches-expected-answer ≠ VERIFIED.
- Official fact library: `backend-node/src/knowledge/uk_tax_facts.ts` (fetched/confirmed 2026-11-20 against current GOV.UK pages including who-must-send, MTD bands, QI, dividends, crypto, landlord repairs).

### Frozen pack T001–T400 (prior live answers)

| Status | Count |
|---|---:|
| VERIFIED | 9 |
| INCORRECT | 5 |
| INCOMPLETE | 3 |
| AMBIGUOUS_NEEDS_CLARIFICATION | 26 |
| REQUIRES_PROFESSIONAL_ADVICE | 1 |
| NO_AUTHORITATIVE_SOURCE_FOUND | 356 (incl. 200 non-tax CX rows) |
| TAX_CATEGORY_ROWS | 200 |

**INCORRECT (frozen) — root causes fixed in engine (generalisable, not test-ID patches):**

| ID | Defect | Official source |
|---|---|---|
| T006 | Dividend allowance stated £2,000 | https://www.gov.uk/tax-on-dividends (£500) |
| T046 | SE+rent treated separately for MTD QI | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax |
| T048 | Profit/turnover answered as VAT | same QI page |
| T050 | Wrong basis year for multi-year MTD | https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax |
| T066 | Accountant cannot submit MTD updates | https://www.gov.uk/guidance/choose-agents-for-making-tax-digital-for-income-tax |

**INCOMPLETE (frozen):** T038 / T063 / T089 educational questions dumped catalogue — fixed with educational handlers (filing vs payment; quarterly vs final declaration; repairs vs improvements).

### Live re-query GOV.UK verify (200 tax rows)

| Status | Count |
|---|---:|
| VERIFIED | **64** |
| AMBIGUOUS_NEEDS_CLARIFICATION | 12 |
| REQUIRES_PROFESSIONAL_ADVICE | 1 |
| NO_AUTHORITATIVE_SOURCE_FOUND | 123 |
| INCORRECT (post-fix live) | **0** |
| INCOMPLETE (post-fix live) | **0** |

Artifact: `evidence/independent_govuk_verify/LIVE_TAX_GOVUK_VERIFY_200.md`.

### Deterministic-handler-only cross-check (200 tax rows)

| Status | Count |
|---|---:|
| VERIFIED | 16 |
| AMBIGUOUS_NEEDS_CLARIFICATION | 27 |
| NO_AUTHORITATIVE_SOURCE_FOUND | 29 |
| HANDLER_NOT_APPLICABLE | 128 |
| INCORRECT (post-fix handlers) | 0 |

Artifact: `DETERMINISTIC_TAX_GOVUK_VERIFY_200.md`.

**Remaining unverified (~135 live):** NO_AUTHORITATIVE_SOURCE_FOUND + ambiguous rows — left unverified **honestly** because no unique GOV.UK establishment was recorded for that Q&A without inventing VERIFIED. Full ID lists in the JSON artifacts.

---

## 2. Code changes (generalisable)

| Area | Change |
|---|---|
| `mtd_eligibility.ts` | QI combine without requiring “MTD”; profit-vs-turnover; multi-year start dates; PAYE false-positive fix on “self-employment” |
| `mtd_operations.ts` | Agent can submit; quarterly ≠ return; educational quarterly vs final declaration without catalogue dump |
| `intent_clarifier.ts` | Vague gig/TikTok/PAYE-only/tenant-vs-landlord; dividend allowance £500; filing vs payment; landlord repairs vs improvements; low babysitting boundary |
| `sa_eligibility.ts` | Do not steal MTD combine / profit-turnover questions |
| `conversational_engine.ts` | Prefer MTD ops before educational clarifiers that mention “quarterly” |
| `uk_tax_facts.ts` | Official fact library with source URLs |
| Tests | `uk_tax_facts_fixes.test.ts` + existing MTD/SA/clarifier suites |

---

## 3. New locked blind bank (unseen)

- **500** single-turn + **100** multi-turn locked **before** answers (`BLIND_500_SCENARIOS.json`, `BLIND_100_MULTI_SCENARIOS.json`).
- Not paraphrases of prior V/H/B/F/P banks.
- Coverage: PAYE, SE, freelancers, gig/Uber/delivery, landlords, property+employment, multi-job, CIS, crypto, dividends, savings/CGT, side hustles, students, pensioners, job change, business start, thresholds (below/exact/above), MTD, SA, both/neither/unknown terminology, TaxSimba/DIY/no-buy/accountant, slang, adversarial.

---

## 4. Blind 500 single-turn results

| Metric | Count |
|---|---:|
| Total | 500 |
| OpenAI live | 440 |
| Exact | **298** |
| Acceptable | **74** |
| Fail | **128** |
| Pass (exact+acceptable) | **372 (74.4%)** |
| Critical tax-error tags | **1** |
| Premature-package tags | **28** |
| Missing-clarification tags | **92** |
| Wrong-service tags | **27** |

Artifact: `evidence/general_intelligence_blind600/BLIND_500_RESULTS.json`.

**Example tax-error tag:** G066 side photography £955 — answer asserted “may not need” without enough casual-vs-trading clarification (boundary language risk).

**Example success classes:** exact MTD exclusive thresholds; PAYE-only out of MTD; QI combine; educational “what is SA/MTD”; no-buy SA help; vague delivery/TikTok clarification-first.

**Example failures:** pensioner interest / CIS / ETH gain / two PAYE jobs still sometimes answered as SA without needed clarification; some GENERAL_INFO expected rows classified as SA_ASSIST because educational replies mention Self Assessment (classifier + behaviour both need further hardening).

---

## 5. Blind 100 multi-turn results

| Metric | Count |
|---|---:|
| Total journeys | 100 |
| Deep (≥8 turns) | 38 |
| Memory defects (heuristic) | **0** |
| Premature package on no-buy | **0** |
| No-buy journeys respecting no-sell | 20/20 observed |
| Turn timeouts | **450 / 664 (67.8%)** |
| Journeys with ≥1 timeout | 88 |

**Honest limitation:** high OpenAI/timeout rate under serial live load means A–M conversational scoring is only partially evidenced. Completed non-timeout turns show memory/no-buy discipline, but this is **not** sufficient staging proof.

Artifact: `BLIND_100_MULTI_RESULTS.json`.

---

## 6. Conversational A–M (where evidenced)

| Criterion | Assessment |
|---|---|
| A Understand ask | Improved on slang/gig via clarifier-first; still fails some CIS/crypto/pensioner cases |
| B General info correct | Strong when deterministic; mixed when LLM |
| C Remember supplied facts | Heuristic memory defects **0** on multi (non-timeout) |
| D Only necessary clarification | Still over-/under-asks (92 miss-clarify tags on singles) |
| E Avoid premature SA/MTD | Better; not solved |
| F Identify SA/MTD/both/neither/uncertain/advice | Partial |
| G Explain why | Deterministic MTD/SA replies cite GOV.UK |
| H Help-first | Improved; premature packages still 28 |
| I Recommend TaxSimba only when justified | Partial |
| J Correct catalogue package | Not fully proven at scale |
| K No-buy continue helping | **0** premature-on-nobuy in multi |
| L Multi-turn memory updates | Heuristic OK; timeout-limited |
| M Latest fact overrides | Designed in MTD extract; score20 re-run captures correction journeys |

---

## 7. Adversarial

Bank includes: contradictory amounts, missing year, ambiguous 50k, £/commas/typos, gross vs profit, PAYE+property, mid-conversation correction, multi-question messages, slang, change-mind on TaxSimba, Xero/TaxCalc, unrelated tax-first. Evidence: seeded in `BLIND_*_SCENARIOS.json` and score20 R02/R04/R13/R18/R19.

---

## 8. Twenty representative conversations

See `SCORE20_UNEDITED.md` / `SCORE20_JOURNEYS.json`.

**Re-run (60s timeout):** 20/20 journeys completed with **0** `[NO_REPLY_TIMEOUT]` turns (84 assistant turns). These are the authoritative unedited representative transcripts for this report. Initial multi-100 pass remains timeout-degraded as noted above.

---

## 9. Vitest / regression

```
tests/uk_tax_facts_fixes.test.ts     9 passed
tests/mtd_eligibility.test.ts       10 passed
tests/intent_clarifier.test.ts      13 passed
tests/sa_eligibility.test.ts         7 passed
tests/consultation_price_boundary    2 passed
Total                               41 passed
```

---

## 10. HOLD

- **Do not merge PR #43 or PR #45.**
- **Do not deploy.**
- Prior holdout 192/200 exact remains historical evidence for a different locked set — this pass **did not** optimise against those 200 questions.

---

## Bottom line

Meaningful engine fixes against official GOV.UK defects are in place, and a new 500/100 bank exists. Staging is **blocked** by insufficient generalisation pass rate, thin source-backed VERIFIED coverage of remaining tax rows, residual premature/clarification defects, and unreliable multi-turn live completion under timeout/rate limits.
