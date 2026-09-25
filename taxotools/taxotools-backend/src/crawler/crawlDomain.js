import robotsParser from "robots-parser";
import { env } from "../utils/env.js";
import { fetchText } from "../utils/fetch.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { extractLinks, scorePathPriority } from "./extractLinks.js";
import {
  extractPageIntelligence,
  extractKeywordCandidates,
} from "./extractIntelligence.js";
import { upsertBacklink } from "../supabase/insertBacklink.js";
import { writeCrawlLog } from "../supabase/logs.js";
import {
  upsertSeoData,
  upsertAeoData,
  upsertGeoData,
} from "../supabase/insertIntelligence.js";
import { getSupabase } from "../supabase/client.js";
import { markFirmStatus } from "../supabase/insertDomain.js";
import { refreshKeywordsForDomain } from "../keywords/keywordsEverywhere.js";
import { buildCompetitorProfiles } from "../competitors/buildProfiles.js";

const log = logger("crawlDomain");

async function loadRobots(origin) {
  try {
    const res = await fetchText(`${origin}/robots.txt`, { retries: 0, timeoutMs: 8000 });
    return { robots: robotsParser(`${origin}/robots.txt`, res.text), robotsTxt: res.text };
  } catch {
    return { robots: robotsParser(`${origin}/robots.txt`, ""), robotsTxt: "" };
  }
}

async function discoverSitemaps(origin, robotsTxt) {
  const urls = new Set();
  for (const line of String(robotsTxt || "").split("\n")) {
    const m = line.match(/^\s*Sitemap:\s*(.+)$/i);
    if (m?.[1]) urls.add(m[1].trim());
  }
  for (const guess of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]) {
    try {
      await fetchText(guess, { retries: 0, timeoutMs: 8000 });
      urls.add(guess);
    } catch {
      // ignore
    }
  }
  return [...urls].slice(0, 20);
}

