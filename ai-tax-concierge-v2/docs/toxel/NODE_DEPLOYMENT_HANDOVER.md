# Toxel — SIMBA Node.js Deployment Handover

**Product:** SIMBA AI (Node Express + TypeScript)  
**Path:** `ai-tax-concierge-v2/backend-node/`  
**PR #35 — DO NOT MERGE / DO NOT DEPLOY TO PRODUCTION**  
**Python fallback retained:** `ai-tax-concierge-v2/backend/`

---

## 1. What to run in staging

```bash
cd ai-tax-concierge-v2/backend-node
npm ci                             # or npm install
npm run build                      # tsc → dist/ (required before npm start)
export OPENAI_API_KEY=***          # secret store only — never commit
export CONCIERGE_FORCE_MOCK_LLM=false
export CONCIERGE_CORS_ORIGINS=https://staging.example,https://www.taxsimba.co.uk
export WEBSITE_BASE_URL=https://www.taxsimba.co.uk
export CONSULTATION_BOOKING_URL=https://calendly.com/<real-event>
export PORT=8090                   # or behind reverse proxy
export HOST=0.0.0.0
npm start                          # node dist/server.js — no tsx / no Python
```

- Preview: `https://STAGING_HOST/widget/preview.html`  
- Panel: `https://STAGING_HOST/widget/index.html`  
- Health: `GET /api/v1/health` → `llm_mode` should be `openai`  
- Embed: `/widget/embed.js` with `data-api-base="https://STAGING_HOST"`

Node ≥ **20** required (`package.json` engines).

**Data:** HMRC catalog, corpus, journeys and routes are **vendored JSON copies** under `backend-node/data/` (no symlinks to the Python tree; Python process not required at runtime). Widget static files are served from `../widget` relative to `backend-node`.

---

## 2. Environment variables (names only)

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | Yes (live) | Server-only |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `OPENAI_TIMEOUT_SECONDS` | No | Default `30` |
| `CONCIERGE_FORCE_MOCK_LLM` | No | `true` forces mock |
| `CONCIERGE_CORS_ORIGINS` | Yes (staging) | Explicit allowlist, no `*` |
| `CONCIERGE_ENV` | No | e.g. `staging` |
| `CONCIERGE_LOG_LEVEL` | No | Default `INFO` |
| `WEBSITE_BASE_URL` | Yes | Calculator/package deep links |
| `CONSULTATION_BOOKING_URL` | When live | Calendly event |
| `PORT` / `HOST` | No | Default Node dual-run `8091`; staging often `8090` / `0.0.0.0` |

---

## 3. Routing / HTTPS

| Path | Purpose |
|------|---------|
| `/api/v1/*` | SIMBA API (chat, journeys, bootstrap, analytics, sessions) |
| `/widget/**` | Static Emerald Signature UI + embed |
| `/` | Product metadata JSON |

Terminate TLS at load balancer / reverse proxy. Forward to Node. Ensure iframe embedding allowed for the marketing site origin (`frame-ancestors` already set for `/widget`).

---

## 4. Secrets & security

- Never put `OPENAI_API_KEY` in the browser, screenshots, or git  
- Bootstrap/health omit secrets  
- Analytics events are engagement-only (not verified purchases)  
- Stripe / Calendly / portal auth remain stubs until you wire them  

---

## 5. Verification commands

```bash
npm test                 # 212 Vitest behaviours
npm run build && npm start
npm run live:openai      # 33 live cases (needs key; mock disabled)
curl -s https://STAGING_HOST/api/v1/health
```

Parity evidence: `docs/PYTHON_VS_NODE_PARITY_REPORT.md`  
Independent audit (2026-11-13): `docs/verification/FINAL_INDEPENDENT_VERIFICATION.md`  
Intelligence & sales audit (2026-11-13): `docs/verification/COMPREHENSIVE_INTELLIGENCE_SALES_AUDIT.md`  
Automated tests: **425** Vitest (includes 150 tax + 50 package journey suites)

---

## 6. Rollback

1. Point reverse proxy back to Python uvicorn (`ai-tax-concierge-v2/backend`) **or** previous Node image.  
2. Widget files are identical — no frontend rollback required.  
3. Do not delete Python until staging acceptance is signed.

---

## 7. Still blocked until you test on HTTPS staging

- Stripe test checkout + webhooks (verified conversion)  
- Calendly £99 / 30-min Google Meet booking confirmation  
- Registration + email verification  
- Existing-client authenticated dashboard messaging  
- Production website embed on taxsimba.co.uk  

---

## 8. Isolation reminder

Do not modify TaxSimba portal (`/backend`, `/frontend`), taxotools, Marketing Hub, or live production site from this package without separate authorisation.
