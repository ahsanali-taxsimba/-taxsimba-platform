import { env } from "../utils/env.js";
import { logger, sleep } from "../utils/logger.js";
import { assertSupabase } from "../utils/env.js";
import { runDiscovery } from "../discovery/index.js";
import { runCrawl } from "../crawler/index.js";
import { scoreAllReferringDomains } from "../scoring/backlinkScoring.js";
import { heartbeatCrawler, getCrawlerControl } from "../supabase/insertIntelligence.js";
import { getSupabase } from "../supabase/client.js";
import { refreshKeywordsForDomain } from "../keywords/keywordsEverywhere.js";
import { extractKeywordCandidates } from "../crawler/extractIntelligence.js";

const log = logger("continuous");

function dayOfMonth() {
  return new Date().getUTCDate();
}
function dayOfWeek() {
  return new Date().getUTCDay(); // 0=Sun
}

async function dailyKeywordPass(limit = 20) {
  const { data: firms } = await getSupabase()
    .from("accountancy_firms")
    .select("domain")
    .order("updated_at", { ascending: true })
    .limit(limit);
  for (const f of firms || []) {
    const { data: seo } = await getSupabase()
      .from("seo_data")
      .select("title,h1,h2,h3")
      .eq("domain", f.domain)
      .limit(30);
    const candidates = extractKeywordCandidates(seo || []);
    await refreshKeywordsForDomain(f.domain, candidates);
  }
}

/**
 * Never-stop loop: discovery → crawl (SEO/GEO/AEO/backlinks/keywords/competitors) → score → heartbeat
 * Weekly / monthly / daily cadence is interleaved inside the loop.
 */
export async function runForever() {
  assertSupabase();
  log.info("Continuous crawler START — never stop", {
    batch: env.continuousFirmBatch,
    sleepMs: env.continuousLoopSleepMs,
    maxPages: env.maxPagesPerDomain,
    delayMs: env.crawlDelayMs,
  });

  await heartbeatCrawler({ status: "running", notes: "continuous engine online" });
  let cycles = 0;
  let firmsProcessed = 0;
  let lastDailyKey = "";
  let lastWeeklyKey = "";
  let lastMonthlyKey = "";

  while (true) {
    try {
      const control = await getCrawlerControl();
      if (control?.status === "paused") {
        log.info("Crawler paused via crawler_control — sleeping");
        await heartbeatCrawler({ status: "paused" });
        await sleep(env.continuousLoopSleepMs);
        continue;
      }

      const now = new Date();
      const dailyKey = now.toISOString().slice(0, 10);
      const weeklyKey = `${now.getUTCFullYear()}-W${Math.ceil(dayOfMonth() / 7)}-${dayOfWeek()}`;
      const monthlyKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;

      // Daily: keyword refresh + light discovery
      if (dailyKey !== lastDailyKey) {
        log.info("Daily jobs: discovery + keywords");
        await runDiscovery({ includeDirectories: true });
        await dailyKeywordPass(env.continuousFirmBatch * 2);
        lastDailyKey = dailyKey;
      }

      // Weekly: deeper crawl + authority (run once per week on Monday-ish or first cycle of week)
      const doWeekly = weeklyKey !== lastWeeklyKey && (dayOfWeek() === 1 || cycles === 0);
      const crawlLimit = doWeekly ? Math.max(env.continuousFirmBatch, 10) : env.continuousFirmBatch;

      const crawl = await runCrawl({
        limit: crawlLimit,
        includeCommonCrawl: doWeekly || cycles % 3 === 0,
        maxPages: Math.min(env.maxPagesPerDomain, doWeekly ? 50 : 25),
      });
      firmsProcessed += crawl.firms || 0;

      if (doWeekly) {
        await scoreAllReferringDomains({ limit: 500 });
        lastWeeklyKey = weeklyKey;
        log.info("Weekly authority refresh complete");
      }

      // Monthly discovery deep pass already covered by daily; mark monthly
      if (monthlyKey !== lastMonthlyKey && dayOfMonth() === 1) {
        await runDiscovery({ includeDirectories: true });
        lastMonthlyKey = monthlyKey;
      }

      cycles += 1;
      await heartbeatCrawler({
        status: "running",
        last_cycle_at: new Date().toISOString(),
        cycles_completed: cycles,
        firms_processed: firmsProcessed,
        notes: `last batch firms=${crawl.firms}`,
      });

      log.info("Cycle heartbeat", { cycles, firmsProcessed, sleepMs: env.continuousLoopSleepMs });
    } catch (e) {
      log.error("Continuous cycle error — will retry", { error: String(e.message || e) });
      await heartbeatCrawler({
        status: "running",
        notes: `error: ${String(e.message || e).slice(0, 200)}`,
      });
    }

    await sleep(env.continuousLoopSleepMs);
  }
}

if (process.argv[1]?.endsWith("continuous.js")) {
  runForever().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
