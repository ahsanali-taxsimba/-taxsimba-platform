import * as cheerio from "cheerio";
import { env } from "../utils/env.js";
import { fetchText } from "../utils/fetch.js";
import { normalizeDomain, preferUkTld, toAbsoluteUrl } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";

const log = logger("directories");

/** UK directories / professional bodies (polite, robots-respecting fetch) */
export const DIRECTORY_SOURCES = [
  {
    id: "yell",
    url: "https://www.yell.com/ucs/UcsSearchAction.do?keywords=accountant&location=London",
  },
  {
    id: "bark",
    url: "https://www.bark.com/en/gb/company-services/accountants/",
  },
  {
    id: "checkatrade",
    url: "https://www.checkatrade.com/Search?category=accountants",
  },
  {
    id: "icaew",
    url: "https://www.icaew.com/find-a-chartered-accountant",
  },
  {
    id: "acca",
    url: "https://www.accaglobal.com/uk/en/member/find-an-accountant.html",
  },
];

function extractDomainsFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const domains = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const abs = toAbsoluteUrl(href, baseUrl);
    if (!abs) return;
    const d = normalizeDomain(abs);
    if (!d || !preferUkTld(d)) return;
    if (
      /yell\.com|bark\.com|checkatrade\.com|icaew\.com|accaglobal\.com|facebook\.|twitter\.|linkedin\./i.test(
        d,
      )
    ) {
      return;
    }
    domains.add(d);
  });
  return [...domains];
}

export async function discoverFromDirectories(sources = DIRECTORY_SOURCES) {
  const found = [];
  for (const src of sources) {
    try {
      const res = await fetchText(src.url, { retries: 1, timeoutMs: 15000 });
      const domains = extractDomainsFromHtml(res.text, res.url || src.url);
      for (const domain of domains.slice(0, 40)) {
        const row = await upsertAccountancyFirm({
          domain,
          company_name: domain,
          location: "UK",
          source: `directory:${src.id}`,
          website_url: `https://${domain}`,
        });
        if (row) found.push(row);
      }
      log.info(`directory ${src.id} → ${domains.length} candidate domains`);
      await sleep(env.crawlDelayMs * 2);
    } catch (e) {
      log.warn(`directory ${src.id} failed`, { error: String(e.message || e) });
    }
  }
  return found;
}
