import { logger } from "../utils/logger.js";
import { runCrawl } from "../crawler/index.js";

const log = logger("cron:weeklyCrawl");

export async function weeklyCrawl() {
  log.info("Weekly backlink refresh starting");
  const result = await runCrawl({ limit: 100, includeCommonCrawl: true });
  log.info("Weekly backlink refresh done", { firms: result.firms });
  return result;
}

if (process.argv[1]?.endsWith("weeklyCrawl.js")) {
  weeklyCrawl()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
