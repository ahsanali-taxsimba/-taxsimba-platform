import { logger } from "../utils/logger.js";
import { discoverFromCompaniesHouse, seedDemoFirms } from "./companiesHouse.js";
import { discoverFromGoogleSearch } from "./googleSearch.js";
import { discoverFromDirectories } from "./directories.js";
import { listAccountancyFirms } from "../supabase/insertDomain.js";

const log = logger("discovery");

/**
 * Full discovery pipeline:
 * Companies House → Google operators → UK directories → ensure demo seed baseline
 */
export async function runDiscovery({ includeDirectories = true } = {}) {
  log.info("Starting UK accountancy discovery");
  const ch = await discoverFromCompaniesHouse();
  const google = await discoverFromGoogleSearch();
  const dirs = includeDirectories ? await discoverFromDirectories() : [];

  let firms = await listAccountancyFirms({ limit: 1000 });
  if (!firms.length) {
    log.warn("No firms found — inserting demo baseline");
    await seedDemoFirms("baseline");
    firms = await listAccountancyFirms({ limit: 1000 });
  }

  const summary = {
    companiesHouse: ch.length,
    google: google.length,
    directories: dirs.length,
    totalFirms: firms.length,
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
