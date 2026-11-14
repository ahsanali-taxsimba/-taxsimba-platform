# Tax Accuracy and Regression Results

| Suite | Result | Evidence |
|-------|--------|----------|
| Full Vitest | **479/479 PASS** | `evidence/vitest_full.txt` |
| Dynamic HMRC proof | PASS | `evidence/dynamic_hmrc_knowledge_proof.json` |
| MTD £50k/Apr 2026 vs £30k/Apr 2027 | Covered by validators + knowledge tests | corpus + proof quarantine of mix-up fixture |
| VAT £90k / £88k | Validator present | `validators.ts` |
| Live OpenAI probes | BLOCKED this run | Needs staging key |

SIMBA provides general UK tax information with GOV.UK sources when available. **Not** guaranteed personal advice. Escalate complex/residency/cross-border and unverified interpretation to a real accountant.
