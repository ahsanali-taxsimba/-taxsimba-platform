# TaxoTools Backend — UK Accountancy Backlinks Database

Supabase-backed discovery + crawl + scoring + API for UK accountancy firm backlinks.

## Folder structure

```
taxotools-backend/
├── src/
│   ├── discovery/          # Companies House, Google, directories
│   ├── crawler/            # Domain crawl, Common Crawl inbound
│   ├── scoring/            # Open PageRank + backlink scoring
│   ├── supabase/           # Client + upsert helpers
│   ├── api/                # Express REST API
│   ├── cron/               # Weekly/monthly jobs + continuous cycle
│   └── utils/
├── supabase-schema.sql
├── .env.example
├── package.json
└── README.md
```

## Environment

Copy from monorepo `taxotools/.env` or set:

```bash
SUPABASE_URL=https://YOUR.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...                 # optional
OPEN_PAGERANK_API_KEY=...             # or OPENPAGERANK_API_KEY
COMPANIES_HOUSE_API_KEY=...           # optional free key
SERP_API_KEY=...                      # optional (Google discovery)
COMMON_CRAWL_INDEX=CC-MAIN-2026-17
CRAWL_DELAY_MS=500
MAX_PAGES_PER_DOMAIN=200
USER_AGENT=TaxoToolsBot/1.0 (+https://taxotools.com)
BACKEND_PORT=3200
DIRECT_URL=postgresql://...           # for db:apply
```

Also accepts `NEXT_PUBLIC_SUPABASE_URL` from the main Taxotools app `.env`.

## Setup

```bash
cd taxotools/taxotools-backend
npm install
npm run db:apply          # creates tables on Supabase
npm run test:smoke        # verifies connection + demo firms
```

## Commands

| Script | Purpose |
|---|---|
| `npm run discover` | Find UK accountants |
| `npm run crawl` | Crawl firms + Common Crawl inbound |
| `npm run score` | Refresh Open PageRank authorities |
| `npm run cycle` | Discovery → Crawl → Score once |
| `npm run cron:weekly-crawl` | Weekly backlink refresh |
| `npm run cron:monthly-discovery` | Monthly discovery |
| `npm run cron:weekly-authority` | Weekly authority update |
| `npm start` | API on `:3200` |

## API

- `GET /accountants`
- `GET /backlinks?domain=example.co.uk`
- `GET /referring-domains?domain=example.co.uk`
- `GET /competitor-backlinks?domain=example.co.uk`
- `POST /ops/discover` · `POST /ops/crawl` · `POST /ops/cycle`

## Continuous crawling

Run on a schedule (cron / GitHub Actions / Railway):

```bash
# every day
npm run cycle

# or split
0 3 * * 0  npm run cron:weekly-crawl
0 4 1 * *  npm run cron:monthly-discovery
0 5 * * 0  npm run cron:weekly-authority
```

## Tables

See `supabase-schema.sql`:

- `accountancy_firms`
- `uk_backlinks` (+ view `backlinks`)
- `referring_domains`
- `crawl_logs`

`uk_backlinks` avoids clashing with the main Taxotools Prisma `Backlink` table.
