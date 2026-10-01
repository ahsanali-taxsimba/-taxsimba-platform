import { getSupabase } from "./client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger } from "../utils/logger.js";

const log = logger("insertIntel");

export async function upsertSeoData(row) {
  const domain = normalizeDomain(row.domain);
  const { error } = await getSupabase()
    .from("seo_data")
    .upsert({ ...row, domain }, { onConflict: "domain,page_url" });
  if (error) log.warn("seo upsert failed", { error: error.message, url: row.page_url });
}

export async function upsertAeoData(row) {
  const domain = normalizeDomain(row.domain);
  const { error } = await getSupabase()
    .from("aeo_data")
    .upsert({ ...row, domain }, { onConflict: "domain,page_url" });
  if (error) log.warn("aeo upsert failed", { error: error.message });
}

export async function upsertGeoData(row) {
  const domain = normalizeDomain(row.domain);
  if (!domain) return;
  // Don't overwrite richer data with empty nulls
  const { data: existing } = await getSupabase()
    .from("geo_data")
    .select("*")
    .eq("domain", domain)
    .maybeSingle();
  const merged = {
    domain,
    business_name: row.business_name || existing?.business_name || null,
    address: row.address || existing?.address || null,
    city: row.city || existing?.city || null,
    region: row.region || existing?.region || null,
    postcode: row.postcode || existing?.postcode || null,
    country: row.country || existing?.country || "GB",
    latitude: row.latitude ?? existing?.latitude ?? null,
    longitude: row.longitude ?? existing?.longitude ?? null,
    phone: row.phone || existing?.phone || null,
    local_signals: row.local_signals || existing?.local_signals || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getSupabase().from("geo_data").upsert(merged, { onConflict: "domain" });
  if (error) log.warn("geo upsert failed", { error: error.message, domain });
}

export async function upsertKeywordRows(rows) {
  if (!rows?.length) return 0;
  const { error } = await getSupabase().from("keyword_data").upsert(rows, {
    onConflict: "domain,keyword",
  });
  if (error) {
    log.warn("keyword upsert failed", { error: error.message });
    return 0;
  }
  return rows.length;
}

export async function upsertCompetitorProfile(row) {
  const { error } = await getSupabase()
    .from("competitor_profiles")
    .upsert(
      {
        ...row,
        domain: normalizeDomain(row.domain),
        competitor_domain: normalizeDomain(row.competitor_domain),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain,competitor_domain" },
    );
  if (error) log.warn("competitor upsert failed", { error: error.message });
}

export async function heartbeatCrawler(patch = {}) {
  const { error } = await getSupabase()
    .from("crawler_control")
    .upsert(
      {
        id: "uk-accountancy",
        last_heartbeat_at: new Date().toISOString(),
        ...patch,
      },
      { onConflict: "id" },
    );
  if (error) log.warn("heartbeat failed", { error: error.message });
}

export async function getCrawlerControl() {
  const { data } = await getSupabase()
    .from("crawler_control")
    .select("*")
    .eq("id", "uk-accountancy")
    .maybeSingle();
  return data;
}
