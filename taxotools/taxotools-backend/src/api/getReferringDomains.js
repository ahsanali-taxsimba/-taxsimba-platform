import { listReferringDomainsForAccountant } from "../supabase/updateAuthority.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";

export async function getReferringDomainsHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    if (!domain) return res.status(400).json({ error: "domain required" });
    const rows = await listReferringDomainsForAccountant(domain, {
      limit: Number(req.query.limit || 200),
    });
    res.json({ domain, count: rows.length, referring_domains: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
