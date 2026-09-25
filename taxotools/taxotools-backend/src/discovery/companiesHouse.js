import { env } from "../utils/env.js";
import { fetchJson } from "../utils/fetch.js";
import { preferUkTld, isUkAccountancyDomain } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";
import { resolveLiveDomainFromName, isWebsiteLive } from "./resolveWebsite.js";

const log = logger("companiesHouse");

/** SIC codes for accountancy / bookkeeping / tax consultancy */
export const ACCOUNTANCY_SIC_CODES = ["69201", "69202", "69203"];

/**
 * Paginated Companies House advanced search.
 * Only stores firms when a live website can be resolved (avoids fake .co.uk guesses).
 */
export async function discoverFromCompaniesHouse({
  perPage = 50,
  maxPagesPerSic = Number(process.env.CH_MAX_PAGES_PER_SIC || 5),
  resolveWebsites = true,
} = {}) {
  if (!env.companiesHouseKey) {
    log.warn("COMPANIES_HOUSE_API_KEY missing — seeding demo UK firms instead");
    return seedDemoFirms("companies_house_demo");
  }

  const auth = Buffer.from(`${env.companiesHouseKey}:`).toString("base64");
  const found = [];
  const seenNumbers = new Set();

  for (const sic of ACCOUNTANCY_SIC_CODES) {
    for (let page = 0; page < maxPagesPerSic; page++) {
      const startIndex = page * perPage;
      try {
        const url =
          `https://api.company-information.service.gov.uk/advanced-search/companies` +
          `?sic_codes=${sic}&size=${perPage}&start_index=${startIndex}&company_status=active`;
        const data = await fetchJson(url, {
          headers: { Authorization: `Basic ${auth}` },
          timeoutMs: 25000,
        });
        const items = data.items || [];
        if (!items.length) break;

        for (const item of items) {
          const companyNumber = item.company_number;
          if (!companyNumber || seenNumbers.has(companyNumber)) continue;
          seenNumbers.add(companyNumber);

          const name = item.company_name || item.title || "Unknown";
          const location =
            item.registered_office_address?.locality ||
            item.registered_office_address?.region ||
            item.registered_office_address?.country ||
            null;

          let domain = null;
          if (resolveWebsites) {
            domain = await resolveLiveDomainFromName(name);
            await sleep(150);
          }

          // No live website → ignore firm completely (do not store placeholders)
          if (!domain) {
            continue;
          }

          const row = await upsertAccountancyFirm({
            domain,
            company_name: name,
            location,
            sic_code: sic,
            company_number: companyNumber,
            source: "companies_house",
            website_url: `https://${domain}`,
            website_verified: true,
            crawl_status: "pending",
          });
          if (row) found.push(row);
        }

        log.info(`CH SIC ${sic} page ${page + 1}`, { items: items.length, saved: found.length });
        await sleep(env.crawlDelayMs);
        if (items.length < perPage) break;
      } catch (e) {
        log.warn(`SIC ${sic} page ${page} failed`, { error: String(e.message || e) });
        break;
      }
    }
  }

  log.info(`Companies House discovered ${found.length} firms with live websites (no-website ignored)`);
  return found;
}

/**
 * Delete firms that have no usable website (placeholders / needs_website / unreachable).
 */
