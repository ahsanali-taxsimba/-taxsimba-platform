import { logger } from "../utils/logger.js";
import { discoverFromCompaniesHouse, seedDemoFirms, purgeFirmsWithoutWebsites } from "./companiesHouse.js";
import { discoverFromGoogleSearch } from "./googleSearch.js";
import { discoverFromDirectories } from "./directories.js";
import { listAccountancyFirms, getCoverageStats } from "../supabase/insertDomain.js";

const log = logger("discovery");

/**
 * Full UK-wide discovery — only firms with live websites are kept.
 */
export async function runDiscovery({
  includeDirectories = true,
  deep = false,
} = {}) {
  log.info("Starting UK accountancy discovery", { deep });
  const purged = await purgeFirmsWithoutWebsites({ limit: deep ? 5000 : 2000 });
  const ch = await discoverFromCompaniesHouse({
    maxPagesPerSic: deep ? 20 : Number(process.env.CH_MAX_PAGES_PER_SIC || 5),
  });
  const google = await discoverFromGoogleSearch({
    num: deep ? 20 : 10,
  });
  const dirs = includeDirectories
    ? await discoverFromDirectories({
        locations: undefined,
        verifyLive: true,
      })
    : [];

  await seedDemoFirms("national_seed");

  let firms = await listAccountancyFirms({ limit: 5000, crawlableOnly: true });
  if (!firms.length) {
    log.warn("No crawlable firms — seeding demo baseline");
    await seedDemoFirms("baseline");
    firms = await listAccountancyFirms({ limit: 5000, crawlableOnly: true });
  }

  const coverage = await getCoverageStats();
  const summary = {
    companiesHouse: ch.length,
    purgedNoWebsite: purged.removed,
    google: google.length,
    directories: dirs.length,
    crawlableFirms: firms.length,
    coverage,
  };
  log.info("Discovery complete", summary);
  return { summary, firms };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDiscovery()
    .then((r) => {
      console.log(JSON.stringify(r.summary, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
