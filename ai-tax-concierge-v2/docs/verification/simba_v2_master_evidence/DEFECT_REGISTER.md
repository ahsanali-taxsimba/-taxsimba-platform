# Defect register

| ID | Severity | Finding | Fix | Retest |
|----|----------|---------|-----|--------|
| D1 | Critical | Public catalogue leaked owner/metadata | Allowlist `catalog/public.ts` | PASS — allowlist tests |
| D2 | Critical | Exact £50k treated as in-scope MTD | Deterministic exclusive thresholds | PASS — unit + live 8/8 |
| D3 | Critical | PAYE included in qualifying income | Exclude PAYE; prefer trading/property amount | PASS — critical MS-0001 |
| D4 | Critical | Ltd company turnover treated as individual MTD | Limited-company boundary | PASS — critical + live |
| D5 | High | Consultation £99/30 min outdated | Dual £99/20 + £149/40 | PASS — catalogue + consult cases |
| D6 | High | Free callback advertised | Removed; email or paid video only | PASS — callback scenarios |
| D7 | High | “AI Tax Assistant” customer heading | Renamed Digital Tax Assistant | PASS — widget/API tests |
| D8 | High | Mobile chat jump after reply | Stick-to-bottom + Jump to latest + visualViewport | Code fixed; **physical-device recording BLOCKED** |
| D9 | Medium | Tax year digits parsed as income (£2,025) | Reject 1900–2100 pseudo-amounts | PASS |
| D10 | Medium | Original 33 master-suite misses | Genuine retrieval/eligibility defects fixed (handlers + clarifiers + ops path) | **PASS 537/537** — see `evidence/ORIGINAL_33_FAILURES_ANALYSIS.md` |
| D11 | External | HTTPS staging, Stripe, Calendly, portal E2E | Toxel | **BLOCKED / HOLD** |
| D12 | Low | Live journey scorer checked only final courtesy turn (LJ-13) | Whole-transcript scoring in `liveOpenAIJourneys20.ts` | PASS 20/20 on existing real OpenAI transcripts |

No unresolved critical/high product defects remain in repository-accessible scope. Device-level iPhone Safari scroll proof and payment/booking E2E remain external blockers under Production HOLD.