async function maybePageSpeed(url) {
  const key = env.pageSpeedKey;
  if (!key) return {};
  try {
    const endpoint =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}` +
      `&strategy=mobile&category=performance&key=${encodeURIComponent(key)}`;
    const res = await fetchText(endpoint, { retries: 0, timeoutMs: 45000 });
    const json = JSON.parse(res.text);
    const lhr = json.lighthouseResult || {};
    const audits = lhr.audits || {};
    return {
      lcp_ms: audits["largest-contentful-paint"]?.numericValue ?? null,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      inp_ms: audits["interaction-to-next-paint"]?.numericValue ?? audits["max-potential-fid"]?.numericValue ?? null,
      performance_score: lhr.categories?.performance?.score != null
        ? Math.round(lhr.categories.performance.score * 100)
        : null,
    };
  } catch (e) {
    log.warn("pagespeed failed", { url, error: String(e.message || e) });
    return {};
  }
}

/**
 * Full SEO/GEO/AEO/backlink crawl for one accountancy domain (BFS).
 */
export async function crawlDomain(
  domain,
  {
    maxPages = env.maxPagesPerDomain,
    collectKeywords = env.collectKeywords,
    collectCompetitors = env.collectCompetitorsFirstPass,
    pageSpeedHome = false,
  } = {},
) {
  const host = normalizeDomain(domain);
  const origin = `https://${host}`;
  const start = Date.now();
  let pages = 0;
  let saved = 0;
  const errors = [];
  const seoRows = [];

  await writeCrawlLog({ domain: host, status: "running", pages_crawled: 0 });
  await getSupabase()
    .from("accountancy_firms")
    .update({ crawl_status: "running", updated_at: new Date().toISOString() })
    .eq("domain", host);

  try {
    const { robots, robotsTxt } = await loadRobots(origin);
    const sitemap_urls = await discoverSitemaps(origin, robotsTxt);
    const queue = [
      origin,
      `${origin}/`,
      `${origin}/contact`,
      `${origin}/services`,
      `${origin}/about`,
      `${origin}/blog`,
      `${origin}/faq`,
    ];
    const seen = new Set();
    let homeSpeed = {};

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
        const finalUrl = res.url || url;
        const depth = Math.max(0, new URL(finalUrl).pathname.split("/").filter(Boolean).length);
        const { outbound, internalUrls } = extractLinks(res.text, finalUrl, host);

        for (const link of outbound) {
          const row = await upsertBacklink(link);
          if (row) saved += 1;
        }
        for (const next of internalUrls) {
          if (normalizeDomain(next) !== host) continue;
          if (!seen.has(next) && queue.length < maxPages * 3) queue.push(next);
        }

        if (pageSpeedHome && env.pageSpeedKey && pages === 1) {
          homeSpeed = await maybePageSpeed(finalUrl);
        }

        const { seo, aeo, geo } = extractPageIntelligence(res.text, finalUrl, host, {
          sitemap_urls,
          robots_txt: pages === 1 ? robotsTxt : null,
          http_status: res.status,
          redirect_chain: finalUrl !== url ? [url, finalUrl] : [],
          internal_links: internalUrls.length,
          external_links: outbound.length,
          page_depth: depth,
          ...(pages === 1 ? homeSpeed : {}),
        });

        await upsertSeoData(seo);
        await upsertAeoData(aeo);
        if (geo.address || geo.city || geo.postcode || geo.phone || geo.business_name) {
          await upsertGeoData({
            ...geo,
            local_signals: {
              has_local_schema: aeo.has_local_business_schema,
              sitemap_count: sitemap_urls.length,
            },
          });
        }
        seoRows.push(seo);
      } catch (e) {
        errors.push(`${url}: ${e.message || e}`);
      }
      await sleep(env.crawlDelayMs);
    }

    let keywords = { count: 0 };
    if (collectKeywords) {
      const candidates = extractKeywordCandidates(seoRows);
      keywords = await refreshKeywordsForDomain(host, candidates);
    }

    let competitors = [];
    if (collectCompetitors) {
      competitors = await buildCompetitorProfiles(host);
    }

    await getSupabase()
      .from("accountancy_firms")
      .update({
        crawl_status: "completed",
        last_crawled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        location: seoRows.find((r) => r)?.title ? undefined : undefined,
      })
      .eq("domain", host);

    // Enrich firm location from geo if available
    const { data: geoRow } = await getSupabase()
      .from("geo_data")
      .select("city, region, postcode, business_name")
      .eq("domain", host)
      .maybeSingle();
    if (geoRow) {
      const firmPatch = {
        location: [geoRow.city, geoRow.region, geoRow.postcode].filter(Boolean).join(", ") || null,
        updated_at: new Date().toISOString(),
      };
      if (geoRow.business_name) firmPatch.company_name = geoRow.business_name;
      await getSupabase().from("accountancy_firms").update(firmPatch).eq("domain", host);
    }

    await writeCrawlLog({
      domain: host,
      status: "completed",
      pages_crawled: pages,
      errors: errors.length ? errors.slice(0, 20).join("\n") : null,
    });

    log.info(`crawled ${host}`, {
      pages,
      saved,
      seo: seoRows.length,
      keywords: keywords.count,
      competitors: competitors.length,
      ms: Date.now() - start,
    });
    return {
      domain: host,
      pages,
      saved,
      seo: seoRows.length,
      keywords: keywords.count,
      competitors: competitors.length,
      errors: errors.length,
    };
  } catch (e) {
    const msg = String(e.message || e);
    const unreachable = /ENOTFOUND|EAI_AGAIN|CERT|SSL|ECONNREFUSED/i.test(msg) && pages === 0;
    await writeCrawlLog({
      domain: host,
      status: unreachable ? "unreachable" : "failed",
      pages_crawled: pages,
      errors: msg,
    });
    await markFirmStatus(host, unreachable ? "unreachable" : "failed");
    throw e;
  }
}
