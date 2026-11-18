# UK tax accuracy verification report

**Obtained via:** automated master suite (mock + deterministic handlers) + live OpenAI/MTD probes  
**Do not claim 100% accuracy.** Critical tax-rule regressions must be zero for launch.

## Controls in place

1. Verified HMRC/GOV.UK corpus retrieval with source URLs and tax years  
2. Deterministic MTD eligibility (`mtd_eligibility.ts`) — exclusive thresholds; PAYE excluded; Ltd company excluded  
3. Deterministic MTD operations vs eligibility (`mtd_operations.ts`)  
4. Intent clarifier for ambiguous income  
5. Grounding guards against stale VAT £85k memory  
6. Regression suites: master 537, tax intelligence 150, MTD unit tests, live MTD remediation 8/8  

## Headline results

| Suite | Result | Mode |
|-------|--------|------|
| Master single-turn | 537/537 | Mock + deterministic |
| Master multiturn | 50/50 | Mock + deterministic |
| Live MTD boundaries | 8/8 | OpenAI adapter + deterministic short-circuit |
| Vitest (full) | 520/520 | Unit/integration |
| Model comparison critical | 0 critical fails on both models | Real OpenAI |

## Known residual risk

- Open-ended tax questions beyond corpus still use the LLM under grounding rules — uncertainty language required when sources missing  
- Material HMRC rule changes: auto-publish only for verified low-risk monitor updates; material changes quarantine for accountant approval  
- Staging monitor scheduler + ops token must be enabled before claiming continuous freshness  

## Escalation policy

High-risk tax questions that cannot be validated from verified sources must acknowledge uncertainty and offer paid consultation / GOV.UK — not invent figures.
