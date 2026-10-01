import { logger } from "../utils/logger.js";
import { runDiscovery } from "../discovery/index.js";
import { runCrawl } from "../crawler/index.js";
import { scoreAllReferringDomains } from "../scoring/backlinkScoring.js";

const log = logger("cycle");

/**
 * Continuous cycle: Discovery → Crawl → Store → Score → (repeat externally)
 */
export async function runCycle({ firmLimit = 15, includeDirectories = true } = {}) {
  log.info("Cycle start: discovery → crawl → score");
  const discovery = await runDiscovery({ includeDirectories });
  const crawl = await runCrawl({
    limit: firmLimit,
    includeCommonCrawl: true,
  });
  const score = await scoreAllReferringDomains({ limit: 500 });
  const summary = {
    discovery: discovery.summary,
    crawl: { firms: crawl.firms, results: crawl.results.length },
    score,
    at: new Date().toISOString(),
  };
  log.info("Cycle complete", summary);
  return summary;
}

if (process.argv[1]?.endsWith("runCycle.js")) {
  runCycle()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
