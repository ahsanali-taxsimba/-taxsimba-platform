# TaxoTools Backend — UK Accountancy Continuous Intelligence

24/7 discovery + SEO / GEO / AEO / keyword / backlink / competitor crawler stored in Supabase.

## Folder structure

```
taxotools-backend/
├── src/
│   ├── discovery/          # Companies House, Google, directories
│   ├── crawler/            # On-site crawl + Common Crawl + SEO/GEO/AEO extract
│   ├── keywords/           # Keywords Everywhere
│   ├── competitors/        # City / backlink / keyword comparisons
│   ├── scoring/            # Open PageRank
│   ├── supabase/           # Client + upsert helpers
│   ├── api/                # Express REST API
│   ├── cron/               # Daily/weekly/monthly + continuous forever loop
│   └── utils/
├── supabase-schema.sql
├── supabase-schema-intelligence.sql
├── .env.example
└── package.json
```

## Setup

```bash
cd taxotools/taxotools-backend
npm install
npm run db:apply
npm run test:smoke
```

## Start 24/7 crawling (never stops)

**To keep crawling after you close Cursor**, deploy to Render — see [DEPLOY.md](./DEPLOY.md).

On a long-lived host (or locally while the machine is on):

```bash
npm run always-on   # API + continuous crawler together (auto-restart)
```

Or separately:

```bash
npm run continuous
npm start
```

Pause without killing the process: set `crawler_control.status = 'paused'` in Supabase.

## Cron scripts

| Script | Purpose |
|---|---|
| `npm run continuous` | Forever loop (discovery + crawl + score) |
| `npm run cron:daily-keywords` | Keyword refresh |
| `npm run cron:daily-seo` | SEO / GEO / AEO refresh |
| `npm run cron:weekly-crawl` | Backlink refresh |
| `npm run cron:weekly-authority` | Open PageRank refresh |
| `npm run cron:monthly-discovery` | Accountant discovery |

## API

- `GET /accountants`
- `GET /backlinks?domain=`
- `GET /keywords?domain=`
- `GET /seo?domain=`
- `GET /geo?domain=`
- `GET /aeo?domain=`
- `GET /competitors?domain=`
- `GET /crawler/status`
- `POST /ops/discover` · `/ops/crawl` · `/ops/cycle` · `/ops/keywords` · `/ops/seo-refresh`

## Tables

`accountancy_firms`, `backlinks`, `referring_domains`, `seo_data`, `keyword_data`, `geo_data`, `aeo_data`, `crawl_logs`, `competitor_profiles`, `crawler_control`

## Crawler rules

- Max 200 pages / domain (`MAX_PAGES_PER_DOMAIN`)
- Respect `robots.txt`
- Delay 500ms (`CRAWL_DELAY_MS`)
- UA: `TaxoToolsBot/1.0 (+https://taxotools.com)`
