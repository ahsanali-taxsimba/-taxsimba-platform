import { logger } from "../utils/logger.js";
import { discoverFromCompaniesHouse, seedDemoFirms, resolvePendingWebsites } from "./companiesHouse.js";
import { discoverFromGoogleSearch } from "./googleSearch.js";
import { discoverFromDirectories } from "./directories.js";
import { listAccountancyFirms, getCoverageStats } from "../supabase/insertDomain.js";

const log = logger("discovery");

/**
 * Full UK-wide discovery:
 * Companies House (paginated SIC) → resolve pending sites → Google → city directories → seed baseline
 */
export async function runDiscovery({
  includeDirectories = true,
  deep = false,
} = {}) {
  log.info("Starting UK accountancy discovery", { deep });
  const ch = await discoverFromCompaniesHouse({
    maxPagesPerSic: deep ? 20 : Number(process.env.CH_MAX_PAGES_PER_SIC || 5),
  });
  const resolved = await resolvePendingWebsites({ limit: deep ? 100 : 40 });
  const google = await discoverFromGoogleSearch({
    num: deep ? 20 : 10,
  });
  const dirs = includeDirectories
    ? await discoverFromDirectories({
        locations: undefined, // use default city list
        verifyLive: true,
      })
    : [];

  // Always ensure known national firms exist
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
    websitesResolved: resolved.resolved,
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
