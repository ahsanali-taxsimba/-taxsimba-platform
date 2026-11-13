# Official Source Registry and Freshness

Registry path: `backend-node/data/knowledge/registry/source_registry.json`

Critical sources (6–12h checks): MTD eligibility, MTD qualifying income, VAT thresholds, Self Assessment, Income Tax rates.

Additional sources (24h): National Insurance, CIS, property income, CGT, expenses, penalties, foreign income (escalate residency).

Freshness API: `GET /api/v1/knowledge/freshness`  
Admin status: `GET /api/v1/admin/knowledge/status`  
Audit: `data/knowledge/audit/*.jsonl`

If a critical source is stale, conflicting, or quarantined, SIMBA must not confidently quote the affected rule (alerts surfaced on freshness endpoint).
