import { normalizeDomain } from "../utils/normalizeDomain.js";
import { getSupabase } from "../supabase/client.js";
import { getBacklinksForDomain } from "../supabase/insertBacklink.js";
import { listReferringDomainsForAccountant } from "../supabase/updateAuthority.js";

const SOCIAL_NOISE =
  /facebook\.|instagram\.|twitter\.|x\.com|linkedin\.|youtube\.|tiktok\.|pinterest\.|whatsapp\./i;

/**
 * Core product payload for one UK accountancy firm:
 * firm + GEO + SEO basics + AEO + technical + backlinks/authority + competitors.
 * Keywords intentionally omitted from the primary response.
 */
export async function getFirmCoreHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    if (!domain) return res.status(400).json({ error: "domain required" });

    const sb = getSupabase();
    const [
      { data: firm },
      { data: geo },
      { data: seoPages },
      { data: aeoRows },
      { data: competitors },
      backlinks,
      referring,
    ] = await Promise.all([
      sb.from("accountancy_firms").select("*").eq("domain", domain).maybeSingle(),
      sb.from("geo_data").select("*").eq("domain", domain).maybeSingle(),
      sb
        .from("seo_data")
        .select(
          "page_url,title,meta_description,h1,h2,h3,canonical,schema_types,http_status,redirect_chain,broken_links,page_depth,word_count,internal_links,external_links,crawled_at",
        )
        .eq("domain", domain)
        .order("page_depth", { ascending: true })
        .limit(Number(req.query.seoLimit || 20)),
      sb
        .from("aeo_data")
        .select(
          "page_url,has_faq_schema,has_qa_schema,has_local_business_schema,faq_items,featured_snippet_candidates,updated_at",
        )
        .eq("domain", domain)
        .order("updated_at", { ascending: false })
        .limit(10),
      sb
        .from("competitor_profiles")
        .select(
          "competitor_domain,city,self_backlinks,competitor_backlinks,overlap_referring_domains,self_authority,competitor_authority,updated_at",
        )
        .eq("domain", domain)
        .order("competitor_backlinks", { ascending: false })
        .limit(Number(req.query.competitorLimit || 10)),
      getBacklinksForDomain(domain, { limit: Number(req.query.backlinkLimit || 100) }),
      listReferringDomainsForAccountant(domain),
    ]);

    const byAuth = new Map((referring || []).map((r) => [normalizeDomain(r.domain), r]));
    const includeNoise = req.query.includeSocial === "1";
    const enrichedBacklinks = (backlinks || [])
      .filter((l) => includeNoise || !SOCIAL_NOISE.test(String(l.target_url || "")))
      .map((l) => ({
        source_url: l.source_url,
        target_url: l.target_url,
        anchor_text: l.anchor_text,
        referring_domain: l.referring_domain,
        link_type: l.link_type,
        direction: l.direction,
        first_seen: l.first_seen,
        last_seen: l.last_seen,
        authority_score:
          byAuth.get(normalizeDomain(l.referring_domain))?.authority_score ??
          l.authority_score ??
          null,
      }));

    const homepage = (seoPages || []).find((p) => {
      try {
        const path = new URL(p.page_url).pathname;
        return path === "/" || path === "";
      } catch {
        return false;
      }
    }) || (seoPages || [])[0] || null;

    const technical = {
      pages_crawled: (seoPages || []).length,
      status_codes: [...new Set((seoPages || []).map((p) => p.http_status).filter(Boolean))],
      max_depth: Math.max(0, ...(seoPages || []).map((p) => p.page_depth || 0)),
      pages_with_redirects: (seoPages || []).filter((p) => (p.redirect_chain || []).length > 0)
        .length,
      broken_link_mentions: (seoPages || []).reduce((n, p) => n + (p.broken_links || 0), 0),
    };

    const aeoSummary = {
      has_faq_schema: (aeoRows || []).some((a) => a.has_faq_schema),
      has_local_business_schema: (aeoRows || []).some((a) => a.has_local_business_schema),
      has_qa_schema: (aeoRows || []).some((a) => a.has_qa_schema),
      pages: aeoRows || [],
    };

    res.json({
      ok: true,
      product_focus: [
        "firm",
        "geo",
        "seo",
        "aeo",
        "technical",
        "backlinks",
        "referring_domains",
        "competitors",
      ],
      domain,
      firm: firm || null,
      geo: geo || null,
      seo: {
        homepage: homepage
          ? {
              page_url: homepage.page_url,
              title: homepage.title,
              meta_description: homepage.meta_description,
              h1: homepage.h1,
              h2: homepage.h2,
              schema_types: homepage.schema_types,
              canonical: homepage.canonical,
              http_status: homepage.http_status,
            }
          : null,
        pages: seoPages || [],
      },
      aeo: aeoSummary,
      technical,
      backlinks: {
        count: enrichedBacklinks.length,
        items: enrichedBacklinks,
      },
      referring_domains: {
        count: (referring || []).length,
        items: referring || [],
      },
      competitors: {
        count: (competitors || []).length,
        items: competitors || [],
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
