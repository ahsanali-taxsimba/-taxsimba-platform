# TaxSimba — Node.js/TypeScript production source

UK tax platform for Self Assessment and Making Tax Digital (MTD) case management. This branch is
the **Node-only production source**: the React frontend plus the Node.js/TypeScript backend, with
the historical Python/Emergent backend removed. The Python reference remains on the
`nodejs-migration` branch for rollback and behavioural comparison only.

## Layout

| Path | Contents |
| --- | --- |
| `backend-node/` | Express 4 + TypeScript API, MongoDB driver, Stripe, email, reminder worker |
| `backend-node/tests/` | Vitest unit and integration suites (supertest against the real app) |
| `frontend/` | React 18 (CRA/craco) client, staff and admin UI |
| `memory/` | Deployment, cutover and handover documentation |

## Requirements

Node.js 20 LTS, Yarn (frontend), MongoDB 6 or 7. No Python runtime is required.

## Backend

```bash
cd backend-node
npm ci
cp .env.example .env      # fill in locally; never commit real values
npm run dev               # ts-node, or: npm run build && npm start
npm test                  # vitest
npm run lint && npm run typecheck
```

The API is served under `/api`. Database indexes and the `SELF_ASSESSMENT` service row are ensured
on every startup (`ensureCoreIndexes`/`ensureIndexes` in `src/app.ts`), independently of demo
seeding — set `SEED_DEMO_DATA=false` in staging and production so no demo accounts are created.

## Frontend

```bash
cd frontend
yarn install
echo "REACT_APP_BACKEND_URL=https://api.example.com" > .env
yarn start        # dev server on :3000
yarn build        # production bundle
```

The frontend talks to the backend through a single axios client (`src/lib/api.js`): base URL
`${REACT_APP_BACKEND_URL}/api`, session cookies plus a double-submit `X-CSRF-Token` header.
Pointing the frontend at a different backend is a configuration/reverse-proxy change only.

## Configuration

All configuration is environment-based; `backend-node/.env.example` lists every supported variable
name with no values. Secrets (JWT, TOTP Fernet key, Stripe, SMTP/Resend, S3) must be supplied by the
deployment environment and must never be committed.

Two values must be carried over unchanged from the previous deployment: `JWT_SECRET` and
`TOTP_FERNET_KEY` — a new Fernet key makes existing enrolled MFA secrets undecryptable.

## Deployment

- `memory/NODE_PRODUCTION_READINESS.md` — environment, Mongo, cookies/CORS/proxy, storage, indexes.
- `memory/NODE_PRODUCTION_CUTOVER_PLAN.md` — staging validation, cutover and rollback procedure.
- `memory/NODE_HANDOVER.md` — architecture and developer handover notes.
- `memory/NODE_FRONTEND_API_MAP.md` — every frontend call mapped to its backend route.
