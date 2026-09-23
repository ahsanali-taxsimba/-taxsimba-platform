import { env } from "../utils/env.js";
import { fetchText } from "../utils/fetch.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertBacklink } from "../supabase/insertBacklink.js";

const log = logger("commonCrawl");

/**
 * Find inbound links via Common Crawl CDX API.
 * Docs: https://index.commoncrawl.org/
 */
export async function fetchInboundFromCommonCrawl(accountantDomain, { limit = 50 } = {}) {
  const host = normalizeDomain(accountantDomain);
  const index = env.commonCrawlIndex || "CC-MAIN-2026-17";
  // CDX query: pages that link to the domain (url match on target host in HTML is imperfect;
  // we search for URLs containing the domain string as a practical open-data approach).
  const cdx =
    `https://index.commoncrawl.org/${index}-index` +
    `?url=*.${host}&output=json&fl=url,timestamp&limit=${limit}`;

  let lines = [];
  try {
    const res = await fetchText(cdx, { retries: 1, timeoutMs: 30000 });
    lines = res.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (e) {
    log.warn("CDX query failed — trying alternate host filter", { error: String(e.message || e) });
    try {
      const alt =
        `https://index.commoncrawl.org/${index}-index` +
        `?url=${encodeURIComponent(host)}/*&output=json&fl=url,timestamp&limit=${limit}`;
      const res = await fetchText(alt, { retries: 1, timeoutMs: 30000 });
      lines = res.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    } catch (e2) {
      log.warn("Common Crawl unavailable", { error: String(e2.message || e2) });
      return [];
    }
  }

  const saved = [];
  for (const line of lines.slice(0, limit)) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const source_url = row.url;
    if (!source_url) continue;
    const referring = normalizeDomain(source_url);
    if (!referring || referring === host) continue;

    const link = await upsertBacklink({
      source_url,
      target_url: `https://${host}/`,
      anchor_text: host,
      referring_domain: referring,
      link_type: "dofollow",
      accountant_domain: host,
      direction: "inbound",
    });
    if (link) saved.push(link);
    await sleep(50);
  }

  log.info(`Common Crawl inbound for ${host}: ${saved.length}`);
  return saved;
}
