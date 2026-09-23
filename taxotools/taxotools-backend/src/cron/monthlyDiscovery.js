import { logger } from "../utils/logger.js";
import { runDiscovery } from "../discovery/index.js";

const log = logger("cron:monthlyDiscovery");

export async function monthlyDiscovery() {
  log.info("Monthly discovery refresh starting");
  const result = await runDiscovery({ includeDirectories: true });
  log.info("Monthly discovery done", result.summary);
  return result.summary;
}

if (process.argv[1]?.endsWith("monthlyDiscovery.js")) {
  monthlyDiscovery()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
