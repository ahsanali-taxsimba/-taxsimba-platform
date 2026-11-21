# Decision-policy generalisation pass — evidence

**Verdict: NOT READY FOR STAGING**  
PR #43 / #45 remain **HOLD**. No deploy.

Fresh unseen 500 is strong (98.4%) and multi-turn memory/no-buy gates are clean, but the hard gate **“0 incorrect SA/MTD obligation conclusions caused by missing facts”** is not met (3 premature SA-style conclusions on the locked bank: N007, N008, N029). N042 (`50k qi 24/25`) is treated as a scorer/expectation edge — QI + year are present and the MTD band answer is consistent with GOV.UK bands.

---

## Before / after — prior 128 failures

| Stage | Improved | Still fail | Tax errors | Premature packages | Missing clarifications |
|-------|----------:|-----------:|-----------:|-------------------:|-----------------------:|
| Locked blind (before) | — | 128 | 1 | 28 | 92 |
| Retest pass1 (first decision-policy) | 86 | 42 | 0 | 0 | 41 |
| Retest pass2 (landlord year + amount parse) | 114 | 14 | 0 | 0 | 13 |
| Retest pass3 (tentative side + amount correction) | 124 | 4 | 0 | 0 | 3 |

Pass3 residuals: G008 (PAYE-only “fine?”), G029 (starting business first steps), G042 (Simbian/Xero wording vs GENERAL_INFO), G049 (crypto buy vs sell — educational answer; expected MORE_INFO).

Root-cause classes for the original 128: see `FAIL128_ROOT_CAUSES.md` / `FAIL128_ANALYSIS.json`.

---

## Exact general-engine changes

See `ENGINE_CHANGES.md`. Summary: `decision_policy.ts` (understand → educate/clarify/answer → package gate); wired into `conversational_engine`; SA year gate for rent; trading-allowance ≠ SA £1k wording; amount-correction + tentative side clarify classes; MTD educational band answers; VAT £90k educational answer; eval harness budget override for live blinds.

No architecture rebuild. No test-ID hardcoding.

---

## Tax-error investigation (1)

`TAX_ERROR_G066_INVESTIGATION.md` — SOURCE-VERIFIED: SA sole-trader “more than £1,000” vs trading allowance relief. Retest tax-error tag: **0**.

---

## Fresh locked unseen 500 (after fixes)

Locked before answers: `blind_v2/BLIND_V2_500_SCENARIOS.json`  
Results: `blind_v2/BLIND_V2_500_RESULTS.json` / `SUMMARY.json`

| Metric | Value |
|--------|------:|
| Exact | 428 |
| Acceptable | 64 |
| Fail | 8 |
| Pass (exact+acceptable) | **98.4%** |
| FACTUAL_TAX_ERROR | **0** |
| PREMATURE_PACKAGE | **0** (0.0%) |
| MISSING_CLARIFICATION | 6 |
| UNNECESSARY_CLARIFICATION | 1 |
| Clarification recall (MORE_INFO expected) | **96.9%** (185/191) |
| Wrong SA/MTD from missing facts | **3** (N007, N008, N029) |
| Empty replies | 0 |
| Packages on GENERAL_INFO expected | 0 |

---

## Fresh locked unseen 100 multi-turn

`blind_v2/BLIND_V2_100_MULTI_RESULTS.json` (clean run after fixing in-process token budget 429s)

| Metric | Value |
|--------|------:|
| Journeys | 100 |
| Deep 8+ turns | 35 |
| Memory defects | **0** |
| Premature package after no-buy | **0** |
| Timeouts | **0** |

---

## 20 unedited conversations

`blind_v2/TWENTY_UNEDITED_CONVERSATIONS.md` (includes failing singles).

---

## Source verification progress

From prior independent GOV.UK work (unchanged this pass; Asim approval still unavailable):

| Bucket | Live tax rows |
|--------|--------------:|
| SOURCE-VERIFIED | 64 |
| AMBIGUOUS_NEEDS_CLARIFICATION | 12 |
| REQUIRES_PROFESSIONAL_ADVICE | 1 |
| NO_AUTHORITATIVE_SOURCE_FOUND | 123 |
| PROFESSIONAL_APPROVAL_OBTAINED | 0 |

Labels remain SOURCE-VERIFIED / MODEL-ASSESSMENT / PROFESSIONAL-ADVICE-REQUIRED — never “verified” by self-agreement alone.

---

## Vitest

`VITEST_REGRESSION_FINAL.log` — **9 files, 70 tests passed** (decision_policy, sa/mtd eligibility, intent_clarifier, recommendations, conversational_engine, multiturn, grounding, helpful_first).

---

## Launch-target checklist (fresh bank)

| Target | Result |
|--------|--------|
| ≥95% exact/acceptable | **PASS** 98.4% |
| 0 critical tax-rule errors | **PASS** |
| 0 incorrect MTD/SA from missing facts | **FAIL** (3) |
| ≤1% premature packages | **PASS** 0% |
| ≥95% necessary clarifications identified | **PASS** 96.9% |
| No repeated questions for known facts (multi) | **PASS** (0 memory defects) |
| No material context-memory failures | **PASS** |
| No package after explicit no-buy | **PASS** |
| Educational questions without forced sales | **PASS** |

---

## Why not READY

Overall generalisation is much improved and the new blind is above 95%, but the obligation-before-product hard gate still fails on a small set of messy “am I in trouble / PAYE only / thinking of starting” prompts. Fix those classes further before staging.
