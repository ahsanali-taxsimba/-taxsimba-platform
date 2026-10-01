import { getSupabase } from "./client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger } from "../utils/logger.js";

const log = logger("insertBacklink");

export async function upsertBacklink(link) {
  const accountant_domain = normalizeDomain(link.accountant_domain || link.accountantDomain);
  if (!accountant_domain || !link.source_url || !link.target_url) return null;

  const referring_domain = normalizeDomain(
    link.referring_domain || link.referringDomain || (() => {
      try {
        return new URL(link.source_url).hostname;
      } catch {
        return "";
      }
    })(),
  );

  const now = new Date().toISOString();
  const row = {
    source_url: link.source_url,
    target_url: link.target_url,
    anchor_text: link.anchor_text || link.anchorText || null,
    referring_domain: referring_domain || null,
    link_type: link.link_type || link.linkType || "dofollow",
    last_seen: now,
    crawl_date: now,
    accountant_domain,
    direction: link.direction || "outbound",
  };

  // Upsert on unique (source_url, target_url, accountant_domain)
  const { data: existing } = await getSupabase()
    .from("backlinks")
    .select("id, first_seen")
    .eq("source_url", row.source_url)
    .eq("target_url", row.target_url)
    .eq("accountant_domain", accountant_domain)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await getSupabase()
      .from("backlinks")
      .update({
        anchor_text: row.anchor_text,
        referring_domain: row.referring_domain,
        link_type: row.link_type === "lost" ? "dofollow" : row.link_type,
        last_seen: now,
        crawl_date: now,
        direction: row.direction,
      })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) {
      log.warn("update backlink failed", { error: error.message });
      return null;
    }
    return data;
  }

  const { data, error } = await getSupabase()
    .from("backlinks")
    .insert({ ...row, first_seen: now })
    .select()
    .maybeSingle();

  if (error) {
    log.warn("insert backlink failed", { error: error.message });
    return null;
  }
  return data;
}

export async function markLostBacklinks(accountantDomain, beforeIso) {
  const { data, error } = await getSupabase()
    .from("backlinks")
    .update({ link_type: "lost" })
    .eq("accountant_domain", normalizeDomain(accountantDomain))
    .lt("last_seen", beforeIso)
    .neq("link_type", "lost")
    .select("id");
  if (error) {
    log.warn("mark lost failed", { error: error.message });
    return 0;
  }
  return data?.length || 0;
}

export async function getBacklinksForDomain(domain, { limit = 200 } = {}) {
  const d = normalizeDomain(domain);
  const { data, error } = await getSupabase()
    .from("backlinks")
    .select("*")
    .eq("accountant_domain", d)
    .order("last_seen", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