export async function purgeFirmsWithoutWebsites({ limit = 2000 } = {}) {
  const { getSupabase } = await import("../supabase/client.js");
  const sb = getSupabase();
  let removed = 0;

  // Placeholders
  const { data: pending } = await sb
    .from("accountancy_firms")
    .select("domain")
    .like("domain", "%.companieshouse.pending")
    .limit(limit);
  for (const row of pending || []) {
    const { error } = await sb.from("accountancy_firms").delete().eq("domain", row.domain);
    if (!error) removed += 1;
  }

  // Explicit no-website / dead statuses
  for (const status of ["needs_website", "unreachable", "superseded"]) {
    const { data } = await sb
      .from("accountancy_firms")
      .select("domain")
      .eq("crawl_status", status)
      .limit(limit);
    for (const row of data || []) {
      const { error } = await sb.from("accountancy_firms").delete().eq("domain", row.domain);
      if (!error) removed += 1;
    }
  }

  // website_verified = false and no real website_url
  const { data: unverified } = await sb
    .from("accountancy_firms")
    .select("domain,website_url,website_verified")
    .eq("website_verified", false)
    .limit(limit);
  for (const row of unverified || []) {
    const url = String(row.website_url || "");
    if (!url || url.includes(".pending")) {
      const { error } = await sb.from("accountancy_firms").delete().eq("domain", row.domain);
      if (!error) removed += 1;
    }
  }

  log.info("Purged firms without websites", { removed });
  return { removed };
}

/** @deprecated — no-website firms are ignored; kept as alias for purge */
export async function resolvePendingWebsites(opts = {}) {
  return purgeFirmsWithoutWebsites(opts);
}

export async function seedDemoFirms(source = "demo") {
  const demos = [
    { domain: "hwfisher.co.uk", company_name: "HW Fisher", location: "London", sic_code: "69201" },
    { domain: "mooreks.co.uk", company_name: "Moore Kingston Smith", location: "London", sic_code: "69201" },
    { domain: "buzzacott.co.uk", company_name: "Buzzacott", location: "London", sic_code: "69201" },
    { domain: "hazlewoods.co.uk", company_name: "Hazlewoods", location: "Cheltenham", sic_code: "69201" },
    { domain: "mha.co.uk", company_name: "MHA", location: "UK", sic_code: "69201" },
    { domain: "pkf-francisclark.co.uk", company_name: "PKF Francis Clark", location: "South West", sic_code: "69201" },
    { domain: "armstrongwatson.co.uk", company_name: "Armstrong Watson", location: "North", sic_code: "69201" },
    { domain: "krestonreeves.com", company_name: "Kreston Reeves", location: "South East", sic_code: "69201" },
    { domain: "bdo.co.uk", company_name: "BDO UK", location: "UK", sic_code: "69201" },
    { domain: "rsmuk.com", company_name: "RSM UK", location: "UK", sic_code: "69201" },
    { domain: "crowe.com", company_name: "Crowe UK", location: "UK", sic_code: "69201" },
    { domain: "grantthornton.co.uk", company_name: "Grant Thornton UK", location: "UK", sic_code: "69201" },
    { domain: "mazars.co.uk", company_name: "Forvis Mazars UK", location: "UK", sic_code: "69201" },
    { domain: "uhy-uk.com", company_name: "UHY Hacker Young", location: "UK", sic_code: "69201" },
    { domain: "saffery.com", company_name: "Saffery", location: "UK", sic_code: "69201" },
    { domain: "haysmacintyre.com", company_name: "HaysMac", location: "London", sic_code: "69201" },
    { domain: "kingstonsmith.co.uk", company_name: "Moore Kingston Smith", location: "London", sic_code: "69201" },
    { domain: "begbies-traynor.com", company_name: "Begbies Traynor", location: "UK", sic_code: "69201" },
    { domain: "frpadvisory.com", company_name: "FRP Advisory", location: "UK", sic_code: "69201" },
    { domain: "macintyrehudson.co.uk", company_name: "MHA MacIntyre Hudson", location: "UK", sic_code: "69201" },
  ];
  const out = [];
  for (const d of demos) {
    const live = await isWebsiteLive(d.domain).catch(() => true);
    const row = await upsertAccountancyFirm({
      ...d,
      source,
      website_verified: live,
      crawl_status: live ? "pending" : "unreachable",
      website_url: `https://${d.domain}`,
    });
    if (row) out.push(row);
  }
  return out;
}

// silence unused import lint for preferUkTld if tree-shaken
void preferUkTld;
void isUkAccountancyDomain;
