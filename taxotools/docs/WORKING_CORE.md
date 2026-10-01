# Working Core — Phase 0 / 1

Goal: stop silent stubs for the site-audit loop. Tools stay listed; crawls become real.

## What shipped

1. **Queue / poller fix**
   - Jobs keep `jobId: null` when Redis is unavailable so the DB poller can claim them.
   - Redis success sets BullMQ `jobId`.
   - Unknown automation queues no longer soft-ack as success — they fail with an explicit message.

2. **Live HTTP site crawl** (`processSiteCrawl` in `@taxotools/database`)
   - BFS same-host links
   - Extracts title, meta, H1, canonical, word count, schema presence
   - Writes real `Page` + `CrawlIssue` rows

3. **Inline crawl on Vercel**
   - If Redis/worker is offline, `startCrawl` runs the live crawl inside the API request (capped pages).

4. **Wired tools**
   - Site Audit / Technical crawl panel — live issues + auto-refresh
   - On-Page Checker — live fetch + scoring
   - Health Scoreboard — technical pillar from live crawl when available

## How to verify

1. Sign in → open a site → **Technical**
2. Click **Start live crawl**
3. Expect COMPLETED with page/issue counts from the real domain
4. **View issue list** shows real messages/URLs

## Next phases

- Phase 2: live SERP / keyword ranks
- Phase 3: backlinks + AEO LLM checks
- Phase 4: Content Genius real LLM + Auto SEO from crawl issues
- Phase 5: Ads / local / social / Stripe
