import { env } from "../utils/env.js";
import { fetchJson } from "../utils/fetch.js";
import { normalizeDomain, isUkAccountancyDomain } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";
import { UK_LOCATIONS } from "./directories.js";
import { isWebsiteLive } from "./resolveWebsite.js";

const log = logger("googleSearch");

export const ACCOUNTANCY_QUERIES = [
  "accountant UK",
  "tax advisor UK",
  "VAT accountant",
  "CIS accountant",
  "bookkeeping services UK",
  "chartered accountant UK",
  "payroll accountant UK",
  "small business accountant UK",
];

function buildQueries(deep = false) {
  const q = [...ACCOUNTANCY_QUERIES];
  const cities = deep ? UK_LOCATIONS : UK_LOCATIONS.slice(0, 10);
  for (const city of cities) {
    q.push(`accountant ${city}`);
    q.push(`chartered accountant ${city}`);
  }
  return q;
}

/**
 * Uses SerpAPI when SERP_API_KEY is set.
 */
export async function discoverFromGoogleSearch({ queries, num = 10, deep = false } = {}) {
  if (!env.serpApiKey) {
    log.warn("SERP_API_KEY missing — skipping live Google discovery");
    return [];
  }

  const list = queries || buildQueries(deep);
  const found = [];
  const seen = new Set();

  for (const q of list) {
    try {
      const url =
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}` +
        `&num=${num}&gl=uk&hl=en&api_key=${encodeURIComponent(env.serpApiKey)}`;
      const data = await fetchJson(url);
      const organic = data.organic_results || [];
      for (const r of organic) {
        const domain = normalizeDomain(r.link || r.displayed_link || "");
        if (!domain || !isUkAccountancyDomain(domain)) continue;
        if (/yell\.com|bark\.com|checkatrade|icaew\.com|accaglobal\.com|google\./i.test(domain)) {
          continue;
        }
        if (seen.has(domain)) continue;
        seen.add(domain);
        if (!(await isWebsiteLive(domain, { timeoutMs: 5000 }))) continue;
        const row = await upsertAccountancyFirm({
          domain,
          company_name: r.title || domain,
          location: "UK",
          source: `google:${q}`,
          website_url: r.link,
          website_verified: true,
          crawl_status: "pending",
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
