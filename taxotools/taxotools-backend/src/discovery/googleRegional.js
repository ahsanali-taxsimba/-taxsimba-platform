import * as cheerio from "cheerio";
import { env } from "../utils/env.js";
import { fetchJson, fetchText } from "../utils/fetch.js";
import { normalizeDomain, isUkAccountancyDomain } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";
import { isWebsiteLive } from "./resolveWebsite.js";
import { UK_REGION_GRID, REGIONAL_QUERIES } from "./ukRegions.js";

const log = logger("googleRegional");

const SKIP =
  /yell\.com|bark\.com|checkatrade|icaew\.com|accaglobal\.com|aat\.org|google\.|facebook\.|linkedin\.|instagram\.|twitter\.|bing\.com|duckduckgo\.com|wikipedia\.org/i;

async function saveCandidate({ domain, company_name, location, source, website_url }, seen, found) {
  if (!domain || !isUkAccountancyDomain(domain) || SKIP.test(domain)) return;
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
  const ll = `@${place.lat},${place.lng},11z`;
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

async function duckDuckGoCity(place, query, seen, found) {
  const q = `${query} ${place.name} UK`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const res = await fetchText(url, { retries: 1, timeoutMs: 15000 });
  const $ = cheerio.load(res.text || "");
  const candidates = [];
  $("a.result__a").each((_, el) => {
    const href = $(el).attr("href") || "";
    let link = href;
    const m = href.match(/uddg=([^&]+)/);
    if (m) {
      try {
        link = decodeURIComponent(m[1]);
      } catch {
        /* ignore */
      }
    }
    candidates.push({
      domain: normalizeDomain(link),
      company_name: $(el).text().replace(/\s+/g, " ").trim(),
      website_url: /^https?:/i.test(link) ? link : null,
    });
  });
  for (const c of candidates.slice(0, 15)) {
    await saveCandidate(
      {
        ...c,
        location: place.name,
        source: `ddg:${place.name}:${query}`,
        website_url: c.website_url || (c.domain ? `https://${c.domain}` : null),
      },
      seen,
      found,
    );
  }
}

/**
 * Sweep UK regions for accountancy websites (~50-mile style city grid).
 * SerpAPI Google Maps is best. DuckDuckGo fallback if SERP_API_KEY missing.
 */
export async function discoverFromGoogleRegional({
  deep = false,
  maxPlaces,
  queries = ["accountants near me", "accountant", "chartered accountant"],
} = {}) {
  const places = UK_REGION_GRID.slice(
    0,
    maxPlaces ?? (deep ? UK_REGION_GRID.length : Math.min(40, UK_REGION_GRID.length)),
  );
  const found = [];
  const seen = new Set();
  const useSerp = Boolean(env.serpApiKey);

  log.info("Regional discovery start", {
    places: places.length,
    queries: queries.length,
    provider: useSerp ? "serpapi_google_maps" : "duckduckgo_fallback",
  });

  if (!useSerp) {
    log.warn(
      "SERP_API_KEY missing — DuckDuckGo fallback (add SerpAPI for true Google Maps near-me results)",
    );
  }

  for (const place of places) {
    for (const query of queries) {
      try {
        if (useSerp) {
          await serpMapsAround(place, query, seen, found);
          await sleep(env.crawlDelayMs);
          if (query === queries[0]) {
            await serpOrganicAround(place, "accountant", seen, found);
            await sleep(env.crawlDelayMs);
          }
        } else {
          await duckDuckGoCity(place, query, seen, found);
          await sleep(env.crawlDelayMs * 2);
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
