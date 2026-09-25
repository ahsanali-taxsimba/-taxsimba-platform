import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Prefer monorepo taxotools/.env, then local backend .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function first(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

export const env = {
  supabaseUrl: first(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  serviceRoleKey: first(process.env.SUPABASE_SERVICE_ROLE_KEY),
  anonKey: first(
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  openPageRankKey: first(
    process.env.OPEN_PAGERANK_API_KEY,
    process.env.OPENPAGERANK_API_KEY,
  ),
  keywordsEverywhereKey: first(process.env.KEYWORDS_EVERYWHERE_API_KEY),
  pageSpeedKey: first(process.env.PAGESPEED_API_KEY, process.env.GOOGLE_API_KEY),
  companiesHouseKey: first(process.env.COMPANIES_HOUSE_API_KEY),
  serpApiKey: first(process.env.SERP_API_KEY, process.env.SERPAPI_KEY),
  commonCrawlIndex: first(process.env.COMMON_CRAWL_INDEX, "CC-MAIN-2026-17"),
  crawlDelayMs: Number(process.env.CRAWL_DELAY_MS || 500),
  maxPagesPerDomain: Number(process.env.MAX_PAGES_PER_DOMAIN || 200),
  continuousLoopSleepMs: Number(process.env.CONTINUOUS_LOOP_SLEEP_MS || 60000),
  continuousFirmBatch: Number(process.env.CONTINUOUS_FIRM_BATCH || 5),
  // Keywords only when explicitly enabled OR Keywords Everywhere key is present
  collectKeywords:
    String(process.env.COLLECT_KEYWORDS || "").toLowerCase() === "true" ||
    Boolean(first(process.env.KEYWORDS_EVERYWHERE_API_KEY)),
  userAgent:
    process.env.USER_AGENT ||
    "TaxoToolsBot/1.0 (+https://taxotools.com)",
  // Render/Railway inject PORT; fall back to BACKEND_PORT for local
  port: Number(process.env.PORT || process.env.BACKEND_PORT || 3200),
  databaseUrl: first(process.env.DIRECT_URL, process.env.DATABASE_URL),
};

export function assertSupabase() {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL)",
    );
  }
}
