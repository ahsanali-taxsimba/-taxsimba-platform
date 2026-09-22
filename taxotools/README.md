# Taxotools

Multi-tenant SaaS for **SEO analytics**, **rank tracking**, **technical site health**, **content intelligence**, **AI article generation**, and **AEO/GEO AI visibility** — competing with Semrush / Ahrefs / Surfer-style platforms, with AI answer-engine visibility as a differentiator.

> This project lives under `/taxotools` and uses **isolated ports** so it does not collide with other apps:
> Web `3100` · Postgres `5433` · Redis `6380` · MinIO `9010`

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/web (Next.js App Router · React · TypeScript)              │
│  Marketing · Auth · Onboarding · Dashboards · Module UIs         │
│  API routes → service layer (tenant, usage, SEO, AI, AEO, …)     │
└───────────────┬───────────────────────────────┬──────────────────┘
                │                               │
                ▼                               ▼
     packages/database                   Redis / BullMQ
     (Prisma · PostgreSQL)               (job queues)
                ▲                               │
                │                               ▼
                └────────────── apps/worker (crawl, rank, AI, AEO, reports)
```

**Why this shape fits Taxotools**

| Choice | Rationale |
|--------|-----------|
| Account → Workspace → Site | Agencies manage many clients; each client can be a workspace; sites are the SEO unit of work |
| Next.js App Router + service layer | Fast product UI + clear API boundaries; public API can reuse the same services later |
| Prisma + PostgreSQL | Strong relational model for ranks, crawls, citations, billing; type-safe migrations |
| BullMQ + Redis (+ DB poller fallback) | Long-running crawl/rank/AEO/AI jobs with retries; still works if Redis is briefly down |
| Plan rows in DB (not hard-coded only) | New tiers / custom Enterprise limits without redeploying business logic |
| Stub providers behind interfaces | Ship product loops now; swap SERP / LLM / backlink vendors via env keys |

### Multi-tenancy

- **User** owns one **Account** (billing boundary).
- **Account** has many **Workspaces** (agency clients or internal brands).
- **WorkspaceMember** roles: `OWNER | ADMIN | EDITOR | VIEWER`.
- **Site** (project) holds keywords, crawls, backlinks, content, AEO records.
- Usage + Stripe subscription live on **Account**; feature gates read **Plan** flags (`apiAccess`, `whiteLabel`, `outreachCrm`).

### Background jobs

Queues (namespaced `taxotools-*`):

1. `crawl` — site crawl + issue detection  
2. `rank` — desktop/mobile rank + AI Overview flags  
3. `ai-content` — articles, outlines, meta, FAQ, schema, social  
4. `aeo-scan` — multi-engine visibility + citations  
5. `report` — HTML/PDF export payloads (S3 key)

Each enqueue writes a `BackgroundJob` row for observability; workers update status / attempts / errors.

---

## Monorepo layout

```
taxotools/
  apps/web/           Next.js UI + API routes
  apps/worker/        BullMQ workers + DB poller
  packages/database/  Prisma schema, client, seed
  packages/shared/    Plan limits, queue names, enums
  docker-compose.yml  Postgres + Redis + MinIO (isolated ports)
```

---

## Quick start (Taxotools only)

```bash
cd taxotools
cp .env.example .env

# Infrastructure (isolated containers)
docker compose up -d

# Install + generate Prisma client
npm install
npm run db:generate
npm run db:push
npm run db:seed

