import { getSupabase } from "../supabase/client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { upsertCompetitorProfile } from "../supabase/insertIntelligence.js";
import { logger } from "../utils/logger.js";

const log = logger("competitors");

async function countBacklinks(domain) {
  const { count } = await getSupabase()
    .from("backlinks")
    .select("id", { count: "exact", head: true })
    .eq("accountant_domain", domain);
  return count || 0;
}

async function authority(domain) {
  const { data: firm } = await getSupabase()
    .from("accountancy_firms")
    .select("authority_score")
    .eq("domain", domain)
    .maybeSingle();
  if (firm?.authority_score) return firm.authority_score;
  const { data: rd } = await getSupabase()
    .from("referring_domains")
    .select("authority_score")
    .eq("domain", domain)
    .maybeSingle();
  return rd?.authority_score || 0;
}

async function referringSet(domain) {
  const { data } = await getSupabase()
    .from("backlinks")
    .select("referring_domain")
    .eq("accountant_domain", domain)
    .limit(2000);
  return new Set((data || []).map((r) => r.referring_domain).filter(Boolean));
}

async function keywordSet(domain) {
  const { data } = await getSupabase()
    .from("keyword_data")
    .select("keyword")
    .eq("domain", domain)
    .limit(500);
  return new Set((data || []).map((r) => r.keyword).filter(Boolean));
}

/**
 * Compare an accountant against others in the same city (or nearby firms).
 */
export async function buildCompetitorProfiles(domain, { limit = 8 } = {}) {
  const host = normalizeDomain(domain);
  const { data: geo } = await getSupabase().from("geo_data").select("*").eq("domain", host).maybeSingle();
  const city = geo?.city || null;

  let competitors = [];
  if (city) {
    const { data } = await getSupabase()
      .from("geo_data")
      .select("domain, city")
      .eq("city", city)
      .neq("domain", host)
      .limit(limit);
    competitors = data || [];
  }
  if (!competitors.length) {
    const { data } = await getSupabase()
      .from("accountancy_firms")
      .select("domain, location")
      .neq("domain", host)
      .limit(limit);
    competitors = (data || []).map((d) => ({ domain: d.domain, city: d.location || null }));
  }

  const selfBacklinks = await countBacklinks(host);
  const selfAuth = await authority(host);
  const selfRefs = await referringSet(host);
  const selfKws = await keywordSet(host);
  const profiles = [];

  for (const c of competitors) {
    const cd = normalizeDomain(c.domain);
    const [cb, ca, cref, ckw] = await Promise.all([
      countBacklinks(cd),
      authority(cd),
      referringSet(cd),
      keywordSet(cd),
    ]);
    let overlap = 0;
    for (const r of selfRefs) if (cref.has(r)) overlap += 1;
    let kwOverlap = 0;
    for (const k of selfKws) if (ckw.has(k)) kwOverlap += 1;
    const gap = [...cref].filter((r) => !selfRefs.has(r)).slice(0, 25);

    const row = {
      domain: host,
      competitor_domain: cd,
      city: c.city || city,
      self_backlinks: selfBacklinks,
      competitor_backlinks: cb,
      overlap_referring_domains: overlap,
      self_authority: selfAuth,
      competitor_authority: ca,
      keyword_overlap: kwOverlap,
      gap_domains: gap,
    };
    await upsertCompetitorProfile(row);
    profiles.push(row);
  }

  log.info(`competitor profiles for ${host}`, { count: profiles.length, city });
  return profiles;
}
