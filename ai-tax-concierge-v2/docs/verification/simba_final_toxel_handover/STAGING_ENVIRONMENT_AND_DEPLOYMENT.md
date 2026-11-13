# Staging Environment and Deployment

## Identity

- Branch: `cursor/simba-final-toxel-handover-6522` (base `cursor/ai-tax-concierge-v2-phase1-0f84` / PR #35 HOLD)
- Node: v22.23.4
- App path: `ai-tax-concierge-v2/backend-node`

## Commands

```bash
cd ai-tax-concierge-v2/backend-node
npm ci
npm test
npm run build
export CONCIERGE_ENV=staging
export OPENAI_API_KEY=***          # from secret store
export CONCIERGE_FORCE_MOCK_LLM=false
export CONCIERGE_CORS_ORIGINS=https://STAGING_HOST,https://www.taxsimba.co.uk
export WEBSITE_BASE_URL=https://www.taxsimba.co.uk
export CONSULTATION_BOOKING_URL=https://calendly.com/<approved-event>
export SIMBA_ADMIN_TOKEN=***
export PORT=8090
export HOST=0.0.0.0
npm start
```

Env template: `ai-tax-concierge-v2/.env.example` (no secrets).

## Health checks

- `GET /api/v1/health` → `status=ok`, preferred `llm_mode=openai` on staging
- `GET /api/v1/knowledge/freshness`
- `GET /api/v1/catalog/packages`
- Widget: `/widget/preview.html`

## HTTPS

Terminate TLS at reverse proxy; forward to Node. Allow iframe embed from marketing origin.

## Rollback

- App: redeploy previous Node build / prior commit
- Knowledge: `POST /api/v1/admin/knowledge/rollback` with `knowledge_version`
- Catalogue staging override: `POST /api/v1/admin/catalogue/staging/restore`
