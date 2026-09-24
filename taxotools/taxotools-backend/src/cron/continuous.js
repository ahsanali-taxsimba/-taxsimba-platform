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
function dayOfWeek() {
  return new Date().getUTCDay();
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
 * Discovers new firms every few cycles, crawls EVERY crawlable firm over time,
 * saves SEO/GEO/AEO/keywords/backlinks/competitors to Supabase forever.
 */
export async function runForever() {
  assertSupabase();
  log.info("Continuous UK coverage crawler START — never stop", {
    batch: env.continuousFirmBatch,
    sleepMs: env.continuousLoopSleepMs,
    maxPages: env.maxPagesPerDomain,
  });

  await heartbeatCrawler({ status: "running", notes: "UK-wide coverage engine online" });
  let cycles = 0;
  let firmsProcessed = 0;
  let lastDailyKey = "";
  let lastWeeklyKey = "";

  // Immediate deep discovery on boot so the database fills quickly
  try {
    log.info("Boot discovery (deep) — filling UK firm list");
    await runDiscovery({ includeDirectories: true, deep: true });
    await resolvePendingWebsites({ limit: 80 });
  } catch (e) {
    log.warn("Boot discovery error — continuing", { error: String(e.message || e) });
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

      // Discover new UK accountants every 3 cycles + every calendar day
      if (cycles % 3 === 0 || dailyKey !== lastDailyKey) {
        log.info("Discovery pass — find more UK accountants");
        await runDiscovery({
          includeDirectories: true,
          deep: dailyKey !== lastDailyKey,
        });
        await resolvePendingWebsites({ limit: 50 });
      }

      if (dailyKey !== lastDailyKey) {
        await dailyKeywordPass(env.continuousFirmBatch * 3);
        lastDailyKey = dailyKey;
      }

      const doWeekly = weeklyKey !== lastWeeklyKey;
      const crawlLimit = doWeekly
        ? Math.max(env.continuousFirmBatch, 15)
        : Math.max(env.continuousFirmBatch, 8);

      // Always crawl oldest / never-crawled firms next
      const crawl = await runCrawl({
        limit: crawlLimit,
        includeCommonCrawl: doWeekly || cycles % 4 === 0,
        maxPages: Math.min(env.maxPagesPerDomain, doWeekly ? 60 : 30),
      });
      firmsProcessed += crawl.firms || 0;

      if (doWeekly) {
        await scoreAllReferringDomains({ limit: 800 });
        lastWeeklyKey = weeklyKey;
      }

      cycles += 1;
      const coverage = await getCoverageStats();
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
