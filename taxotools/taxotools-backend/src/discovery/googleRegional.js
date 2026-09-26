import { env } from "../utils/env.js";
import { fetchJson } from "../utils/fetch.js";
import { normalizeDomain, isUkAccountancyDomain } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";
import { isWebsiteLive } from "./resolveWebsite.js";
import { UK_REGION_GRID, REGIONAL_QUERIES } from "./ukRegions.js";

const log = logger("googleRegional");

const SKIP =
  /yell\.com|bark\.com|checkatrade|icaew\.com|accaglobal\.com|aat\.org|google\.|facebook\.|linkedin\.|instagram\.|twitter\.|bing\.com|duckduckgo\.com|wikipedia\.org|tiktok\.com|youtube\.com|tripadvisor\.|booking\.com|indeed\.com|yelp\.com/i;

async function saveCandidate({ domain, company_name, location, source, website_url }, seen, found) {
  if (!domain || !isUkAccountancyDomain(domain) || SKIP.test(domain)) return;
  // Prefer UK TLDs; allow .com only if it looks like a firm site (not a mega-platform)
  if (domain.endsWith(".com") && domain.split(".").length === 2) {
    const left = domain.split(".")[0];
    if (left.length < 4 || /^(google|apple|amazon|microsoft|facebook)$/i.test(left)) return;
  }
  if (seen.has(domain)) return;
  seen.add(domain);
  if (!(await isWebsiteLive(domain, { timeoutMs: 4500 }))) return;
  const row = await upsertAccountancyFirm({
    domain,
    company_name: company_name || domain,
    location: location || "UK",
    source,
    website_url: website_url || `https://${domain}`,
    website_verified: true,
    crawl_status: "pending",
  });
  if (row) found.push(row);
}

async function serpMapsAround(place, query, seen, found) {
  const ll = `@${place.lat},${place.lng},11z`; // city + ~surrounding area (~50 miles style)
  const url =
    `https://serpapi.com/search.json?engine=google_maps&type=search` +
    `&q=${encodeURIComponent(query)}` +
    `&ll=${encodeURIComponent(ll)}` +
    `&hl=en&gl=uk` +
    `&api_key=${encodeURIComponent(env.serpApiKey)}`;
  const data = await fetchJson(url, { timeoutMs: 25000 });
  for (const r of data.local_results || []) {
    const website = r.website || r.link || "";
    await saveCandidate(
      {
        domain: normalizeDomain(website),
        company_name: r.title || r.name,
        location: [place.name, place.region].filter(Boolean).join(", "),
        source: `google_maps:${place.name}:${query}`,
        website_url: website,
      },
      seen,
      found,
    );
  }
}

async function serpOrganicAround(place, query, seen, found) {
  const q = `${query} ${place.name}`;
  const location = `${place.name}, ${place.region}, United Kingdom`;
  const url =
    `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}` +
    `&location=${encodeURIComponent(location)}` +
    `&google_domain=google.co.uk&gl=uk&hl=en&num=20` +
    `&api_key=${encodeURIComponent(env.serpApiKey)}`;
  const data = await fetchJson(url, { timeoutMs: 25000 });
  for (const r of data.organic_results || []) {
    await saveCandidate(
      {
        domain: normalizeDomain(r.link || ""),
        company_name: r.title,
        location: place.name,
        source: `google_local:${place.name}:${query}`,
        website_url: r.link,
      },
      seen,
      found,
    );
  }
}

/**
 * Sweep UK regions for accountancy websites (~50-mile style city grid).
 * Requires SERP_API_KEY for real Google Maps "accountants near me" results.
 * Without the key this returns [] and logs a clear warning (directories/CH cover free paths).
 */
export async function discoverFromGoogleRegional({
  deep = false,
  maxPlaces,
  queries = ["accountants near me", "accountant", "chartered accountant"],
} = {}) {
  if (!env.serpApiKey) {
    log.warn(
      "SERP_API_KEY missing — cannot run Google Maps regional near-me discovery. " +
        "Add SERP_API_KEY on Fly.io (https://serpapi.com) then redeploy. " +
        "Companies House regional discovery still runs without it.",
    );
    return [];
  }

  const places = UK_REGION_GRID.slice(
    0,
    maxPlaces ?? (deep ? UK_REGION_GRID.length : Math.min(40, UK_REGION_GRID.length)),
  );
  const found = [];
  const seen = new Set();

  log.info("Google Maps regional discovery start", {
    places: places.length,
    queries: queries.length,
  });

  for (const place of places) {
    for (const query of queries) {
      try {
        await serpMapsAround(place, query, seen, found);
        await sleep(env.crawlDelayMs);
        if (query === queries[0]) {
          await serpOrganicAround(place, "accountant", seen, found);
          await sleep(env.crawlDelayMs);
        }
      } catch (e) {
        log.warn(`regional failed ${place.name} / ${query}`, {
          error: String(e.message || e),
        });
      }
    }
    log.info(`regional progress ${place.name}`, { saved: found.length });
  }

  log.info("Regional discovery complete", { saved: found.length, places: places.length });
  return found;
}

export { UK_REGION_GRID, REGIONAL_QUERIES };
