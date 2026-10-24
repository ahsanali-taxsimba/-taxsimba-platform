# Working Core — Phase 0–4

Goal: stop silent stubs. Tools stay listed; SEO jobs deliver real client data when keys are set, and honest crawl/heuristic data otherwise.

## What shipped

### Phase 0 / 1 — Live crawl

1. **Queue / poller fix** — `jobId: null` when Redis unavailable so the DB poller can claim jobs.
2. **Live HTTP site crawl** (`processSiteCrawl`) — BFS, title/meta/H1/canonical/schema, real `Page` + `CrawlIssue` rows.
3. **Inline crawl on Vercel** when Redis/worker is offline.
4. **Wired tools** — Site Audit, On-Page Checker, Health Scoreboard technical pillar.

### Phase 2 — Keywords + SERP ranks

1. **`@taxotools/integrations` SEO module**
   - Keywords Everywhere (`KEYWORDS_EVERYWHERE_API_KEY`) for volume/CPC/difficulty
   - SerpAPI (`SERP_API_KEY` / `SERPAPI_KEY`) for live Google ranks + AI Overview flags
   - Crawl-derived rank estimates when SERP key is missing but pages were crawled
2. **Keyword service** — live metrics on add; magic/gap use crawl titles + provider metrics.
3. **Rank job** — live/crawl-derived/heuristic with `serpJson.mode` honesty; inline rank check when Redis down.
4. **Toolkit** — keyword-research, keyword-magic, keyword-gap, keyword-cpc, organic-research, position-tracking, topical-map, keyword-strategy-builder wired off fake invent-only paths.

### Phase 3 — Backlinks + AEO

1. **Backlink worker** — `runRefresh` fetches CrawlGraph / Open PageRank (or stubs) and upserts rows.
2. **Backlink engine init** — inline provider refresh when Redis down.
3. **AEO scan** — OpenAI chat completions when `OPENAI_API_KEY` set; otherwise heuristic answers labelled in metadata.
4. **Inline AEO** on Vercel when Redis down.

### Phase 4 — Content Genius LLM

1. **AI content job** — OpenAI JSON generation for ARTICLE/OUTLINE/META/FAQ/SCHEMA/SOCIAL when key present.
2. **Inline AI content** when Redis down.

## Env keys (optional — product works without them)

| Key | Powers |
|-----|--------|
| `KEYWORDS_EVERYWHERE_API_KEY` | Keyword volume / CPC / difficulty |
| `SERP_API_KEY` / `SERPAPI_KEY` | Live Google ranks + SERP features |
| `CRAWLGRAPH_API_KEY` | Live backlinks |
| `OPENPAGERANK_API_KEY` | Domain authority |
| `OPENAI_API_KEY` | AEO scans + Content Genius |

## How to verify

1. Sign in → site → **Technical** → Start live crawl → real pages/issues
2. **Keywords** → add phrases → volumes from KE (or heuristic with source)
3. Rank check → positions from SerpAPI or crawl-derived estimates
4. **AEO** → scan prompts → answers with `metadata.mode` live/heuristic
5. **Content Genius** → article job → OpenAI or stub with `_meta.source`
6. **Backlinks** → init/refresh → provider modes in response

## Next

- Phase 5: Ads / local / social / Stripe live billing
- GSC/GA4 OAuth for Search Console traffic
- Reduce remaining catalog tools that still seed demo rows (ads/PLA/social)
