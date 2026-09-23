import { env } from "../utils/env.js";
import { fetchJson } from "../utils/fetch.js";
import { normalizeDomain, preferUkTld } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";

const log = logger("googleSearch");

export const ACCOUNTANCY_QUERIES = [
  "accountant UK",
  "tax advisor UK",
  "VAT accountant",
  "CIS accountant",
  "bookkeeping services UK",
];

/**
 * Uses SerpAPI when SERP_API_KEY is set. Filters to .co.uk / .org.uk / .gov.uk.
 */
export async function discoverFromGoogleSearch({ queries = ACCOUNTANCY_QUERIES, num = 10 } = {}) {
  if (!env.serpApiKey) {
    log.warn("SERP_API_KEY missing — skipping live Google discovery");
    return [];
  }

  const found = [];
  for (const q of queries) {
    try {
      const url =
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}` +
        `&num=${num}&api_key=${encodeURIComponent(env.serpApiKey)}`;
      const data = await fetchJson(url);
      const organic = data.organic_results || [];
      for (const r of organic) {
        const domain = normalizeDomain(r.link || r.displayed_link || "");
        if (!domain || !preferUkTld(domain)) continue;
        // skip directories themselves
        if (/yell\.com|bark\.com|checkatrade|icaew\.com|accaglobal\.com|google\./i.test(domain)) {
          continue;
        }
        const row = await upsertAccountancyFirm({
          domain,
          company_name: r.title || domain,
          location: "UK",
          source: `google:${q}`,
          website_url: r.link,
        });
        if (row) found.push(row);
      }
      await sleep(env.crawlDelayMs);
    } catch (e) {
      log.warn(`query failed: ${q}`, { error: String(e.message || e) });
    }
  }
  log.info(`Google discovery saved ${found.length} domains`);
  return found;
}
