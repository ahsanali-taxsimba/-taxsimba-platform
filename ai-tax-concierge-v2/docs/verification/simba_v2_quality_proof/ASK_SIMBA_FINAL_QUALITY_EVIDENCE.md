# ASK SIMBA — Final Quality Evidence Report

**PR:** [#43](https://github.com/ahsanali-taxsimba/-taxsimba-platform/pull/43) · branch `cursor/simba-v2-quality-proof-6522`  
**Production / merge / deploy:** **HOLD — NO-GO**  
**Professional accountant approval:** **NOT OBTAINED** (Asim sign-off not required for this general-information audit; AI review ≠ regulated approval)  
**Engine:** Node ConversationalEngine (unchanged architecture)  
**Report time:** 2026-11-20, Europe/London

---

## 1. Executive verdict

Ask SIMBA V2 is **directionally helpful** on common UK tax-information paths (PAYE-only exclusion, £1,000 trading trigger, exclusive MTD “more than” bands, help-first packages) after targeted fixes, but it is **not yet trustworthy enough for production** because:

1. Only a minority of the frozen T001–T400 answers are independently **VERIFIED** against authoritative sources.  
2. Most rows remain **UNVERIFIED** after individual examination (not silently passed).  
3. Frozen live transcripts still contain confirmed **INCORRECT** answers (historical).  
4. Staging/email/payment/Calendly/HMRC-monitor/mobile remain **UNVERIFIED**.  
5. Unseen holdout (200) must finish with honest metrics before any GO claim.

**Recommendation: NO-GO / HOLD.**

---

## 2. Independent T001–T400 examination (strict statuses)

Every frozen live OpenAI answer was individually examined (`scripts/deepenIndividualAudit400.ts`). Prior “379 AMBIGUOUS” leftovers were **not** auto-passed — residuals are **UNVERIFIED**.

| Status | Count | Meaning |
|--------|------:|---------|
| **VERIFIED** | **25** | Deterministic rule + official source establishes conclusion AND answer aligns |
| **INCORRECT** | **2** | Confirmed factual/legal error in frozen transcript (T303, T329) |
| **INCOMPLETE** | **5** | Material missing / over-clarification blocked a decidable answer |
| **UNVERIFIED** | **345** | Individually read; sources do not uniquely establish the Q&A → not PASS |
| **REQUIRES_PROFESSIONAL_ADVICE** | **23** | Individualised liability / investigation / complex affairs |
| **AMBIGUOUS** | **0** | (legacy bucket cleared) |
| **BLOCKED** | **0** | |
| REAL_MODEL_EXECUTED | 400 | OpenAI ran — **not** the same as verified |
| PROFESSIONAL_APPROVAL_OBTAINED | 0 | |

**Files:**

- CSV: [`evidence/independent_audit/INDEPENDENT_AUDIT_400.csv`](./evidence/independent_audit/INDEPENDENT_AUDIT_400.csv)
- JSON: [`evidence/independent_audit/INDEPENDENT_AUDIT_400.json`](./evidence/independent_audit/INDEPENDENT_AUDIT_400.json)
- Narrative: [`evidence/independent_audit/INDEPENDENT_AUDIT_400.md`](./evidence/independent_audit/INDEPENDENT_AUDIT_400.md)
- Per-ID exam log: [`evidence/independent_audit/INDIVIDUAL_EXAMINATION_LOG.json`](./evidence/independent_audit/INDIVIDUAL_EXAMINATION_LOG.json)
- Live pack transcripts: [`evidence/pack400/simba_400_results_live_latest.json`](./evidence/pack400/simba_400_results_live_latest.json)

### 2.1 Incorrect (frozen live) — severity HIGH

| ID | Severity | Error | Official sources |
|----|----------|-------|------------------|
| **T303** | HIGH | PAYE-only history → still probed self-employment / did not clearly exclude SA | [Who must send](https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return) |
| **T329** | HIGH | Said £1,000 freelance is “below the £1,000 trading allowance” and no SA/MTD | [Who must send](https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return); [Trading allowance](https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income); [MTD if/when](https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax); [MTD QI](https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax) |

### 2.2 Incomplete (examples)

| ID | Issue |
|----|-------|
| T001, T121, T352 | Clear PAYE-only facts over-clarified |
| T057 | Exact £50k MTD blocked by generic income-type probe |
| T047 | Deadline/year pairing incomplete after exam |

### 2.3 Official sources used for tax-rule verification

| Topic | URL |
|-------|-----|
| Who must send a tax return | https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return |
| SA deadlines | https://www.gov.uk/self-assessment-tax-returns/deadlines |
| SA penalties | https://www.gov.uk/self-assessment-tax-returns/penalties |
| Register for SA | https://www.gov.uk/register-for-self-assessment |
| Trading / property allowance | https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income |
| MTD if/when | https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax |
| MTD qualifying income | https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax |
| Property rental income | https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income |
| CIS | https://www.gov.uk/what-is-the-construction-industry-scheme |
| Crypto disposals | https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets |
| Dividends | https://www.gov.uk/tax-on-dividends |
| VAT thresholds | https://www.gov.uk/vat-registration-thresholds |

Where a source does not establish the specific conclusion → **UNVERIFIED**.

---

## 3. Known fixes — original → rule → code → post-fix → retest

Detail: [`KNOWN_FAILURES_RETEST.md`](./KNOWN_FAILURES_RETEST.md)  
Mock responses: [`evidence/independent_audit/KNOWN_FAILURES_CORRECTED_RESPONSES.json`](./evidence/independent_audit/KNOWN_FAILURES_CORRECTED_RESPONSES.json)  
**Live OpenAI post-fix:** [`evidence/independent_audit/KNOWN_FAILURES_LIVE_RETEST.json`](./evidence/independent_audit/KNOWN_FAILURES_LIVE_RETEST.json)

| Issue | Original (frozen) | Correct rule | Code | Post-fix actual | Retest |
|-------|-------------------|--------------|------|-------------------|--------|
| **T329** | “freelance … below the £1,000 trading allowance … do not need SA or MTD” | PAYE excluded from QI; £1,000 freelance not MTD; exact £1,000 ≠ “below allowance” | `mtd_eligibility.ts` `\bfile\b`; SA boundary wording | Live: QI £1,000 not above MTD bands; PAYE excluded; **no** “below trading allowance” | **PASS (live OpenAI)** |
| **T303** | Asked for self-employment amount despite “only PAYE” + “do not ask if self-employed” | PAYE-only usually no SA | `sa_eligibility.ts` strip do-not-ask self-employed from payeOnly | Live v2: “usually do not need to send a Self Assessment…” | **PASS (live OpenAI v2)** |
| **£8k vs £1k** | Historical risk of allowance inversion | £8,000 > £1,000 → usually SA; allowance is relief | `sa_eligibility.ts` | Live: above £1,000 sole-trader threshold | **PASS (live OpenAI)** |
| **Exact £50k MTD** | Risk of treating as “over” | Exclusive “more than £50,000” | `amountStatedAsMoreThan` + engine order | Live T057: exact £50k does not bring into MTD band | **PASS (live OpenAI)** |
| **D03 memory** | Turn 3 re-asked for £52k already given | History-aware QI extract | `mtd_eligibility.ts` history | Live follow-up: MTD from 6 April 2026 | **PASS (live OpenAI)** |
| **D10 early SKU** | Turn 1 named Simple £119 | Help-first; zero packages until ask | `conversational_engine` help reply | Live: accountant-led explainer; **packages []** | **PASS (live OpenAI)** |
| **D02 PAYE/MTD** | Wording risks | PAYE-only MTD deny; property SA | payeOnly MTD + SA paths | Live T121: PAYE-only MTD does not apply | **PASS (live OpenAI)** |

Unit evidence: `tests/independent_audit_fixes.test.ts` (7 tests). Full Vitest suite re-run after final edits.

---

## 4. Customer journeys — 20 deep + 42 multi-turn

### 4.1 Deep20 scored (actual transcripts)

Full unedited five journeys: [`evidence/final_review/FIVE_UNEDITED_JOURNEYS.md`](./evidence/final_review/FIVE_UNEDITED_JOURNEYS.md)  
All deep chats: [`evidence/review/deep20/`](./evidence/review/deep20/)  
Heuristic flags: [`evidence/independent_audit/JOURNEY_AND_CLAIMS_AUDIT.md`](./evidence/independent_audit/JOURNEY_AND_CLAIMS_AUDIT.md)

Scores are 1–10 from transcript evidence — **not** automatic 10s.

| ID | Acc | Und | Mem | Clarity | Help | Follow-up | Pkg fit | No-sell | Next steps | Overall | Key evidence |
|----|----:|----:|----:|--------:|-----:|----------:|--------:|--------:|-----------:|--------:|--------------|
| D01 | 8 | 8 | 7 | 7 | 8 | 6 | 7 | 8 | 8 | **8** | £8k > £1k correct (T2); package only after ask (T5); T3 repeats T2 |
| D02 | 7 | 8 | 8 | 7 | 7 | 7 | 8 | 8 | 7 | **7** | Property → SA good; MTD band paraphrases need careful GOV.UK check |
| D03 | 7 | 7 | **3** | 6 | 6 | 5 | 7 | 8 | 6 | **5** | T2 correct >£50k→Apr2026; **T3 forgot £52k** (fixed in code later) |
| D04 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | **7** | See D04.md |
| D05 | 6 | 7 | 7 | 6 | 6 | 6 | 6 | **4** | 6 | **5** | No-buy heuristic FAIL in journey audit |
| D06 | 8 | 8 | 7 | 8 | 8 | 6 | 9 | **9** | 8 | **8** | PAYE-only → no SA; declined package appropriately |
| D07–D08 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | **7** | Service/onboarding paths |
| D09 | 6 | 7 | 7 | 6 | 6 | 6 | 5 | **4** | 6 | **5** | Premature package naming (heuristic FAIL) |
| D10 | 7 | 8 | 7 | 7 | 7 | 6 | 6 | **3** | 8 | **5** | **T1 named Simple £119** before ask (fixed later) |
| D11–D15 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | **7** | Mixed CX |
| D16 | 6 | 7 | 7 | 6 | 6 | 6 | 6 | **4** | 6 | **5** | No-buy FAIL flag |
| D17–D20 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | **7** | See transcripts |

**Average overall (approx): ~6.6 / 10** — competent on core tax facts when deterministic handlers fire; weaker on memory and sales restraint in frozen live deep chats.

### 4.2 Journeys42

Source: [`evidence/journeys40/live40_journeys_openai_latest.json`](./evidence/journeys40/live40_journeys_openai_latest.json)  
Heuristic: 42/42 completed OpenAI — **not tax VERIFIED**. Treat as conversation-coverage evidence only.

### 4.3 Successful vs unsuccessful examples

**Successful (D06 T1–T2):** Customer PAYE-only → SIMBA: typically won’t need SA; cites who-must-send. Zero packages.

**Successful (D01 T2):** £8,000 freelance → above £1,000 threshold; trading allowance explained as relief not waiver. Sources linked.

**Unsuccessful (D03 T3):** After stating £52k turnover, SIMBA asked again for qualifying income.

**Unsuccessful (D10 T1):** “I already know I need Self Assessment help” → immediately “Self Assessment Simple package for £119”.

**Unsuccessful (T329 frozen):** Trading-allowance inversion on exact £1,000.

---

## 5. Five complete customer journeys (summary)

Full unedited text: [`evidence/final_review/FIVE_UNEDITED_JOURNEYS.md`](./evidence/final_review/FIVE_UNEDITED_JOURNEYS.md)

### 1) First-time SA — D01
- Helpful on £8k threshold; practical records advice.  
- **Package introduced:** Turn 5 (customer asked which package) → SA_SIMPLE £119.  
- Turn 6 catalogue dump when asked inclusions — noisy but catalogue-aligned prices.  
- **Verdict:** Genuinely helpful for SA need; sales timing OK on this chat.

### 2) PAYE + rental — D02
- Correctly moves from PAYE to SA once £18k rent disclosed.  
- MTD discussion present; verify each band statement against current GOV.UK.  
- **Package:** not forced in early turns (Focus F2 also respected no-recommend).  
- **Verdict:** Helpful SA guidance; MTD wording → leave residual UNVERIFIED where paraphrased.

### 3) Approaching MTD — D03
- T2 correct for £52k → Apr 2026.  
- **Memory fail T3** (fixed in code + live retest).  
- **Verdict:** Frozen chat flawed; post-fix path improved.

### 4) No paid service — D06
- PAYE-only → no SA; when asked “Do I need a TaxSimba package?” declines appropriately.  
- **Package introduced:** none required.  
- **Verdict:** Strong help-first behaviour.

### 5) Wants TaxSimba — D10
- **Package introduced:** Turn 1 (premature Simple £119) — **inappropriate**.  
- Later signup link appropriate once customer commits.  
- **Post-fix live:** Turn 1 help-first, packages [].  
- **Verdict:** Frozen fail on sales restraint; fix verified live.

---

## 6. Business / package claims

[`evidence/independent_audit/BUSINESS_CLAIMS_AUDIT.json`](./evidence/independent_audit/BUSINESS_CLAIMS_AUDIT.json)

| Claim | Status |
|-------|--------|
| SA Simple/Smart/Elite £119/£149/£299 | VERIFIED vs catalogue |
| Simbian £29.99/£59.99/£89.99 VAT incl. | VERIFIED vs catalogue |
| Consultations £99 / £149 | VERIFIED vs catalogue |
| Signup https://www.taxsimba.co.uk/register | VERIFIED in code (HTTP not probed) |
| TaxCalc SA / Xero MTD; portal not direct HMRC filing | VERIFIED vs service model |
| Xero included in Simbian price | VERIFIED vs catalogue text |
| Staging email / Calendly live / payment / HMRC monitor / mobile | **UNVERIFIED** |

---

## 7. Unseen holdout 200 (mandatory)

Expectations written **before** SIMBA run: [`evidence/holdout200/HOLDOUT_200_SCENARIOS.json`](./evidence/holdout200/HOLDOUT_200_SCENARIOS.json)

### 7.1 Original holdout results (unchanged after later fixes)

Live OpenAI: [`HOLDOUT_200_RESULTS.json`](./evidence/holdout200/HOLDOUT_200_RESULTS.json) · [CSV](./evidence/holdout200/HOLDOUT_200_RESULTS.csv) · [50 journeys](./evidence/holdout200/HOLDOUT_50_JOURNEYS.json)

| Metric | Numerator / Denominator |
|--------|-------------------------|
| Real OpenAI single-turn | **200 / 200** |
| Service classification exact match | **64 / 200** (32%) |
| Classification partial | **52 / 200** (26%) |
| Classification fail (matcher) | **84 / 200** (42%) — many are “answered without clarifying” vs expected MORE_INFO_NEEDED |
| Premature packages (single-turn heuristic) | **4 / 200** |
| Tax-risk flag rows (allowance inversion / invented liability / fake booking) | **0 / 200** hard flags; 1 soft contradictory £3k wording (H112) |
| Hallucinated booking/payment | **0 / 200** |
| Multi-turn journeys completed | **50 / 50** |
| Info-only / “no paid package” respected in multi-turn | **FAIL 27 / 50** on original run (package shown after “I do not want a paid package”) |

**Do not claim 100% accuracy.** Classification matcher is independent of SIMBA prompts; exact-match rate is intentionally honest.

Examples (original holdout):

- **Good clarification needed but over-answered:** H001 TikTok — concluded SA if >£1k without asking amount first.  
- **Good no-service:** several PAYE-only / under-threshold paths.  
- **Bad sales:** H001–H007 multi-turn final turn showed `SA_SIMPLE` after customer refused packages.

### 7.2 Corrections from holdout findings + retest

Code: expand NO_BUY phrases; informal gig / “digital tax” clarifiers; remove premature Simple mention from online-selling clarifier; T303 payeOnly strip.

- Critical retest (labeled **retest**, not unseen): [`HOLDOUT_CRITICAL_RETEST.json`](./evidence/holdout200/HOLDOUT_CRITICAL_RETEST.json) — **5 / 5 PASS** (no-buy packages empty; TikTok asks amount; digital-tax clarifies income type; online selling clarifies; T329 no allowance inversion).  
- Fresh unseen validation after fixes: [`FRESH_VALIDATION_30.json`](./evidence/holdout200/FRESH_VALIDATION_30.json) — **30 / 30** OpenAI; **0** premature packages on non-package asks.

Original `HOLDOUT_200_RESULTS.json` was **not** overwritten.

---

## 8. Remaining blockers (production HOLD)

1. **345 UNVERIFIED** single-turn answers still need human/ChatGPT source matching before claiming broad accuracy.  
2. Frozen **INCORRECT** transcripts retained for honesty (fixes proven on live retest — full 400 not re-run).  
3. Original holdout: **42%** classification exact-fail + **27/50** info-only multi-turn fails (mitigated in code; fresh 30 clean).  
4. Staging SMTP, Calendly booking, payment, HMRC monitoring, mobile E2E — **UNVERIFIED**.  
5. Service-classification automation still weak vs independent expectations — needs more clarifier coverage.  
6. No professional accountant approval (and not claimed).

---

## 9. GO / NO-GO

| Question | Answer |
|----------|--------|
| Is Ask SIMBA a trustworthy production UK tax assistant today? | **No — NO-GO** |
| Are critical known defects fixed with live evidence? | **Mostly yes** (T303/T329/£8k/£50k/D03/D10/D02) |
| Is 400 executed = 400 verified? | **No** (25 VERIFIED) |
| Merge/deploy PR #43? | **Do not merge / do not deploy** |

---

## 10. ChatGPT second-review entry points

1. This file  
2. [`CHATGPT_REVIEW_PACK.md`](./CHATGPT_REVIEW_PACK.md)  
3. `evidence/independent_audit/INDEPENDENT_AUDIT_400.csv`  
4. `evidence/final_review/FIVE_UNEDITED_JOURNEYS.md`  
5. `evidence/holdout200/`  
