import { listAccountancyFirms } from "../supabase/insertDomain.js";
import { getBacklinksForDomain } from "../supabase/insertBacklink.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";

/**
 * Compare backlinks with other accountants in the same city/location.
 */
export async function competitorBacklinksHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    if (!domain) return res.status(400).json({ error: "domain required" });

    const firms = await listAccountancyFirms({ limit: 500 });
    const self = firms.find((f) => f.domain === domain);
    if (!self) return res.status(404).json({ error: "accountant domain not found" });

    const location = self.location || "";
    const competitors = firms
      .filter((f) => f.domain !== domain)
      .filter((f) => !location || (f.location || "").toLowerCase().includes(String(location).toLowerCase()))
      .slice(0, 8);

    const selfLinks = await getBacklinksForDomain(domain, { limit: 500 });
    const selfRefs = new Set(
      selfLinks.map((l) => normalizeDomain(l.referring_domain)).filter(Boolean),
    );

    const comparison = [];
    for (const c of competitors) {
      const links = await getBacklinksForDomain(c.domain, { limit: 300 });
      const refs = new Set(links.map((l) => normalizeDomain(l.referring_domain)).filter(Boolean));
      const overlap = [...refs].filter((r) => selfRefs.has(r));
      const onlyCompetitor = [...refs].filter((r) => !selfRefs.has(r));
      comparison.push({
        competitor: c.domain,
        company_name: c.company_name,
        location: c.location,
        backlinks: links.length,
        referring_domains: refs.size,
        overlap_count: overlap.length,
        gap_opportunities: onlyCompetitor.slice(0, 25),
      });
    }

    res.json({
      domain,
      location: self.location,
      self_backlinks: selfLinks.length,
      self_referring_domains: selfRefs.size,
      competitors: comparison,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
