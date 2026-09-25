import { logger } from "../utils/logger.js";
import { discoverFromCompaniesHouse, seedDemoFirms, purgeFirmsWithoutWebsites } from "./companiesHouse.js";
import { discoverFromGoogleSearch } from "./googleSearch.js";
import { discoverFromGoogleRegional } from "./googleRegional.js";
import { discoverFromDirectories, UK_LOCATIONS } from "./directories.js";
import { listAccountancyFirms, getCoverageStats } from "../supabase/insertDomain.js";
import { UK_REGION_GRID } from "./ukRegions.js";

const log = logger("discovery");

/**
 * Full UK-wide discovery — only firms with live websites.
 * Includes regional Google/"near me" sweeps across UK city grid (~50 miles).
 */
export async function runDiscovery({
  includeDirectories = true,
  deep = false,
  includeRegionalGoogle = true,
} = {}) {
  log.info("Starting UK accountancy discovery", { deep, includeRegionalGoogle });
  const purged = await purgeFirmsWithoutWebsites({ limit: deep ? 5000 : 2000 });
  const ch = await discoverFromCompaniesHouse({
    maxPagesPerSic: deep ? 20 : Number(process.env.CH_MAX_PAGES_PER_SIC || 5),
  });
  const google = await discoverFromGoogleSearch({
    num: deep ? 20 : 10,
    deep,
  });
  const regional = includeRegionalGoogle
    ? await discoverFromGoogleRegional({
        deep,
        maxPlaces: deep ? UK_REGION_GRID.length : Number(process.env.REGIONAL_PLACE_LIMIT || 35),
        queries: deep
          ? ["accountants near me", "accountant", "chartered accountant", "tax accountant"]
          : ["accountants near me", "accountant"],
      })
    : [];
  const dirs = includeDirectories
    ? await discoverFromDirectories({
        locations: deep ? [...UK_LOCATIONS] : UK_LOCATIONS.slice(0, 15),
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
    purgedNoWebsite: purged.removed,
    google: google.length,
    regionalGoogle: regional.length,
    directories: dirs.length,
    crawlableFirms: firms.length,
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
