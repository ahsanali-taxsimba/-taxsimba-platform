import { getSupabase } from "./client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";

export async function writeCrawlLog({ domain, status, pages_crawled = 0, errors = null }) {
  const row = {
    domain: normalizeDomain(domain),
    status,
    pages_crawled,
    errors: errors ? String(errors).slice(0, 4000) : null,
    crawl_date: new Date().toISOString(),
  };
  const { data, error } = await getSupabase().from("crawl_logs").insert(row).select().maybeSingle();
  if (error) throw error;
  return data;
}
