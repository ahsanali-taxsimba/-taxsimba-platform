import { getSupabase } from "../supabase/client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger } from "../utils/logger.js";
import { updateAuthorityForDomains } from "./openPageRank.js";
import { listReferringDomainsForAccountant, refreshReferringDomainCounts } from "../supabase/updateAuthority.js";

const log = logger("scoring");

/**
 * Classic TaxoTools-style score for a single link row (optional analytics).
 * (authority * relevance) - (spam * risk) — relevance/spam estimated from link_type.
 */
export function scoreBacklinkRow({ authority = 40, link_type = "dofollow" }) {
  const relevance = link_type === "dofollow" ? 0.8 : link_type === "sponsored" ? 0.4 : 0.5;
  const spam = link_type === "nofollow" ? 15 : link_type === "sponsored" ? 25 : 8;
  const risk = link_type === "sponsored" ? 0.3 : 0.1;
  return authority * relevance - (spam / 100) * risk * 100;
}

export async function scoreReferringDomainsForAccountant(accountantDomain) {
  const d = normalizeDomain(accountantDomain);
  await refreshReferringDomainCounts(d);
  const refs = await listReferringDomainsForAccountant(d, { limit: 100 });
  const domains = refs.map((r) => r.domain);
  if (!domains.length) {
    // still score empty set no-op
    return { domain: d, updated: 0 };
  }
  const updated = await updateAuthorityForDomains(domains);
  log.info(`scored referring domains for ${d}`, { updated: updated.length });
  return { domain: d, updated: updated.length };
}

export async function scoreAllReferringDomains({ limit = 500 } = {}) {
  const { data, error } = await getSupabase()
    .from("referring_domains")
    .select("domain")
    .order("last_updated", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const domains = (data || []).map((d) => d.domain);
  const updated = await updateAuthorityForDomains(domains);
  return { requested: domains.length, updated: updated.length };
}

if (process.argv[1]?.endsWith("backlinkScoring.js")) {
  scoreAllReferringDomains()
    .then((r) => {
      console.log(r);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
