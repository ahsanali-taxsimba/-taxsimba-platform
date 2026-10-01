import { logger } from "../utils/logger.js";
import { scoreAllReferringDomains } from "../scoring/backlinkScoring.js";

const log = logger("cron:weeklyAuthority");

export async function weeklyAuthorityUpdate() {
  log.info("Weekly authority score update starting");
  const result = await scoreAllReferringDomains({ limit: 1000 });
  log.info("Weekly authority update done", result);
  return result;
}

if (process.argv[1]?.endsWith("weeklyAuthorityUpdate.js")) {
  weeklyAuthorityUpdate()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
