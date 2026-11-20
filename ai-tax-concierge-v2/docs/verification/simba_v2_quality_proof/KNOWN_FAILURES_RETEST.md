# Known failures — investigation, correction, regression evidence

**Process:** Independent evidence-based review (Asim sign-off is **not** a completion blocker).  
**Professional approval:** NOT OBTAINED (do not treat AI verification as accountant sign-off).  
**Production:** HOLD — do not merge or deploy PR #43.

## Summary of fixes

| Issue | Root cause | Code change | Status after fix |
| --- | --- | --- | --- |
| T329 freelance/file matching | Word `file` matched substring inside `freelance` | `mtd_eligibility.ts`: `\bfile\b` | PASS (unit + mock) |
| £8,000 vs £1,000 trading allowance / SA | Sole-trader amount compared to personal allowance (£12,570) | `sa_eligibility.ts`: sole-trader vs £1,000 | PASS |
| Exact £50,000 vs over £50,000 MTD | Exact £50k treated as “more than” | `amountStatedAsMoreThan` + clarifier/engine order | PASS |
| D03 forgot earlier income | Follow-up MTD check ignored prior history amounts | `extractAmounts` + history scan in MTD | PASS |
| D10 early package | Early Simple Self Assessment SKU on first help turn | Deterministic help-first reply (no SKU) | PASS |
| D02 landlord/PAYE + MTD wording | PAYE-only / landlord paths and MTD “more than” wording | PAYE-only MTD denial + SA PAYE path + prompts | PASS |

Corrected mock responses: `evidence/independent_audit/KNOWN_FAILURES_CORRECTED_RESPONSES.json`  
Unit evidence: `tests/independent_audit_fixes.test.ts`, `tests/threshold_comparison_regressions.test.ts` (all green).

---

## 1. T329 — freelance / file matching

### Original incorrect behaviour
Utterance containing “freelance” could match the substring `file` used for MTD document-upload intent, sending the customer down the wrong path.

### Corrected rule
Match whole word `\bfile\b` only (and similar whole-word patterns), not substrings inside “freelance”.

### Code change
`src/agents/mtd_eligibility.ts` — file-intent regex tightened to word boundaries.

### New actual SIMBA response (mock retest)
> With qualifying income of £1,000, you are not above the current Making Tax Digital Income Tax thresholds that use “more than £50,000” …

### Regression evidence
- `tests/independent_audit_fixes.test.ts` — T329-style utterance
- Historical LIVE pack still records prior failure in frozen T329 row; corrected behaviour proven in unit/mock retest (do not claim LIVE 400 re-run)

---

## 2. £8,000 freelance income and £1,000 trading allowance / SA

### Original incorrect behaviour
Freelance turnover of ~£8,000 could be compared against the £12,570 personal allowance path instead of the sole-trader £1,000 threshold, understating SA need.

### Corrected rule
For sole-trader / freelance turnover statements, compare to the **£1,000** trading-allowance / SA registration threshold (HMRC: self-employed if you earned more than £1,000 from self-employment). Personal allowance is a separate concept.

### Code change
`src/agents/sa_eligibility.ts` — sole-trader amount vs £1,000.

### New actual SIMBA response (mock retest)
> With freelance / self-employment income of £8,000 for 2025-26, you are above the £1,000 sole-trader threshold, so you usually need to register for Self Assessment …

### Official sources (supporting rule, not the frozen transcript)
- https://www.gov.uk/self-employed-tax-returns — Working for yourself / Self Assessment when self-employed
- https://www.gov.uk/tax-relief-for-employees — trading allowance context (related)

### Regression evidence
`tests/independent_audit_fixes.test.ts`, `tests/threshold_comparison_regressions.test.ts`

---

## 3. Exact £50,000 versus over £50,000 MTD eligibility

### Original incorrect behaviour
“I earn £50,000 exactly” could be treated as over the MTD band.

### Corrected rule
HMRC MTD for Income Tax uses **more than** £50,000 (2024-25 qualifying income) for the April 2026 cohort — exact £50,000 is **not** over that threshold.

### Code change
`src/agents/mtd_eligibility.ts` — `amountStatedAsMoreThan`; engine runs MTD before ambiguous clarifier for threshold wording.

### New actual SIMBA response (mock retest)
> No — qualifying income of exactly £50,000 for 2024-25 does not bring you into Making Tax Digital under that band …

### Official sources
- https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax
- https://www.gov.uk/guidance/check-if-you-need-to-use-making-tax-digital-for-income-tax (threshold language: more than)

### Regression evidence
`tests/independent_audit_fixes.test.ts` (exact £50k → not MTD)

---

## 4. D03 — forgetting earlier customer income

### Original incorrect behaviour
Customer stated ~£52,000 turnover; follow-up “Do I need MTD from April 2026?” lost the prior amount.

### Corrected rule
Eligibility extractors must scan conversation history for prior income amounts when the current turn is a yes/no follow-up.

### Code change
`mtd_eligibility.ts` / amount extraction — history-aware amounts.

### New actual SIMBA response (mock retest)
> Yes — if your qualifying income was more than £50,000 for 2024-25, you need to use Making Tax Digital for Income Tax from April 2026 …

### Regression evidence
`tests/independent_audit_fixes.test.ts` (D03 memory path)

---

## 5. D10 — introducing a package prematurely

### Original incorrect behaviour
First turn “I already know I need Self Assessment help” could surface Simple Self Assessment SKU immediately.

### Corrected rule
Help-first: explain accountant-led service, signup/consultation routes; **no package SKU** until the customer asks for packages or a clear package-fit path exists.

### Code change
`conversational_engine` / help-first deterministic reply for known-need SA help.

### New actual SIMBA response (mock retest)
> Understood — TaxSimba’s Self Assessment service is accountant-led: you register and pay on the TaxSimba portal…  
(packages: `[]`)

### Regression evidence
`tests/independent_audit_fixes.test.ts`, `tests/helpful_first_no_pressure.test.ts`

---

## 6. D02 — landlord / PAYE and MTD wording

### Original incorrect behaviour
PAYE-only customers could receive MTD/SA ambiguity; landlord + PAYE wording needed clearer “more than” and PAYE-only denial.

### Corrected rule
- PAYE-only employment → MTD for Income Tax does **not** apply.
- Property / mixed income → apply MTD “more than £50,000 / £30,000” rules with tax-year clarity.
- Intent clarifier must not steal clear PAYE / exact-threshold questions.

### Code change
`sa_eligibility.ts` (payeOnly), `intent_clarifier.ts` (income-type guard), `mtd_eligibility.ts`, prompts 3a.

### New actual SIMBA response (mock retest, PAYE-only MTD)
> If your only income is PAYE employment, Making Tax Digital for Income Tax does not apply to you …

### Regression evidence
`tests/independent_audit_fixes.test.ts`, `tests/intent_clarifier.test.ts`

---

## Retest counts (this change)

| Metric | Value |
| --- | --- |
| Known-failure unit cases retested successfully | 6 (independent_audit_fixes) + threshold suite |
| Full backend Vitest | 559 passed |
| LIVE full 400 re-run | **Not repeated** (per instructions) |
| Professional approval | **NOT OBTAINED** |
