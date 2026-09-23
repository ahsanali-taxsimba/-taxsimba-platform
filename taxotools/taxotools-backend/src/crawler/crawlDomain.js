import robotsParser from "robots-parser";
import { env } from "../utils/env.js";
import { fetchText } from "../utils/fetch.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { extractLinks, scorePathPriority } from "./extractLinks.js";
import { upsertBacklink } from "../supabase/insertBacklink.js";
import { writeCrawlLog } from "../supabase/logs.js";

const log = logger("crawlDomain");

async function loadRobots(origin) {
  try {
    const res = await fetchText(`${origin}/robots.txt`, { retries: 0, timeoutMs: 8000 });
    return robotsParser(`${origin}/robots.txt`, res.text);
  } catch {
    return robotsParser(`${origin}/robots.txt`, "");
  }
}

/**
 * Crawl a single accountancy domain (BFS) up to MAX_PAGES_PER_DOMAIN.
 */
export async function crawlDomain(domain, { maxPages = env.maxPagesPerDomain } = {}) {
  const host = normalizeDomain(domain);
  const origin = `https://${host}`;
  const start = Date.now();
  let pages = 0;
  let saved = 0;
  const errors = [];

  await writeCrawlLog({ domain: host, status: "running", pages_crawled: 0 });

  try {
    const robots = await loadRobots(origin);
    const queue = [origin, `${origin}/`, `${origin}/contact`, `${origin}/services`, `${origin}/blog`];
    const seen = new Set();

    while (queue.length && pages < maxPages) {
      queue.sort((a, b) => scorePathPriority(b) - scorePathPriority(a));
      const url = queue.shift();
      if (!url || seen.has(url)) continue;
      seen.add(url);

      if (typeof robots.isDisallowed === "function" && robots.isDisallowed(url, env.userAgent)) {
        continue;
      }

      try {
        const res = await fetchText(url, { retries: 1, timeoutMs: 15000 });
        pages += 1;
        const { outbound, internalUrls } = extractLinks(res.text, res.url || url, host);
        for (const link of outbound) {
          const row = await upsertBacklink(link);
          if (row) saved += 1;
        }
        for (const next of internalUrls) {
          if (normalizeDomain(next) !== host) continue;
          if (!seen.has(next) && queue.length < maxPages * 3) queue.push(next);
        }
      } catch (e) {
        errors.push(`${url}: ${e.message || e}`);
      }
      await sleep(env.crawlDelayMs);
    }

    await writeCrawlLog({
      domain: host,
      status: "completed",
      pages_crawled: pages,
      errors: errors.length ? errors.slice(0, 20).join("\n") : null,
    });

    log.info(`crawled ${host}`, { pages, saved, ms: Date.now() - start });
    return { domain: host, pages, saved, errors: errors.length };
  } catch (e) {
    await writeCrawlLog({
      domain: host,
      status: "failed",
      pages_crawled: pages,
      errors: String(e.message || e),
    });
    throw e;
  }
}
