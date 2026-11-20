# Ask SIMBA V2 — Final Intelligence Quality Evidence

**PR #43: HOLD — do not merge or deploy.**

Professional accountant approval: **NOT OBTAINED**.  
Do not claim “100% accurate”, “accountant approved”, or “production ready”.

Generated: 2026-11-20 (Europe/London)

---

## Scoreboard

| Stage | Exact | Partial | Fail | Notes |
|---|---:|---:|---:|---|
| Before (original holdout) | 64 | 52 | 84 | Baseline |
| Current (clarifier-first validation) | 157 | 6 | 37 | Pre this pass |
| Retest of those 37 after fixes | **37** | 0 | **0** | All fixed by class |
| Blind 250 (new, live OpenAI) | 193 | 18 | 39 | First classifier; see rescored |
| Blind 250 rescored (clarifier-aware) | 204 | 8 | 38 | Residual mostly LLM cash-gig paths |
| Blind 75 multi-turn | — | — | — | 75 journeys; **25 ≥8 turns**; **0** context-memory flags; **0** premature on no-buy |
| Score-20 unedited journeys | avg **7.6**/10 | — | — | `evidence/final_intelligence_pass/SCORE20_UNEDITED.md` |
| **Fresh post-fix blind v2 (locked)** | **192** | **7** | **1** | **96.0% exact** · expectations locked before answers |

### Fresh post-fix v2 tags (locked run)

| Tag | Count |
|---|---:|
| EXACT | 192 |
| PARTIAL | 7 |
| FAIL | 1 |
| FACTUAL/TAX ERROR | 0 |
| UNNECESSARY CLARIFICATION | 0 |
| MISSING CLARIFICATION | 0 |
| CONTEXT/MEMORY FAILURE | 0 |
| WRONG SERVICE | 0 |
| PREMATURE PACKAGE | 0 |
| MISSED APPROPRIATE TAXSIMBA OPPORTUNITY | 0 |
| UNNECESSARY CONSULTATION ESCALATION | 1 (false-positive tag on a correctly requested consult options reply) |

**Single FAIL (P024):** “trading allowance vs sa threshold?” — educational answer correctly discusses Self Assessment; classifier labelled `SA_ASSIST` vs expected `GENERAL_INFO`. Substantive content is not a tax-rule error. Not hidden inside PARTIAL.

---

## Failure-by-failure root-cause summary (prior 37)

See `evidence/final_intelligence_pass/FAILURE_37_DIAGNOSIS.md`.

| Cause class | Fix applied |
|---|---|
| Uncertain cash/gig + accountant ask | Clarifier fires on maybe/around + accountant / marketplace / bolt / bar work |
| Bare “I earn £X” as MTD QI | `hasSelfEmploymentOrProperty === null` for bare earn; clarifier asks type |
| Rent/MTD without tax year | Year required before exact-band answers |
| Crypto buy vs sell | Clarifier before crypto SA assertion |
| Dividends / joint property / personal sale / VAT | Clarifiers for missing facts / rolling VAT period |
| Salary↔freelance corrections | Latest-turn trading amount preferred |
| £99000 mistaken for £99 consult | Consultation price regex requires `£99` not followed by more digits |

---

## Official-source verification summary

Framework: `evidence/final_intelligence_pass/OFFICIAL_SOURCE_FRAMEWORK.md`  
Deepened individual audit of frozen T001–T400: `evidence/independent_audit/SUMMARY.json`

| Status | Count |
|---|---:|
| VERIFIED | 64 |
| INCORRECT | 1 |
| INCOMPLETE | 1 |
| UNVERIFIED | 310 |
| REQUIRES_PROFESSIONAL_ADVICE | 24 |
| PROFESSIONAL_APPROVAL_OBTAINED | **0** |
| REAL_MODEL_EXECUTED | 400 |

UNVERIFIED remains large where circumstance-specific conclusions cannot be uniquely established from public GOV.UK pages alone — marked honestly, not auto-PASSED. Key rules cite MTD exclusive bands (2024-25/2025-26/2026-27 → 6 Apr 2026/2027/2028), SA “more than £1,000”, QI definition, trading allowance as relief, CIS≠SA waiver, crypto disposal framing, P60/P45 not automatic SA, VAT rolling 12 months.

---

## 20 complete unedited conversations

Full transcripts + per-conversation scores (tax / understanding / helpfulness / conversation / service / sales restraint / next action):  
`evidence/final_intelligence_pass/SCORE20_UNEDITED.md`  
JSON: `evidence/final_intelligence_pass/SCORE20_JOURNEYS.json`

Average across 20: **~7.6 / 10**.

---

## Before / after examples

| Scenario | Before | After |
|---|---|---|
| Cash-in-hand maybe £1050 + Accountant? | Definitive SA | Clarifies amount/year first |
| I earn £50k. MTD? | Exact-band refusal inventing QI/year | Asks PAYE vs SE/property + year |
| Rental about £20k — digital tax? | Invented 2026-27 exact-band answer | Asks tax year |
| Crypto: tax on buy or sell? | Premature SA assertion | Clarifies disposal vs buy / trading |
| paye only £99000. mtd? | Wrongly opened £99 consultation | PAYE-only MTD out-of-scope |

---

## Remaining known limitations

- Blind-250 still has residual fails where live LLM answers cash-gig questions before clarifier patterns catch every informal phrasing (engine improved; not every historical blind reply re-executed).
- Classifier can mis-bucket educational SA/MTD explanations as assist classes (P024).
- 310/400 audit rows remain UNVERIFIED — not the same as incorrect; many need customer-specific facts or are commercial/CX.
- Multi-turn memory is improved for amount/year corrections but not proven exhaustive for every contradiction style.
- Professional tax sign-off still **not obtained**.

---

## Tests and commits

Unit / regression (this pass):

- `mtd_eligibility`, `sa_eligibility` (incl. correction preference), `intent_clarifier`, `threshold_comparison_regressions`, `independent_audit_fixes`, `consultation_price_boundary`

Scripts:

- `scripts/finalIntelligenceQualityPass.ts`
- `scripts/runFreshBlindPostFixV2.ts`
- `scripts/deepenIndividualAudit400.ts`
- `scripts/rescoreFinalIntelligencePass.ts`

---

## Staging targets vs evidence

| Target | Result |
|---|---|
| ≥95% exact on fresh unseen | **96.0% (192/200)** |
| Zero critical tax-rule errors | **0** on fresh v2 |
| Zero premature packages | **0** on fresh v2 |
| Zero known context-loss defects | **0** flagged on 75 multi-turn |
| Critical regression tests PASS | **PASS** (eligibility/clarifier suite) |

---

## Recommendation

**CONDITIONAL GO FOR STAGING REVIEW — PR #43 remains on HOLD (do not merge or deploy).**

Evidence supports staging consideration against the stated numerical targets on a fresh locked blind set, with help-first / clarifier-first behaviour and zero premature packages / zero critical tax errors on that set.  
It does **not** support claiming production readiness, accountant approval, or 100% accuracy. Keep iterating on residual blind-250 failure classes and UNVERIFIED audit rows before any production decision.
