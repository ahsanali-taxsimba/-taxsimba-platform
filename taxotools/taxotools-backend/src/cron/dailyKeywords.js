import { logger } from "../utils/logger.js";
import { getSupabase } from "../supabase/client.js";
import { extractKeywordCandidates } from "../crawler/extractIntelligence.js";
import { refreshKeywordsForDomain } from "../keywords/keywordsEverywhere.js";

const log = logger("cron:dailyKeywords");

export async function dailyKeywordUpdate({ limit = 50 } = {}) {
  const { data: firms } = await getSupabase()
    .from("accountancy_firms")
    .select("domain")
    .order("updated_at", { ascending: true })
    .limit(limit);
  let updated = 0;
  for (const f of firms || []) {
    const { data: seo } = await getSupabase()
      .from("seo_data")
      .select("title,h1,h2,h3")
      .eq("domain", f.domain)
      .limit(40);
    await refreshKeywordsForDomain(f.domain, extractKeywordCandidates(seo || []));
    updated += 1;
  }
  log.info("Daily keyword update done", { updated });
  return { updated };
}

if (process.argv[1]?.endsWith("dailyKeywords.js")) {
  dailyKeywordUpdate()
    .then((r) => {
      console.log(JSON.stringify(r));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
