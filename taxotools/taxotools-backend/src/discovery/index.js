import { logger } from "../utils/logger.js";
import { discoverFromCompaniesHouse, seedDemoFirms, purgeFirmsWithoutWebsites } from "./companiesHouse.js";
import { discoverFromCompaniesHouseRegional } from "./companiesHouseRegional.js";
import { discoverFromGoogleSearch } from "./googleSearch.js";
import { discoverFromGoogleRegional } from "./googleRegional.js";
import { discoverFromDirectories, UK_LOCATIONS } from "./directories.js";
import { listAccountancyFirms, getCoverageStats } from "../supabase/insertDomain.js";
import { UK_REGION_GRID } from "./ukRegions.js";

const log = logger("discovery");

/**
 * Full UK-wide discovery — only firms with live websites.
 * Regional near-me = Google Maps via SerpAPI (when key set) + Companies House by city.
 */
export async function runDiscovery({
  includeDirectories = true,
  deep = false,
  includeRegionalGoogle = true,
  regionalPlaceLimit,
} = {}) {
  log.info("Starting UK accountancy discovery", { deep, includeRegionalGoogle });
  const placeLimit =
    regionalPlaceLimit ??
    (deep ? UK_REGION_GRID.length : Number(process.env.REGIONAL_PLACE_LIMIT || 8));

  const purged = await purgeFirmsWithoutWebsites({ limit: deep ? 5000 : 2000 });
  const ch = await discoverFromCompaniesHouse({
    maxPagesPerSic: deep ? 30 : Number(process.env.CH_MAX_PAGES_PER_SIC || 8),
  });
  const chRegional = await discoverFromCompaniesHouseRegional({
    deep,
    maxPlaces: placeLimit,
  });
  const google = await discoverFromGoogleSearch({
    num: deep ? 20 : 10,
    deep,
  });
  const regional = includeRegionalGoogle
    ? await discoverFromGoogleRegional({
        deep,
        maxPlaces: placeLimit,
        queries: deep
          ? ["accountants near me", "accountant", "chartered accountant", "tax accountant"]
          : ["accountants near me", "accountant"],
      })
    : [];
  const dirs = includeDirectories
    ? await discoverFromDirectories({
        locations: deep ? [...UK_LOCATIONS] : UK_LOCATIONS.slice(0, 8),
        verifyLive: true,
      })
    : [];

  await seedDemoFirms("national_seed");

  let firms = await listAccountancyFirms({ limit: 8000, crawlableOnly: true });
  if (!firms.length) {
    log.warn("No crawlable firms — seeding demo baseline");
    await seedDemoFirms("baseline");
    firms = await listAccountancyFirms({ limit: 8000, crawlableOnly: true });
  }

  const coverage = await getCoverageStats();
  const summary = {
    companiesHouse: ch.length,
    companiesHouseRegional: chRegional.length,
    purgedNoWebsite: purged.removed,
    google: google.length,
    regionalGoogle: regional.length,
    directories: dirs.length,
    crawlableFirms: firms.length,
    regionalPlacesSwept: placeLimit,
    coverage,
  };
  log.info("Discovery complete", summary);
  return { summary, firms };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDiscovery({ deep: process.argv.includes("--deep") })
    .then((r) => {
      console.log(JSON.stringify(r.summary, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
