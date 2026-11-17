# Updated Toxel Staging Deployment Instructions

**Branch:** `cursor/simba-v2-final-corrected-6522`  
**Base for review:** `cursor/simba-final-toxel-handover-6522` (PR #36)  
**Do not deploy to production.**

## 1. Checkout and verify

```bash
git fetch origin cursor/simba-v2-final-corrected-6522
git checkout cursor/simba-v2-final-corrected-6522
cd ai-tax-concierge-v2/backend-node
npm ci
npm test          # expect 502 pass
npm run typecheck
npm run build
```

Optional remediation probes:

```bash
npm run smoke:remediation
CONCIERGE_FORCE_MOCK_LLM=false npm run live:mtd-remediation
```

## 2. Required staging environment (names only — no secrets in chat/logs)

| Variable | Guidance |
|----------|----------|
| `OPENAI_API_KEY` | Required for live LLM |
| `CONCIERGE_FORCE_MOCK_LLM` | `false` |
| `CONCIERGE_ENV` | `staging` |
| `CONCIERGE_CORS_ORIGINS` | Exact staging + taxsimba origins — **no `*`** |
| `WEBSITE_BASE_URL` | `https://www.taxsimba.co.uk` |
| `CONSULTATION_BOOKING_URL` | Real Calendly URL only when ready |
| `CONSULTATION_BOOKING_LIVE` | `false` until booking is connected |
| `CONCIERGE_OPS_TOKEN` | Required for ops routes |
| `CONCIERGE_HMRC_MONITOR_ENABLED` | `true` on staging |
| `CONCIERGE_HMRC_MONITOR_INTERVAL_MS` | Optional (default 6h) |
| `CONCIERGE_CATALOGUE_SYNC_ENABLED` | `true` on staging |
| `CONCIERGE_CATALOGUE_SYNC_INTERVAL_MS` | Optional |
| `CONCIERGE_RUNTIME_DIR` | Writable path for overlays/alerts/history |
| `PORT` / `HOST` | e.g. `8090` / `0.0.0.0` behind TLS |

Template: `ai-tax-concierge-v2/.env.example`

## 3. Start behind HTTPS

```bash
npm start
# TLS at reverse proxy → Node
# health: GET /api/v1/health  → product SIMBA AI, llm_mode openai, env staging
# public: GET /api/v1/catalog/packages  (must not contain owner_decisions etc.)
# public: GET /api/v1/bootstrap
# ops:    POST /api/v1/ops/hmrc/run  +  POST /api/v1/ops/catalog/sync
#         (header x-concierge-ops-token)
```

Embed widget from staging origin only; keep TaxSimba logo assets as shipped.

## 4. Staging smoke after deploy

1. Health: `env=staging`, `llm_mode=openai`, no API keys in body.
2. Catalogue JSON: only allowlisted package fields; Simbian names + verified prices.
3. Bootstrap: `consultation.booking_available=false` until live flag; logo present.
4. Chat: exact £50,000 → **not** in MTD scope; free callback refused; SA Simple for first-time sole trader.
5. Ops monitor/sync: authenticated run succeeds or fails safely with alert (no silent corruption).

## 5. Rollback

Redeploy previous known-good tip of `cursor/simba-final-toxel-handover-6522` (`5cea956`) or prior Node image. Knowledge/catalogue rollback ops routes remain as in PR #35/#36.
