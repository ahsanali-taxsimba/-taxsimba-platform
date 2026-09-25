import { getSupabase } from "./client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger } from "../utils/logger.js";

const log = logger("insertDomain");

export async function upsertAccountancyFirm(firm) {
  const domain = normalizeDomain(firm.domain);
  if (!domain) return null;

  // Never store firms without a real website
  if (
    domain.includes(".companieshouse.pending") ||
    firm.crawl_status === "needs_website" ||
    firm.website_verified === false
  ) {
    log.info("Ignoring firm without live website", {
      domain,
      company: firm.company_name || firm.companyName,
    });
    return null;
  }

  const row = {
    domain,
    company_name: firm.company_name || firm.companyName || domain,
    location: firm.location || null,
    sic_code: firm.sic_code || firm.sicCode || null,
    website_url: firm.website_url || firm.websiteUrl || `https://${domain}`,
    source: firm.source || "discovery",
    website_verified: firm.website_verified != null ? Boolean(firm.website_verified) : true,
    updated_at: new Date().toISOString(),
  };
  if (firm.company_number != null) row.company_number = firm.company_number;
  if (firm.crawl_status != null) row.crawl_status = firm.crawl_status;

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

/**
 * List firms for crawling — skip placeholders / unreachable / superseded.
 */
export async function listAccountancyFirms({
  limit = 500,
  location,
  preferStale = true,
  crawlableOnly = true,
} = {}) {
  let q = getSupabase().from("accountancy_firms").select("*").limit(limit);

  if (crawlableOnly) {
    q = q
      .eq("website_verified", true)
      .not("domain", "like", "%.companieshouse.pending")
      .not("crawl_status", "in", "(unreachable,superseded,needs_website)");
  }

  if (preferStale) q = q.order("last_crawled_at", { ascending: true, nullsFirst: true });
  else q = q.order("discovered_at", { ascending: false });
  if (location) q = q.ilike("location", `%${location}%`);

  const { data, error } = await q;
  if (error) {
    // Fallback for older schemas / filter issues
    const fb = await getSupabase()
      .from("accountancy_firms")
      .select("*")
      .order("discovered_at", { ascending: false })
      .limit(limit);
    if (fb.error) throw error;
    return (fb.data || []).filter((f) => !String(f.domain).includes(".companieshouse.pending"));
  }
  return data || [];
}

export async function markFirmStatus(domain, crawl_status, extra = {}) {
  const host = normalizeDomain(domain);
  const { error } = await getSupabase()
    .from("accountancy_firms")
    .update({ crawl_status, updated_at: new Date().toISOString(), ...extra })
    .eq("domain", host);
  if (error) log.warn("mark status failed", { domain: host, error: error.message });
}

export async function getCoverageStats() {
  const sb = getSupabase();
  const { count: total } = await sb.from("accountancy_firms").select("id", { count: "exact", head: true });
  const { count: verified } = await sb
    .from("accountancy_firms")
    .select("id", { count: "exact", head: true })
    .eq("website_verified", true);
  const { count: crawled } = await sb
    .from("accountancy_firms")
    .select("id", { count: "exact", head: true })
    .eq("crawl_status", "completed");
  const { count: pending } = await sb
    .from("accountancy_firms")
    .select("id", { count: "exact", head: true })
    .in("crawl_status", ["pending", "running"]);
  const { count: needsWebsite } = await sb
    .from("accountancy_firms")
    .select("id", { count: "exact", head: true })
    .eq("crawl_status", "needs_website");
  const { count: seoPages } = await sb.from("seo_data").select("id", { count: "exact", head: true });
  const { count: backlinks } = await sb.from("backlinks").select("id", { count: "exact", head: true });
  const { count: keywords } = await sb.from("keyword_data").select("id", { count: "exact", head: true });
  const { count: geo } = await sb.from("geo_data").select("id", { count: "exact", head: true });

  return {
    firms_total: total || 0,
    firms_verified_website: verified || 0,
    firms_crawled: crawled || 0,
    firms_pending_crawl: pending || 0,
    firms_needs_website: needsWebsite || 0,
    seo_pages: seoPages || 0,
    backlinks: backlinks || 0,
    keywords: keywords || 0,
    geo_profiles: geo || 0,
    coverage_pct:
      total > 0 ? Math.round(((crawled || 0) / Math.max(verified || total || 1, 1)) * 1000) / 10 : 0,
  };
}
