import * as cheerio from "cheerio";
import { env } from "../utils/env.js";
import { fetchText } from "../utils/fetch.js";
import { normalizeDomain, isUkAccountancyDomain, toAbsoluteUrl } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";
import { isWebsiteLive } from "./resolveWebsite.js";

const log = logger("directories");

/** Major UK cities / regions for directory sweeps */
export const UK_LOCATIONS = [
  ...new Set([
    "London",
    "Manchester",
    "Birmingham",
    "Leeds",
    "Glasgow",
    "Edinburgh",
    "Bristol",
    "Liverpool",
    "Sheffield",
    "Newcastle",
    "Cardiff",
    "Belfast",
    "Nottingham",
    "Leicester",
    "Coventry",
    "Southampton",
    "Brighton",
    "Reading",
    "Cambridge",
    "Oxford",
    "Exeter",
    "Plymouth",
    "Norwich",
    "York",
    "Aberdeen",
    "Dundee",
    "Swansea",
    "Milton Keynes",
    "Croydon",
    "Luton",
    "Watford",
    "Slough",
    "Guildford",
    "Maidstone",
    "Canterbury",
    "Colchester",
    "Ipswich",
    "Peterborough",
    "Portsmouth",
    "Bournemouth",
    "Bath",
    "Swindon",
    "Gloucester",
    "Cheltenham",
    "Taunton",
    "Wolverhampton",
    "Stoke-on-Trent",
    "Derby",
    "Northampton",
    "Lincoln",
    "Worcester",
    "Bolton",
    "Oldham",
    "Stockport",
    "Preston",
    "Blackpool",
    "Chester",
    "Warrington",
    "Carlisle",
    "Bradford",
    "Huddersfield",
    "Doncaster",
    "Hull",
    "Middlesbrough",
    "Sunderland",
    "Durham",
    "Newport",
    "Wrexham",
    "Inverness",
    "Perth",
    "Stirling",
    "Ayr",
    "Derry",
    "Lisburn",
    "Newry",
  ]),
];

const SKIP_HOSTS =
  /yell\.com|bark\.com|checkatrade\.com|icaew\.com|accaglobal\.com|aat\.org|ifa\.org|facebook\.|twitter\.|linkedin\.|instagram\.|google\.|microsoft\.|apple\.|youtube\./i;

function buildSources(locations = UK_LOCATIONS.slice(0, 12)) {
  const sources = [];
  for (const loc of locations) {
    const slug = loc.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    sources.push(
      {
        id: `yell:${loc}`,
        url: `https://www.yell.com/ucs/UcsSearchAction.do?keywords=accountant&location=${encodeURIComponent(loc)}`,
        location: loc,
      },
      {
        id: `freeindex:${loc}`,
        url: `https://www.freeindex.co.uk/find/accountants/${encodeURIComponent(slug)}`,
        location: loc,
      },
      {
        id: `thomson:${loc}`,
        url: `https://www.thomsonlocal.com/search/accountants/${encodeURIComponent(slug)}`,
        location: loc,
      },
    );
  }
  sources.push(
    { id: "bark", url: "https://www.bark.com/en/gb/company-services/accountants/", location: "UK" },
    { id: "checkatrade", url: "https://www.checkatrade.com/Search?category=accountants", location: "UK" },
    { id: "icaew", url: "https://www.icaew.com/find-a-chartered-accountant", location: "UK" },
    { id: "acca", url: "https://www.accaglobal.com/uk/en/member/find-an-accountant.html", location: "UK" },
    { id: "aat", url: "https://www.aat.org.uk/aat-directory", location: "UK" },
    { id: "freeindex", url: "https://www.freeindex.co.uk/categories/business_services/accountants/", location: "UK" },
  );
  return sources;
}

function extractDomainsFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const domains = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const abs = toAbsoluteUrl(href, baseUrl);
    if (!abs) return;
    const d = normalizeDomain(abs);
    if (!d || !isUkAccountancyDomain(d)) return;
    if (SKIP_HOSTS.test(d)) return;
    domains.add(d);
  });
  return [...domains];
}

export const DIRECTORY_SOURCES = buildSources();

export async function discoverFromDirectories({
  locations = UK_LOCATIONS.slice(0, Number(process.env.DIRECTORY_CITY_LIMIT || 15)),
  verifyLive = true,
} = {}) {
  const sources = buildSources(locations);
  const found = [];
  const seen = new Set();

  for (const src of sources) {
    try {
      const res = await fetchText(src.url, { retries: 1, timeoutMs: 18000 });
      const domains = extractDomainsFromHtml(res.text, res.url || src.url);
      let saved = 0;
      for (const domain of domains.slice(0, 60)) {
        if (seen.has(domain)) continue;
        seen.add(domain);
        if (verifyLive && !(await isWebsiteLive(domain, { timeoutMs: 5000 }))) continue;
        const row = await upsertAccountancyFirm({
          domain,
          company_name: domain,
          location: src.location || "UK",
          source: `directory:${src.id}`,
          website_url: `https://${domain}`,
          website_verified: true,
          crawl_status: "pending",
        });
        if (row) {
          found.push(row);
          saved += 1;
        }
      }
      log.info(`directory ${src.id} → candidates=${domains.length} saved=${saved}`);
      await sleep(env.crawlDelayMs * 2);
    } catch (e) {
      log.warn(`directory ${src.id} failed`, { error: String(e.message || e) });
    }
  }
  return found;
}
