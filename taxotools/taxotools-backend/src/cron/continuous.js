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
import { resolvePendingWebsites } from "../discovery/companiesHouse.js";

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
 * Never-stop UK-wide coverage loop.
 * Crawl FIRST so data grows; discover in bounded passes so boot never hangs forever.
 */
export async function runForever() {
  assertSupabase();
  log.info("Continuous UK coverage crawler START — never stop", {
    batch: env.continuousFirmBatch,
    sleepMs: env.continuousLoopSleepMs,
    maxPages: env.maxPagesPerDomain,
  });

  await heartbeatCrawler({
    status: "running",
    notes: "UK-wide coverage engine online — crawl-first mode",
    last_heartbeat_at: new Date().toISOString(),
  });

  let cycles = 0;
  let firmsProcessed = 0;
  let lastDailyKey = "";
  let lastWeeklyKey = "";

  // Light boot only (max ~3 min) — never block forever on deep discovery
  try {
    log.info("Boot: light discovery + website resolve");
    await withTimeout(
      runDiscovery({ includeDirectories: false, deep: false }),
      180_000,
      "boot-discovery",
    );
    await withTimeout(resolvePendingWebsites({ limit: 25 }), 120_000, "boot-resolve");
  } catch (e) {
    log.warn("Boot discovery skipped/partial — starting crawl loop", {
      error: String(e.message || e),
    });
  }

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
      const weeklyKey = `${now.getUTCFullYear()}-W${Math.ceil(dayOfMonth() / 7)}`;

      // 1) CRAWL FIRST — process pending verified firms every cycle
      const doWeekly = weeklyKey !== lastWeeklyKey;
      const crawlLimit = doWeekly
        ? Math.max(env.continuousFirmBatch, 15)
        : Math.max(env.continuousFirmBatch, 8);

      const crawl = await withTimeout(
        runCrawl({
          limit: crawlLimit,
          includeCommonCrawl: doWeekly || cycles % 4 === 0,
          maxPages: Math.min(env.maxPagesPerDomain, doWeekly ? 40 : 20),
        }),
        15 * 60_000,
        "crawl-batch",
      ).catch((e) => {
        log.warn("Crawl batch error/timeout", { error: String(e.message || e) });
        return { firms: 0 };
      });
      firmsProcessed += crawl.firms || 0;

      // 2) Bounded discovery every 3 cycles (or daily) — never hang the loop
      if (cycles % 3 === 0 || dailyKey !== lastDailyKey) {
        log.info("Discovery pass (bounded)");
        await withTimeout(
          runDiscovery({
            includeDirectories: cycles % 6 === 0,
            deep: false,
          }),
          240_000,
          "discovery",
        ).catch((e) => log.warn(String(e.message || e)));
        await withTimeout(resolvePendingWebsites({ limit: 30 }), 120_000, "resolve").catch(
          (e) => log.warn(String(e.message || e)),
        );
      }

      if (dailyKey !== lastDailyKey) {
        // Keywords are optional (phase 2) — only when COLLECT_KEYWORDS / KE key enabled
        if (env.collectKeywords) {
          await dailyKeywordPass(env.continuousFirmBatch * 2).catch(() => {});
        }
        lastDailyKey = dailyKey;
      }

      if (doWeekly) {
        await scoreAllReferringDomains({ limit: 500 }).catch(() => {});
        lastWeeklyKey = weeklyKey;
      }

      cycles += 1;
      const coverage = await getCoverageStats().catch(() => ({}));
      await heartbeatCrawler({
        status: "running",
        last_cycle_at: new Date().toISOString(),
        cycles_completed: cycles,
        firms_processed: firmsProcessed,
        notes: JSON.stringify(coverage).slice(0, 450),
      });

      log.info("Coverage heartbeat", { cycles, firmsProcessed, coverage });
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
