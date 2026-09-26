import { logger } from "../utils/logger.js";
import { listAccountancyFirms } from "../supabase/insertDomain.js";
import { markLostBacklinks } from "../supabase/insertBacklink.js";
import { refreshReferringDomainCounts } from "../supabase/updateAuthority.js";
import { crawlDomain } from "./crawlDomain.js";
import { fetchInboundFromCommonCrawl } from "./commonCrawlInbound.js";
import { scoreReferringDomainsForAccountant } from "../scoring/backlinkScoring.js";
import { env } from "../utils/env.js";
import { claimFirmsForCrawl, workerId } from "../supabase/claimFirms.js";

const log = logger("crawler");

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Crawl a batch of firms.
 * Prefers atomic DB claims so multiple Fly machines never duplicate the same firm.
 */
export async function runCrawl({
  limit = 25,
  maxPages,
  includeCommonCrawl = false,
  collectCompetitors = env.collectCompetitorsFirstPass,
  concurrency = env.crawlConcurrency,
} = {}) {
  const worker = workerId();
  let firms = await claimFirmsForCrawl({ limit });
  if (!firms) {
    // RPC missing — single-machine safe fallback
    firms = await listAccountancyFirms({ limit, crawlableOnly: true });
  }

  const crawlStarted = new Date().toISOString();
  log.info("Crawl batch start", {
    worker,
    firms: firms.length,
    concurrency,
    maxPages: maxPages ?? env.maxPagesPerDomain,
    includeCommonCrawl,
    collectCompetitors,
    claimed: true,
  });

  const results = await mapPool(firms, concurrency, async (firm) => {
    try {
      const outbound = await crawlDomain(firm.domain, {
        maxPages,
        collectCompetitors,
        collectKeywords: env.collectKeywords,
      });
      let inbound = [];
      if (includeCommonCrawl) {
        inbound = await fetchInboundFromCommonCrawl(firm.domain, { limit: 20 });
      }
      const lost = await markLostBacklinks(firm.domain, crawlStarted);
      await refreshReferringDomainCounts(firm.domain);
      await scoreReferringDomainsForAccountant(firm.domain);
      return {
        domain: firm.domain,
        worker,
        ...outbound,
        inbound: inbound.length,
        lost,
      };
    } catch (e) {
      log.warn(`crawl failed for ${firm.domain}`, { error: String(e.message || e) });
      return { domain: firm.domain, worker, error: String(e.message || e) };
    }
  });

  log.info("Crawl batch complete", {
    worker,
    firms: firms.length,
    ok: results.filter((r) => r && !r.error).length,
  });
  return { firms: firms.length, worker, results };
}

export { crawlDomain, fetchInboundFromCommonCrawl };
