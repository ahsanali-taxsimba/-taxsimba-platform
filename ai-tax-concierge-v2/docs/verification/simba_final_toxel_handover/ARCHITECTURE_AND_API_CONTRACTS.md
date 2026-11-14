# Architecture and API Contracts

## Runtime

- **Primary:** Node.js v22.23.4 Express TypeScript — `ai-tax-concierge-v2/backend-node/`
- **Retained:** Python FastAPI — `ai-tax-concierge-v2/backend/` (dual-run / fallback; not required for Node staging)
- **UI:** `ai-tax-concierge-v2/widget/` static Emerald Signature embed
- **Default ports:** Node `8091`, Python often `8090`

## Key endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Liveness + llm_mode |
| GET | `/api/v1/config` | Safe public config (no secrets) |
| GET | `/api/v1/bootstrap` | Widget bootstrap |
| POST | `/api/v1/chat` | Conversational engine |
| GET | `/api/v1/catalog/packages` | Approved catalogue |
| GET | `/api/v1/knowledge/freshness` | Knowledge + catalogue freshness |
| GET | `/api/v1/admin/knowledge/status` | Admin knowledge status |
| POST | `/api/v1/admin/knowledge/check` | Trigger source checks |
| POST | `/api/v1/admin/knowledge/rollback` | Rollback knowledge version |
| POST | `/api/v1/admin/catalogue/refresh` | Refresh catalogue |
| POST | `/api/v1/admin/catalogue/staging/growth-price` | Staging price override |
| POST | `/api/v1/admin/catalogue/staging/restore` | Clear staging override |
| GET | `/widget/*` | Embed UI |

Admin routes: non-production open unless `SIMBA_ADMIN_TOKEN` set; production requires `x-simba-admin-token`.

## Data

- Curated corpus: `backend-node/data/corpus/`
- Dynamic knowledge: `backend-node/data/knowledge/`
- Catalogue: `backend-node/data/catalog/packages.json` (+ optional remote/staging override)
