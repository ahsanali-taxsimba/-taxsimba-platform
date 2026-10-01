import { getSupabase } from "./client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger } from "../utils/logger.js";

const log = logger("updateAuthority");

export async function upsertReferringDomain({ domain, authority_score, backlink_count }) {
  const d = normalizeDomain(domain);
  if (!d) return null;
  const row = {
    domain: d,
    authority_score: Math.round(authority_score ?? 0),
    backlink_count: backlink_count ?? 0,
    last_updated: new Date().toISOString(),
  };
  const { data, error } = await getSupabase()
    .from("referring_domains")
    .upsert(row, { onConflict: "domain" })
    .select()
    .maybeSingle();
  if (error) {
    log.warn("upsert referring domain failed", { domain: d, error: error.message });
    return null;
  }
  return data;
}

export async function refreshReferringDomainCounts(accountantDomain) {
  const d = normalizeDomain(accountantDomain);
  const { data: links, error } = await getSupabase()
    .from("backlinks")
    .select("referring_domain")
    .eq("accountant_domain", d)
    .neq("link_type", "lost");
  if (error) throw error;

  const counts = new Map();
  for (const l of links || []) {
    const rd = normalizeDomain(l.referring_domain);
    if (!rd) continue;
    counts.set(rd, (counts.get(rd) || 0) + 1);
  }

  for (const [domain, backlink_count] of counts.entries()) {
    const { data: existing } = await getSupabase()
      .from("referring_domains")
      .select("authority_score")
      .eq("domain", domain)
      .maybeSingle();
    await upsertReferringDomain({
      domain,
      backlink_count,
      authority_score: existing?.authority_score ?? 0,
    });
  }
  return counts.size;
}

export async function listReferringDomainsForAccountant(domain, { limit = 200 } = {}) {
  const links = await getSupabase()
    .from("backlinks")
    .select("referring_domain")
    .eq("accountant_domain", normalizeDomain(domain))
    .neq("link_type", "lost");
  if (links.error) throw links.error;
  const domains = [
    ...new Set((links.data || []).map((l) => normalizeDomain(l.referring_domain)).filter(Boolean)),
  ];
  if (!domains.length) return [];
  const { data, error } = await getSupabase()
    .from("referring_domains")
    .select("*")
    .in("domain", domains.slice(0, limit))
    .order("authority_score", { ascending: false });
  if (error) throw error;
  return data || [];
}
