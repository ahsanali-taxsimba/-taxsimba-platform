import { getSupabase } from "./client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger } from "../utils/logger.js";

const log = logger("insertDomain");

export async function upsertAccountancyFirm(firm) {
  const domain = normalizeDomain(firm.domain);
  if (!domain) return null;

  const row = {
    domain,
    company_name: firm.company_name || firm.companyName || domain,
    location: firm.location || null,
    sic_code: firm.sic_code || firm.sicCode || null,
    website_url: firm.website_url || firm.websiteUrl || `https://${domain}`,
    source: firm.source || "discovery",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabase()
    .from("accountancy_firms")
    .upsert(row, { onConflict: "domain" })
    .select()
    .maybeSingle();

  if (error) {
    log.warn("upsert firm failed", { domain, error: error.message });
    return null;
  }
  return data;
}

export async function listAccountancyFirms({ limit = 500, location } = {}) {
  let q = getSupabase().from("accountancy_firms").select("*").order("discovered_at", { ascending: false }).limit(limit);
  if (location) q = q.ilike("location", `%${location}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
