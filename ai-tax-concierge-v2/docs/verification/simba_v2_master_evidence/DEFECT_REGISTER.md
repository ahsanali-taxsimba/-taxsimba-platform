# Defect register

| ID | Severity | Finding | Fix | Retest |
|----|----------|---------|-----|--------|
| D1 | Critical | Public catalogue leaked owner/metadata | Allowlist `catalog/public.ts` | PASS — allowlist tests |
| D2 | Critical | Exact £50k treated as in-scope MTD | Deterministic exclusive thresholds | PASS — unit + live 8/8 |
| D3 | Critical | PAYE included in qualifying income | Exclude PAYE; prefer trading/property amount | PASS — critical MS-0001 |
| D4 | Critical | Ltd company turnover treated as individual MTD | Limited-company boundary | PASS — critical + live |
| D5 | High | Consultation £99/30 min outdated | Dual £99/20 + £149/40 | PASS — catalogue + critical consult cases |
| D6 | High | Free callback advertised | Removed; email or paid video only | PASS — callback scenarios |
| D7 | High | “AI Tax Assistant” customer heading | Renamed Digital Tax Assistant | PASS — widget/API tests |
| D8 | High | Mobile chat jump after reply | Stick-to-bottom + Jump to latest + visualViewport | Code fixed; **device recording BLOCKED** |
| D9 | Medium | Tax year digits parsed as income (£2,025) | Reject 1900–2100 pseudo-amounts; prefer £-tagged amounts | PASS — landlord+PAYE case |
| D10 | Medium | Mock suite soft-expect misses (33/537) | Mostly non-critical mock retrieval phrasing | OPEN — non-blocking; criticals green |
| D11 | External | HTTPS staging, Stripe, Calendly, portal E2E | Toxel | BLOCKED / HOLD |

No unresolved critical/high product defects remain in repository-accessible scope except device-level scroll recording (code fixed; capture external).
