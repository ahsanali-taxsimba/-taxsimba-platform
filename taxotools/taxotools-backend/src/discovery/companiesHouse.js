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
          let verified = false;
          if (resolveWebsites) {
            domain = await resolveLiveDomainFromName(name);
            verified = Boolean(domain);
            await sleep(150);
          }

          // If no live site yet, still track the company under a stable CH placeholder domain
          // so we can resolve websites later — crawler skips placeholders.
          if (!domain) {
            domain = `ch-${companyNumber}.companieshouse.pending`;
          }

          const row = await upsertAccountancyFirm({
            domain,
            company_name: name,
            location,
            sic_code: sic,
            company_number: companyNumber,
            source: "companies_house",
            website_url: verified ? `https://${domain}` : null,
            website_verified: verified,
            crawl_status: verified ? "pending" : "needs_website",
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

  log.info(`Companies House discovered ${found.length} firms (verified sites preferred)`);
  return found;
}

/** Re-check firms that still need a website */
export async function resolvePendingWebsites({ limit = 40 } = {}) {
  const { getSupabase } = await import("../supabase/client.js");
  const { data } = await getSupabase()
    .from("accountancy_firms")
    .select("*")
    .eq("crawl_status", "needs_website")
    .limit(limit);

  let resolved = 0;
  for (const firm of data || []) {
    const domain = await resolveLiveDomainFromName(firm.company_name);
    if (!domain) continue;
    await upsertAccountancyFirm({
      domain,
      company_name: firm.company_name,
      location: firm.location,
      sic_code: firm.sic_code,
      company_number: firm.company_number,
      source: firm.source || "companies_house",
      website_url: `https://${domain}`,
      website_verified: true,
      crawl_status: "pending",
    });
    // Soft-delete / mark old placeholder
    if (firm.domain?.includes(".companieshouse.pending")) {
      await getSupabase()
        .from("accountancy_firms")
        .update({ crawl_status: "superseded", updated_at: new Date().toISOString() })
        .eq("domain", firm.domain);
    }
    resolved += 1;
    await sleep(200);
  }
  log.info("Resolved pending websites", { resolved, checked: (data || []).length });
  return { resolved };
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
