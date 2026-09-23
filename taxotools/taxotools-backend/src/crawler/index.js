import { logger } from "../utils/logger.js";
import { listAccountancyFirms } from "../supabase/insertDomain.js";
import { markLostBacklinks } from "../supabase/insertBacklink.js";
import { refreshReferringDomainCounts } from "../supabase/updateAuthority.js";
import { crawlDomain } from "./crawlDomain.js";
import { fetchInboundFromCommonCrawl } from "./commonCrawlInbound.js";
import { scoreReferringDomainsForAccountant } from "../scoring/backlinkScoring.js";

const log = logger("crawler");

/**
 * Crawl all (or limited) accountancy firms: outbound pages + Common Crawl inbound,
 * then refresh referring domain counts / authority, mark lost links.
 */
export async function runCrawl({ limit = 25, maxPages, includeCommonCrawl = true } = {}) {
  const firms = await listAccountancyFirms({ limit });
  const results = [];
  const crawlStarted = new Date().toISOString();

  for (const firm of firms) {
    try {
      const outbound = await crawlDomain(firm.domain, { maxPages });
      let inbound = [];
      if (includeCommonCrawl) {
        inbound = await fetchInboundFromCommonCrawl(firm.domain, { limit: 30 });
      }
      const lost = await markLostBacklinks(firm.domain, crawlStarted);
      await refreshReferringDomainCounts(firm.domain);
      await scoreReferringDomainsForAccountant(firm.domain);
      results.push({
        domain: firm.domain,
        ...outbound,
        inbound: inbound.length,
        lost,
      });
    } catch (e) {
      log.warn(`crawl failed for ${firm.domain}`, { error: String(e.message || e) });
      results.push({ domain: firm.domain, error: String(e.message || e) });
    }
  }

  log.info("Crawl batch complete", { firms: firms.length, ok: results.filter((r) => !r.error).length });
  return { firms: firms.length, results };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  // no-op: prefer npm scripts
}

export { crawlDomain, fetchInboundFromCommonCrawl };