# App (port 3100) + worker
npm run dev
npm run dev:worker   # separate terminal
```

**Demo login** (after seed): `demo@taxotools.com` / `TaxotoolsDemo1!`

---

## Core API surface

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | Create user + account + workspace |
| POST | `/api/auth/login` | Session cookie (JWT) |
| GET | `/api/me` | User, account, usage |
| GET/POST | `/api/sites` | List / create sites |
| GET | `/api/sites/:id` | Site overview payload |
| GET/POST/PUT | `/api/sites/:id/keywords` | Keywords, cluster, rank-check, gap |
| GET/POST | `/api/sites/:id/crawls` | Crawl history / start crawl |
| GET/POST | `/api/sites/:id/ai` | AI jobs + content score |
| GET/POST | `/api/sites/:id/aeo` | Visibility records / start scan |
| GET/POST | `/api/billing` | Plans + upgrade (Stripe or direct) |
| GET/POST | `/api/settings` | API keys + reports |

---

## Pricing model

Limits are stored on `Plan` and mirrored in `@taxotools/shared` `PLAN_LIMITS`:

- **Starter** — 1 site, limited keywords/crawls/AI/AEO  
- **Pro** — more capacity + outreach CRM  
- **Agency** — white-label, API, high limits  
- **Enterprise** — unlimited (`-1`) + SSO-ready account model  

`UsageRecord` tracks metered monthly metrics (`CRAWLS`, `AI_CREDITS`, `AEO_SCANS`). Sites/keywords/seats are live counts.

---

## UI map

- `/` — marketing landing  
- `/register`, `/login`, `/onboarding`  
- `/app` — account overview + usage  
- `/app/sites/[id]` — module hub  
- `/app/sites/[id]/{keywords,technical,content,aeo,backlinks,reports}`  
- `/app/billing`, `/app/settings`  

---

## Semrush-parity toolkits

Taxotools ships **66 tools** across **9 toolkits** (see `@taxotools/shared` `TOOLKIT_GROUPS`). The app sidebar lists every service:

1. **SEO Toolkit** — Domain Overview, Keyword Research/Magic/Strategy Builder, Gaps, Organic Research/Rankings, Position Tracking, SERP Features, Backlinks (Analytics/Gap/Audit), Link Building, Site Audit, On-Page Checker, SEO Content Template, Writing Assistant, Log File Analyzer
2. **AI Visibility (AEO/GEO)** — Visibility Scanner, Citations, Google AI Overviews, Sentiment, Competitor Mentions, Programmatic SEO, Bulk AI Content
3. **Traffic & Market** — Traffic Analytics, Market Overview, Audience Insights, Top Pages, EyeOn/Trends, Competitive Research
4. **Content Toolkit** — Topic Research/Finder, SEO Brief Generator, AI Article Generator, Content Audit, Marketing Calendar, Post Tracking, AI Writing Assistant, Content Templates
5. **Local Toolkit** — GBP Optimization, Listing Management, Review Management, Map Rank Tracker, Local Heatmaps, NAP Consistency
6. **Social Toolkit** — Social Poster/Tracker/Analytics, Social Content AI, Influencer Analytics, Social Listening
7. **Advertising Toolkit** — Advertising Research, Keyword CPC, PLA Research, AdClarity, Ads Launch Assistant, Ad Builder
8. **AI PR Toolkit** — Media Database, Media Monitoring, AI-Cited Media, PR Outreach
9. **Reports & Agency** — My Reports, White-label Reports, Scheduled Reports, Client Portal

Open tools from the **left sidebar**, `/app/toolkits`, or any site → toolkit hub.

API: `GET|POST /api/sites/:siteId/tools/:toolId`


---

## Scaling next steps

1. Replace stub SERP/crawl/AEO providers with vendor SDKs behind `packages/integrations`.  
2. Shard workers by queue; move heavy crawls to a dedicated fleet.  
3. Add ClickHouse/BigQuery for rank time-series at Agency scale.  
4. Public REST API with hashed `ApiKey` + rate limits.  
5. Stripe Customer Portal + usage-based metered items for AI credits.  
6. SSO (SAML/OIDC) for Enterprise on Auth.js.  

---

## Tests

```bash
cd taxotools
npm test
```

## Animations

Framer Motion system for page transitions, cards, tables, charts, and overlays.
See [`docs/ANIMATIONS.md`](docs/ANIMATIONS.md).
