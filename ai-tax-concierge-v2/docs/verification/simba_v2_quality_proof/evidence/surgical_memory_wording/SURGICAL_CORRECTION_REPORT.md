# SIMBA V2 — Surgical correction + regression evidence

**Final recommendation: CONDITIONAL GO** (for staging/integration review only)

**Production: HOLD** until (1) this evidence is reviewed, (2) Asim professionally approves tax content, (3) Toxel completes controlled staging/integration testing, (4) remaining production gates pass.

Do **not** merge or deploy to production from this task alone.

---

## PR / commit

| Item | Value |
|------|-------|
| Working branch | `cursor/simba-v2-memory-wording-6522` |
| Base (authoritative stack) | built on current PR #45 / independent-verify (which includes PR #42 TaxSimba-first behaviour) |
| Commit SHA | 425f21db72286884331b0d2676517a2dba2598d3 |
| PR | *(filled when opened)* |

No architecture rewrite. No unrelated portal/UI/security/routing changes.

---

## Files changed (and why)

| File | Reason |
|------|--------|
| `backend-node/src/knowledge/sa_eligibility.ts` | Fix multi-turn memory: extract “side maybe £X”; newest-first amount/year for short follow-ups (`sa?`) so established facts are reused |
| `backend-node/src/knowledge/mtd_eligibility.ts` | Newest-first year/amount for `mtd?`; year-correction (“was for 2025-26 not 2024-25”); clearer MTD vs annual-return wording on QI answers |
| `backend-node/src/knowledge/mtd_operations.ts` | Tighten quarterly-updates vs annual return wording; restate TaxCalc/Xero / no direct portal filing |
| `backend-node/src/knowledge/intent_clarifier.ts` | Correct general SA explanation (calculation determines tax due); broaden “what is SA/MTD” educational catch; MTD annual-return wording |
| `backend-node/src/ai/prompts.ts` | Guardrails: memory reuse; no “HMRC calculates for you”; MTD quarterly ≠ annual return |
| `backend-node/tests/conversation_memory_regressions.test.ts` | Regressions A–E + preserved PAYE-only / wording checks |
| `backend-node/scripts/surgicalMemoryWordingEvidence.ts` | Live/mock evidence harness for 15 targeted journeys |
| `docs/.../surgical_memory_wording/*` | Evidence artefacts |

---

## Automated tests

| Suite | Result |
|-------|--------|
| `npx vitest run` (full) | **606 / 606 passed** (0 fail) |
| New memory regressions | **12 / 12 passed** |

---

## Memory defect — before / after

### Before (blind_v3 `VJ006`, unedited)

After establishing side £1,675 / 2025-26 / before expenses / PAYE main known / SA concluded, customer asked `sa?` and SIMBA **re-asked** amount and tax year. The following `mtd?` turn correctly remembered £1,675 / 2025-26.

### After (deterministic + live J01)

**Deterministic `sa?` reply (unedited):**

```
With freelance / self-employment income of £1,675 for 2025-26, you are above the £1,000 sole-trader threshold, so you usually must register for Self Assessment and send a tax return. …
```

- `needs_more_info=false`
- `trading_income_gbp=1675`
- `must_usually_file=true`
- Does **not** re-ask amount/year

**Live OpenAI J01** (`EVIDENCE.json`, `live_openai=true`): `sa?` and `mtd?` both reuse £1,675 / 2025-26.

---

## General Self Assessment answer (after, unedited)

```
Self Assessment is HMRC’s system for people who need to report income that isn’t fully taxed another way (for example through PAYE alone). You report the relevant income, expenses, allowances and other information on your tax return, and your Self Assessment calculation determines the tax due. Many sole traders, landlords and people with untaxed income must send a return — but whether that applies to you depends on your circumstances. If you share your income types and a rough amount for a tax year, I can help you check. Official guidance: https://www.gov.uk/self-assessment-tax-returns/who-must-send-a-tax-return
```

- Does **not** say HMRC always calculates the customer’s tax.
- Does **not** invent a personal filing conclusion.

---

## MTD annual-return wording (after, unedited)

**Operations:**

```
No — MTD quarterly updates do not replace your annual tax return. They are summaries of self-employment and property income and expenses sent through compatible software. If you’re within MTD, you’ll also submit your tax return through compatible software (and pay any tax due by the usual deadline). …
```

**QI eligibility path** also uses the compatible-software / annual-return clarification (see deterministic `mtd_qi_annual_return_wording` in `EVIDENCE.json`).

---

## Targeted regression matrix (15)

| # | Scenario | Mode | Result summary |
|---|----------|------|----------------|
| 1 | PAYE + side → SA → MTD | **Live OpenAI** | PASS — `sa?`/`mtd?` remember £1,675 / 2025-26 |
| 2 | Property + freelance QI | Live | PASS — MTD from Apr 2027; annual-return wording |
| 3 | Amount correction | Live | PASS — £900 wins over £2,000 |
| 4 | Tax year correction | Live | PASS — 2025-26 / Apr 2027 (not Apr 2026) |
| 5 | Second income source | Live | PASS — combined QI |
| 6 | PAYE-only MTD | Live | PASS — not QI |
| 7 | Marketplace possessions | Live | PASS — clarify personal vs trade |
| 8 | Future intention | Live | PASS — clarify started vs planned |
| 9 | What is SA? | Live | PASS — corrected calculation wording |
| 10 | What is MTD? | Live | PASS — quarterly ≠ annual return |
| 11 | No packages | Live | PASS — SA answer, no package dump |
| 12 | Later cheapest SA | Live | PASS — package only after explicit ask |
| 13 | TaxSimba vs independent software | Live | Recorded in evidence (TaxSimba-first / Xero included vs DIY) |
| 14 | Continuity SA after PAYE+freelance | Live | PASS — remembers £8k / uses SA rule |
| 15 | Long then `sa?`/`mtd?` | Live | PASS — short follow-ups reuse facts |

Full unedited transcripts: `EVIDENCE.md` / `EVIDENCE.json`.

---

## Counts (keep categories separate)

| Category | Count / status |
|----------|----------------|
| Live OpenAI targeted journeys | **15** (this surgical harness) |
| Mock evaluation in this harness | **0** (ran with `LIVE=1`) |
| Full Vitest (mock adapters / deterministic) | **606 passed** |
| Prior blind_v3 500/100 | Separate prior evidence on PR #45 — **not re-claimed here as re-run** |
| GOV.UK source verification | Unchanged prior SOURCE-VERIFIED rows; this task did not expand that set |
| Professional/accountant approval | **NOT OBTAINED** (Asim pending) |

Do **not** treat prior “400 mock” packs as live-verified tax passes.

---

## Preserved behaviours (regression)

Confirmed still green via Vitest + live sample:

- PAYE-only ≠ MTD QI  
- Combined property + SE QI  
- Vague totals → one clarification  
- Marketplace ≠ automatic trading  
- Future intent ≠ invented current obligation  
- No package dump on ordinary tax Qs / no-buy  
- Package discussable when later explicitly asked  
- MTD threshold/date bands unchanged  

---

## Known unresolved / honest notes

- Early turns in live J01 may still give provisional SA guidance before amount/year are fully locked (soft LLM turns); the **defect under fix** was the post-establishment `sa?` re-ask — that is fixed.
- Professional accountant approval remains outstanding.
- Staging/integration by Toxel not done in this task.
- Production remains HOLD.

---

## Staging / integration status

**Ready for review of this surgical patch + controlled staging testing** — not production-ready.

**Recommendation: CONDITIONAL GO** (staging/integration only after human review).
