import { env } from "../utils/env.js";
import { fetchJson } from "../utils/fetch.js";
import { normalizeDomain, preferUkTld } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";

const log = logger("companiesHouse");

/** SIC codes for accountancy / bookkeeping / tax consultancy */
export const ACCOUNTANCY_SIC_CODES = ["69201", "69202", "69203"];

/**
 * Companies House Search API — free with API key.
 * https://developer.company-information.service.gov.uk/
 */
export async function discoverFromCompaniesHouse({ perCode = 20 } = {}) {
  if (!env.companiesHouseKey) {
    log.warn("COMPANIES_HOUSE_API_KEY missing — seeding demo UK firms instead");
    return seedDemoFirms("companies_house_demo");
  }

  const auth = Buffer.from(`${env.companiesHouseKey}:`).toString("base64");
  const found = [];

  for (const sic of ACCOUNTANCY_SIC_CODES) {
    try {
      // Advanced search by SIC
      const url =
        `https://api.company-information.service.gov.uk/advanced-search/companies` +
        `?sic_codes=${sic}&size=${perCode}&company_status=active`;
      const data = await fetchJson(url, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const items = data.items || [];
      for (const item of items) {
        const companyNumber = item.company_number;
        let website = null;
        let location =
          item.registered_office_address?.locality ||
          item.registered_office_address?.region ||
          item.registered_office_address?.country ||
          null;

        // Best-effort: company profile rarely includes website; keep name-based domain guess + later crawlers
        if (companyNumber) {
          await sleep(env.crawlDelayMs);
        }

        const name = item.company_name || item.title || "Unknown";
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "")
          .slice(0, 40);
        // Without explicit website, skip dubious guesses — store with placeholder domain only if we parse links later
        // Use company number based placeholder that discovery directories/google can replace
        const domainGuess = slug ? `${slug}.co.uk` : null;
        if (!domainGuess || !preferUkTld(domainGuess)) continue;

        const row = await upsertAccountancyFirm({
          domain: domainGuess,
          company_name: name,
          location,
          sic_code: sic,
          source: "companies_house",
          website_url: `https://${domainGuess}`,
        });
        if (row) found.push(row);
      }
      await sleep(env.crawlDelayMs);
    } catch (e) {
      log.warn(`SIC ${sic} failed`, { error: String(e.message || e) });
    }
  }

  log.info(`Companies House discovered ${found.length} firms`);
  return found;
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
  ];
  const out = [];
  for (const d of demos) {
    const row = await upsertAccountancyFirm({ ...d, source });
    if (row) out.push(row);
  }
  return out;
}

export function extractWebsiteFromText(text) {
  const m = String(text || "").match(/https?:\/\/(www\.)?([a-z0-9.-]+\.(co\.uk|org\.uk|gov\.uk|com))/i);
  return m ? normalizeDomain(m[2]) : null;
}
