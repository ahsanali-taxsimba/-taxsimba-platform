import { getBacklinksForDomain } from "../supabase/insertBacklink.js";
import { listReferringDomainsForAccountant } from "../supabase/updateAuthority.js";
import { getSupabase } from "../supabase/client.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";

export async function getBacklinksHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    if (!domain) return res.status(400).json({ error: "domain required" });
    const links = await getBacklinksForDomain(domain, { limit: Number(req.query.limit || 200) });
    const refs = await listReferringDomainsForAccountant(domain);
    const byDomain = new Map(refs.map((r) => [r.domain, r]));
    const enriched = links.map((l) => ({
      ...l,
      authority_score: byDomain.get(normalizeDomain(l.referring_domain))?.authority_score ?? null,
    }));
    res.json({ domain, count: enriched.length, backlinks: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
