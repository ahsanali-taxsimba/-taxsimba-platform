import { processSiteCrawl } from "@taxotools/database";

/**
 * Live HTTP crawl — discovers same-host pages and writes real SEO issues.
 */
export async function processCrawl(payload: Record<string, unknown>) {
  return processSiteCrawl({
    crawlId: String(payload.crawlId),
    siteId: String(payload.siteId),
    url: String(payload.url),
    maxPages: typeof payload.maxPages === "number" ? payload.maxPages : undefined,
  });
}
