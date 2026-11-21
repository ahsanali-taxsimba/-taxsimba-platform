# Decision-policy generalisation pass — evidence

**Verdict: INTELLIGENCE GATE PASSED — READY FOR STAGING INTEGRATION TESTING**

That means ready for **staging testing only**, **not** production-ready.

Tax propositions are **not** marked professionally accountant-approved in this report unless a named accountant sign-off exists. Prior live GOV.UK SOURCE-VERIFIED rows remain labelled as source verification, not accountant approval.

No deploy / production release from this gate alone.

---

## What was fixed (general policy — no N007/N008/N029 hardcoding)

Strengthened `decision_policy.ts` (+ light `mtd_eligibility` / engine / prompt wiring) so SIMBA distinguishes:

1. explaining a tax rule;
2. identifying a possible obligation;
3. concluding that a customer actually has an SA/MTD obligation.

General classes (not test IDs):

| Failure class | Policy behaviour |
|---|---|
| Marketplace / Depop-style selling | Clarify personal possessions vs trade before any SA conclusion |
| Explicit “personal possessions” | Educate / answer safely — do not re-ask the same fact |
| PAYE-only / PAYE wages alone | Not self-employment; do not invent SA; PAYE-only MTD → answer “does not apply” |
| Future intent (“thinking of starting…”) | CURRENT ≠ FUTURE — clarify whether activity has started |
| Amount / year / type missing | Answer what is safe; ask **one** useful clarification |
| Educational MTD bands / crypto buy-vs-sell | EDUCATE — do not over-interrogate |

Core invariants enforced: ACTIVITY ≠ automatic obligation; PLATFORM ≠ trading status; PAYE ≠ self-employment; POSSIBLE ≠ CONFIRMED.

---

## Retest — prior missed clarifications + N007 / N008 / N029

Evidence: `RETEST_MISSED_CLARIFICATIONS.json`

| ID | Result |
|---|---|
| N007 Depop | CLARIFY `marketplace_personal_vs_trade` — **0** wrong SA |
| N008 PAYE-only | CLARIFY `employment_status_ambiguity` — **0** wrong SA |
| N029 “thinking of starting…” | CLARIFY `future_intent_not_current` — **0** wrong SA |
| N005 / N042 / N048 | policy_ok |
| **Totals** | **6/6 policy_ok; wrong_sa 0; premature packages 0** |

---

## Vitest regression

**594 / 594** passed (`npx vitest run` in `backend-node`).

---

## Fresh locked unseen bank (blind_v3 — locked before answers)

Scenarios locked first (messy natural language: future intent, marketplace, PAYE, side income, property, gig, mixed income, vague asks, corrections). Implementation was not shown the new questions before lock.

| Artifact | Path |
|---|---|
| Single 500 lock | `blind_v3/BLIND_V3_500_SCENARIOS.json` |
| Single results | `blind_v3/BLIND_V3_500_RESULTS.json` |
| Multi 100 lock | `blind_v3/BLIND_V3_100_MULTI_SCENARIOS.json` |
| Multi results | `blind_v3/BLIND_V3_100_MULTI_RESULTS.json` |
| Summary | `blind_v3/SUMMARY.json` |
| Score-20 unedited | `blind_v3/SCORE20_V3_UNEDITED.md` |
| Run log | `blind_v3/RUN_GATE_FINAL.log` |

### Single 500 (live OpenAI)

| Metric | Value |
|--------|------:|
| Exact | **452** |
| Acceptable | **48** |
| Fail | **0** |
| Pass (exact+acceptable) | **100%** |
| FACTUAL_TAX_ERROR / tax-rule errors | **0** |
| PREMATURE_PACKAGE | **0** (0.0%) |
| MISSING_CLARIFICATION | **0** |
| UNNECESSARY_CLARIFICATION | **0** |
| Necessary-clarification recall | **100%** (285/285) |
| Wrong SA conclusions (missing facts) | **0** |
| Wrong MTD conclusions (missing facts) | **0** |
| Empty replies / timeouts (single) | **0** |

Unedited failing conversations: **none** (0 fails).

### Multi 100 (live)

| Metric | Value |
|--------|------:|
| Journeys | 100 |
| Memory defects | **0** |
| Premature package after no-buy / no-buy breaches | **0** |
| Timeouts | **0** |

---

## Launch targets

| Target | Result |
|---|---|
| ≥95% exact/acceptable | **PASS** (100%) |
| 0 critical tax-rule errors | **PASS** |
| 0 wrong SA/MTD conclusions from missing facts | **PASS** |
| ≤1% premature packages | **PASS** (0%) |
| ≥95% necessary-clarification recall | **PASS** (100%) |
| No material memory failures | **PASS** |
| No no-buy breaches | **PASS** |

---

## Prior context (not the fresh gate)

- Prior 128 retest: **124** improved (pass3).
- Prior blind_v2: 98.4% with 3 wrong-SA missing-facts (blocker) — **superseded by blind_v3**.
- Source verification (prior): 64 SOURCE-VERIFIED live GOV.UK tax rows; remaining unverified labelled honestly — **not** accountant-approved.

---

## Final statement

**INTELLIGENCE GATE PASSED — READY FOR STAGING INTEGRATION TESTING**
