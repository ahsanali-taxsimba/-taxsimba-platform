import { env } from "../utils/env.js";
import { logger, sleep } from "../utils/logger.js";
import { assertSupabase } from "../utils/env.js";
import { runDiscovery } from "../discovery/index.js";
import { runCrawl } from "../crawler/index.js";
import { scoreAllReferringDomains } from "../scoring/backlinkScoring.js";
import { heartbeatCrawler, getCrawlerControl } from "../supabase/insertIntelligence.js";
import { getSupabase } from "../supabase/client.js";
import { getCoverageStats } from "../supabase/insertDomain.js";
import { refreshKeywordsForDomain } from "../keywords/keywordsEverywhere.js";
import { extractKeywordCandidates } from "../crawler/extractIntelligence.js";

const log = logger("continuous");

function dayOfMonth() {
  return new Date().getUTCDate();
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function dailyKeywordPass(limit = 20) {
  const { data: firms } = await getSupabase()
    .from("accountancy_firms")
    .select("domain")
    .eq("crawl_status", "completed")
    .order("updated_at", { ascending: true })
    .limit(limit);
  for (const f of firms || []) {
    const { data: seo } = await getSupabase()
      .from("seo_data")
      .select("title,h1,h2,h3")
      .eq("domain", f.domain)
      .limit(30);
    await refreshKeywordsForDomain(f.domain, extractKeywordCandidates(seo || []));
  }
}

/**
 * Fast continuous loop: parallel crawl-first, light discovery, short idle.
 */
export async function runForever() {
  assertSupabase();
  log.info("Continuous UK coverage crawler START — FAST mode", {
    batch: env.continuousFirmBatch,
    concurrency: env.crawlConcurrency,
    sleepMs: env.continuousLoopSleepMs,
    delayMs: env.crawlDelayMs,
    maxPages: env.maxPagesPerDomain,
    competitorsFirstPass: env.collectCompetitorsFirstPass,
  });

  await heartbeatCrawler({
    status: "running",
    notes: "FAST mode: parallel crawl, competitors deferred",
    last_heartbeat_at: new Date().toISOString(),
  });

  let cycles = 0;
  let firmsProcessed = 0;
  let lastDailyKey = "";
  let lastWeeklyKey = "";

  try {
    log.info("Boot: purge no-website + light discovery");
    const { purgeFirmsWithoutWebsites } = await import("../discovery/companiesHouse.js");
    await withTimeout(purgeFirmsWithoutWebsites({ limit: 3000 }), 90_000, "boot-purge");
    await withTimeout(
      runDiscovery({ includeDirectories: false, deep: false }),
      120_000,
      "boot-discovery",
    );
  } catch (e) {
    log.warn("Boot partial — starting crawl loop", { error: String(e.message || e) });
  }

  while (true) {
    try {
      const control = await getCrawlerControl();
      if (control?.status === "paused") {
        await heartbeatCrawler({ status: "paused" });
        await sleep(env.continuousLoopSleepMs);
        continue;
      }

      const now = new Date();
      const dailyKey = now.toISOString().slice(0, 10);
      const weeklyKey = `${now.getUTCFullYear()}-W${Math.ceil(dayOfMonth() / 7)}`;
      const doWeekly = weeklyKey !== lastWeeklyKey;

      const coverageBefore = await getCoverageStats().catch(() => ({}));
      const pending = Number(coverageBefore.firms_pending_crawl || 0);

      // Bigger batches while backlog is high
      const crawlLimit = pending > 200
        ? Math.max(env.continuousFirmBatch, 24)
        : Math.max(env.continuousFirmBatch, 12);

      const crawl = await withTimeout(
        runCrawl({
          limit: crawlLimit,
          concurrency: env.crawlConcurrency,
          // Common Crawl only weekly — speeds normal cycles a lot
          includeCommonCrawl: doWeekly,
          collectCompetitors: doWeekly || env.collectCompetitorsFirstPass,
          maxPages: Math.min(env.maxPagesPerDomain, doWeekly ? 30 : 15),
        }),
        20 * 60_000,
        "crawl-batch",
      ).catch((e) => {
        log.warn("Crawl batch error/timeout", { error: String(e.message || e) });
        return { firms: 0 };
      });
      firmsProcessed += crawl.firms || 0;

      // Discovery less often while backlog is large
      const shouldDiscover =
        pending < 100 || cycles % 6 === 0 || dailyKey !== lastDailyKey;
      if (shouldDiscover) {
        await withTimeout(
          runDiscovery({
            includeDirectories: cycles % 12 === 0,
            deep: false,
          }),
          180_000,
          "discovery",
        ).catch((e) => log.warn(String(e.message || e)));
      }

      if (dailyKey !== lastDailyKey) {
        if (env.collectKeywords) {
          await dailyKeywordPass(env.continuousFirmBatch * 2).catch(() => {});
        }
        lastDailyKey = dailyKey;
      }

      if (doWeekly) {
        await scoreAllReferringDomains({ limit: 800 }).catch(() => {});
        lastWeeklyKey = weeklyKey;
      }

      cycles += 1;
      const coverage = await getCoverageStats().catch(() => ({}));
      await heartbeatCrawler({
        status: "running",
        last_cycle_at: new Date().toISOString(),
        cycles_completed: cycles,
        firms_processed: firmsProcessed,
        notes: JSON.stringify({ mode: "fast", ...coverage }).slice(0, 450),
      });

      log.info("FAST coverage heartbeat", {
        cycles,
        firmsProcessed,
        concurrency: env.crawlConcurrency,
        coverage,
      });

      // Short nap when backlog remains; longer when nearly done
      const sleepMs = Number(coverage.firms_pending_crawl || 0) > 50
        ? Math.min(env.continuousLoopSleepMs, 5000)
        : env.continuousLoopSleepMs;
      await sleep(sleepMs);
    } catch (e) {
      log.error("Continuous cycle error — will retry", { error: String(e.message || e) });
      await heartbeatCrawler({
        status: "running",
        notes: `error: ${String(e.message || e).slice(0, 200)}`,
      });
      await sleep(5000);
    }
  }
}

if (process.argv[1]?.endsWith("continuous.js")) {
  runForever().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
