# Ask SIMBA — Targeted classification intelligence correction

**PR:** #43 · **HOLD / NO-GO** · Professional approval: **NOT OBTAINED**  
**Architecture:** Existing Node ConversationalEngine preserved (no rebuild).  
**Original holdout evidence:** unchanged at `evidence/holdout200/HOLDOUT_200_RESULTS.json`

---

## 1. Diagnosis of the original 84 failures

Source: `evidence/holdout200/classification_fix/FAILURE_84_DIAGNOSIS.md`

| Root cause | Count (multi-label) |
|------------|--------------------:|
| missing_clarification | 58 |
| classification_matcher_mismatch | 12 |
| missing_escalation | 6 |
| misunderstood_income_type | 3 |
| incorrect_package_selection | 3 |
| incorrect_mtd_or_sa_obligation | 2 |
| premature_selling | 2 |
| failure_to_respect_user_intent | 1 |
| other_evidenced | 2 |

**Dominant expected→observed pairs:** MORE_INFO→MTD_ASSIST (40), MORE_INFO→SA_ASSIST (26).  
SIMBA often stated obligations (or MTD explanations) before establishing income type, amount, or tax year.

---

## 2. Engine improvements (generalisable — not test hardcoding)

1. **Clarifier-first routing** in `conversational_engine.ts`: definitive SA/MTD answers win; otherwise circumstance clarifier with `prefer_over_eligibility_probe` beats SA/MTD “needs more info” probes that assume self-employment.  
2. **Expanded `intent_clarifier.ts`:** P60, two PAYE jobs, left-job/`SA`, company car, underpaid PAYE, rent+PAYE without amount, Airbnb/room, gig/DJ/cash-in-hand, educational MTD/quarterly updates, property/digital-tax without tax year, dividends without full picture, CIS without facts, crypto buy-vs-sell.  
3. **MTD eligibility:** recognise “digital tax”, figure+MTD without “do I need”, `\brent\b` amounts, PAYE-only `MTD?`; in-scope replies also mention Self Assessment.  
4. **SA eligibility:** recognise `SA needed` shorthand; keep do-not-ask self-employed strip for T303.  
5. **Sales restraint:** NO_BUY phrases already expanded; CIS path no longer pushes packages.  
6. **Prompts:** never infer SA/MTD from a bare total-income figure alone.

Official sources used in clarifier/eligibility copy:  
- https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return  
- https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax  
- https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax  
- https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income  
- https://www.gov.uk/what-is-the-construction-industry-scheme  
- https://www.gov.uk/guidance/check-if-you-need-to-pay-tax-when-you-sell-cryptoassets  

---

## 3. Before / after — original 84 failures (live OpenAI)

| Metric | Original holdout (those 84) | Retest v1 | Retest v2 (latest) |
|--------|----------------------------:|----------:|-------------------:|
| Exact classification | 0 | 60 | **59** |
| Partial | 0 | 3 | **1** |
| Fail | 84 | 21 | **24** |
| Premature packages | — | 1 | **1** |
| Clarifying replies | — | 65 | **62** |
| OpenAI | 84 | 84 | **84** |

Original full holdout (preserved): exact **64** / partial **52** / fail **84** of 200.

### Before → after examples

| ID | Before (frozen holdout) | After (retest) |
|----|-------------------------|----------------|
| H001 TikTok | Concluded SA if >£1k without amount | Asks how much / which tax year before concluding |
| H002 Rent + PAYE | Assumed SA without rent figure | Asks rent amount and tax year; notes PAYE ≠ rental tax |
| H013 P60 | SA-oriented | Explains P60 is PAYE record; asks other income |
| H016 Left job | Steered to self-employment SA | Leaving job alone ≠ SA; asks other income |
| H035 What is MTD | MTD assist without facts | Explains MTD + asks income type/amount/year |
| H092+ rent £X MTD | MTD answer without year | Asks tax year for band (or safe ≤£20k out-of-band) |

---

## 4. NEW unseen validation set (≥200)

Expectations written first: `VALIDATION_200_SCENARIOS.json`  
Results: `VALIDATION_200_RESULTS.json` (v1 preserved as `_v1.json` when re-run)

| Metric | Validation v1 | Validation v2 (latest) |
|--------|--------------:|-----------------------:|
| OpenAI | 200 | **200** |
| Exact | 83 | **157** |
| Partial | 10 | **6** |
| Fail | 107 | **37** |
| Premature packages | **0** | **0** |
| Exact + partial | 93 (46.5%) | **163 (81.5%)** |

Files: `VALIDATION_200_RESULTS_v1.json` · `VALIDATION_200_RESULTS_v2.json` · scenarios pre-registered in `VALIDATION_200_SCENARIOS.json`.

---

## 5. Remaining defects

- Some ACCOUNTANT_CONSULTATION cases still get informational SA/penalty text without clear consult escalation.  
- Contradiction questions (no SE + freelance £12k) still resolve on the trading figure (acceptable) but expected MORE_INFO.  
- Matcher vs “helpful denial” wording still needs care (improved in scoring script).  
- **345/400** frozen pack answers remain UNVERIFIED (separate tax audit — not solved by classification work alone).  
- Staging email / payment / Calendly / HMRC monitor / mobile: still **UNVERIFIED**.

---

## 6. Staging-readiness recommendation

**NO-GO for production / not staging-ready for customer launch.**

Classification intelligence is **materially improved**:
- Original 84 fails → **59/84 exact** on retest v2 (vs 0 before).  
- New unseen validation → **157/200 exact**, **0 premature packages** (vs 83 exact on v1).  

Still insufficient for GO:
- **37/200** validation classification fails remain.  
- **345/400** frozen tax answers still UNVERIFIED.  
- Staging email / payment / Calendly / HMRC monitor / mobile **UNVERIFIED**.  

**Keep PR #43 unmerged. Production HOLD.** Automated testing ≠ professional accountant approval.
