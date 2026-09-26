/**
 * Regional Companies House discovery: SIC accountancy firms registered in each UK city/area.
 * Free (uses COMPANIES_HOUSE_API_KEY) and works from cloud IPs — unlike Google/Yell scrapes.
 */
import { env } from "../utils/env.js";
import { fetchJson } from "../utils/fetch.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";
import { resolveLiveDomainFromName } from "./resolveWebsite.js";
import { UK_REGION_GRID } from "./ukRegions.js";
import { ACCOUNTANCY_SIC_CODES } from "./companiesHouse.js";

const log = logger("companiesHouseRegional");

/**
 * Rotate through UK region grid so each discovery cycle covers different cities.
 */
export async function discoverFromCompaniesHouseRegional({
  maxPlaces = Number(process.env.REGIONAL_PLACE_LIMIT || 8),
  perPlace = 40,
  deep = false,
  offset = Number(process.env.REGIONAL_OFFSET || 0),
} = {}) {
  if (!env.companiesHouseKey) {
    log.warn("COMPANIES_HOUSE_API_KEY missing — skip regional CH");
    return [];
  }

  const auth = Buffer.from(`${env.companiesHouseKey}:`).toString("base64");
  const grid = UK_REGION_GRID;
  let places;
  if (deep) {
    places = grid;
  } else {
    const start = ((offset % grid.length) + grid.length) % grid.length;
    places = [];
    for (let i = 0; i < Math.min(maxPlaces, grid.length); i++) {
      places.push(grid[(start + i) % grid.length]);
    }
  }
  const found = [];
  const seen = new Set();

  log.info("CH regional start", { places: places.length, offset });

  for (const place of places) {
    const locationQ = place.name.replace(/\s+NI$/, "").trim();
    for (const sic of ACCOUNTANCY_SIC_CODES) {
      try {
        const url =
          `https://api.company-information.service.gov.uk/advanced-search/companies` +
          `?sic_codes=${sic}` +
          `&location=${encodeURIComponent(locationQ)}` +
          `&size=${perPlace}&start_index=0&company_status=active`;
        const data = await fetchJson(url, {
          headers: { Authorization: `Basic ${auth}` },
          timeoutMs: 25000,
        });
        for (const item of data.items || []) {
          const companyNumber = item.company_number;
          if (!companyNumber || seen.has(companyNumber)) continue;
          seen.add(companyNumber);

          const name = item.company_name || item.title || "Unknown";
          const location =
            item.registered_office_address?.locality ||
            item.registered_office_address?.region ||
            locationQ;

          const domain = await resolveLiveDomainFromName(name);
          await sleep(120);
          if (!domain) continue;

          const row = await upsertAccountancyFirm({
            domain,
            company_name: name,
            location,
            sic_code: sic,
            company_number: companyNumber,
            source: `companies_house_regional:${locationQ}`,
            website_url: `https://${domain}`,
            website_verified: true,
            crawl_status: "pending",
          });
          if (row) found.push(row);
        }
        await sleep(env.crawlDelayMs);
      } catch (e) {
        log.warn(`CH regional ${locationQ}/${sic}`, { error: String(e.message || e) });
      }
    }
    log.info(`CH regional ${locationQ}`, { saved: found.length });
  }

  log.info("CH regional complete", { saved: found.length });
  return found;
}
