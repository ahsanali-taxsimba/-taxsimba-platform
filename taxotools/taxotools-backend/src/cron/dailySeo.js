import { logger } from "../utils/logger.js";
import { runCrawl } from "../crawler/index.js";

const log = logger("cron:dailySeo");

/** Daily SEO / GEO / AEO refresh (smaller page budget). */
export async function dailySeoGeoAeoRefresh({ limit = 15, maxPages = 20 } = {}) {
  log.info("Daily SEO/GEO/AEO refresh");
  const crawl = await runCrawl({
    limit,
    maxPages,
    includeCommonCrawl: false,
  });
  return { firms: crawl.firms, results: crawl.results.length };
}

if (process.argv[1]?.endsWith("dailySeo.js")) {
  dailySeoGeoAeoRefresh()
    .then((r) => {
      console.log(JSON.stringify(r));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
