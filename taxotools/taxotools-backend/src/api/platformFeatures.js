import { normalizeDomain } from "../utils/normalizeDomain.js";
import { getSupabase } from "../supabase/client.js";
import { getBacklinksForDomain } from "../supabase/insertBacklink.js";
import { listReferringDomainsForAccountant } from "../supabase/updateAuthority.js";

const SERVICE_PATHS = [
  { key: "vat", patterns: [/vat/i] },
  { key: "payroll", patterns: [/payroll/i] },
  { key: "cis", patterns: [/cis/i] },
  { key: "bookkeeping", patterns: [/bookkeep/i] },
  { key: "tax", patterns: [/tax|corporation.?tax|self.?assessment/i] },
  { key: "audit", patterns: [/audit/i] },
  { key: "cloud", patterns: [/xero|quickbooks|sage|cloud/i] },
  { key: "contact", patterns: [/contact/i] },
  { key: "about", patterns: [/about/i] },
  { key: "services", patterns: [/service/i] },
];

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function homepageOf(pages) {
  return (
    (pages || []).find((p) => {
      try {
        const path = new URL(p.page_url).pathname;
        return path === "/" || path === "";
      } catch {
        return false;
      }
    }) ||
    (pages || [])[0] ||
    null
  );
}

function detectServices(pages) {
  const blob = (pages || [])
    .map((p) => `${p.page_url || ""} ${p.title || ""} ${p.h1 || ""} ${(p.h2 || []).join(" ")}`)
    .join(" | ");
  const found = {};
  for (const s of SERVICE_PATHS) {
    found[s.key] = s.patterns.some((re) => re.test(blob));
  }
  return found;
}

export async function loadFirmBundle(domain) {
  const host = normalizeDomain(domain);
  const sb = getSupabase();
  const [
    { data: firm },
    { data: geo },
    { data: seoPages },
    { data: aeoRows },
    { data: competitors },
    { data: logs },
    backlinks,
    referring,
  ] = await Promise.all([
    sb.from("accountancy_firms").select("*").eq("domain", host).maybeSingle(),
    sb.from("geo_data").select("*").eq("domain", host).maybeSingle(),
    sb
      .from("seo_data")
      .select(
        "page_url,title,meta_description,h1,h2,h3,canonical,schema_types,http_status,broken_links,page_depth,word_count,crawled_at",
      )
      .eq("domain", host)
      .order("page_depth", { ascending: true })
      .limit(80),
    sb.from("aeo_data").select("*").eq("domain", host).limit(20),
    sb
      .from("competitor_profiles")
      .select("*")
      .eq("domain", host)
      .order("competitor_backlinks", { ascending: false })
      .limit(20),
    sb
      .from("crawl_logs")
      .select("*")
      .eq("domain", host)
      .order("crawl_date", { ascending: false })
      .limit(20),
    getBacklinksForDomain(host, { limit: 500 }),
    listReferringDomainsForAccountant(host),
  ]);
  return {
    domain: host,
    firm,
    geo,
    seoPages: seoPages || [],
    aeoRows: aeoRows || [],
    competitors: competitors || [],
    logs: logs || [],
    backlinks: backlinks || [],
    referring: referring || [],
  };
}

export function buildLocalPackChecklist(bundle) {
  const { firm, geo, seoPages, aeoRows } = bundle;
  const home = homepageOf(seoPages);
  const schema = [
    ...(home?.schema_types || []),
    ...aeoRows.flatMap((a) => [
      a.has_local_business_schema ? "LocalBusiness" : null,
      a.has_faq_schema ? "FAQPage" : null,
    ]),
  ].filter(Boolean);
  const checks = {
    has_website: Boolean(firm?.website_verified || firm?.website_url),
    has_title: Boolean(home?.title),
    has_meta_description: Boolean(home?.meta_description),
    has_h1: Boolean(home?.h1),
    has_phone: Boolean(geo?.phone),
    has_address: Boolean(geo?.address || geo?.postcode),
    has_city_or_postcode: Boolean(geo?.city || geo?.postcode || firm?.location),
    has_local_schema: schema.some((s) => /LocalBusiness|Organization|PostalAddress/i.test(String(s))),
    has_contact_page: (seoPages || []).some((p) => /contact/i.test(p.page_url || "")),
    https_ok: (seoPages || []).every((p) => !p.http_status || p.http_status < 400),
  };
  const score = clamp(
    (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100,
  );
  return { score, checks };
}

export function buildScorecard(bundle) {
  const { firm, geo, seoPages, aeoRows, competitors, backlinks, referring } = bundle;
  const home = homepageOf(seoPages);
  const local = buildLocalPackChecklist(bundle);
  const services = detectServices(seoPages);

  const authority =
    Number(firm?.authority_score) ||
    Math.max(0, ...referring.map((r) => Number(r.authority_score) || 0), 0);
  const refCount = referring.length || new Set(backlinks.map((b) => b.referring_domain)).size;
  const blCount = backlinks.length;

  const authorityScore = clamp(Math.log10(1 + refCount) * 28 + Math.min(authority, 40) + Math.min(blCount / 10, 20));
  const seoScore = clamp(
    (home?.title ? 20 : 0) +
      (home?.meta_description ? 15 : 0) +
      (home?.h1 ? 15 : 0) +
      Math.min((seoPages || []).length * 3, 25) +
      ((home?.schema_types || []).length ? 15 : 0) +
      (seoPages.every((p) => !p.http_status || p.http_status < 400) ? 10 : 0),
  );
  const geoScore = clamp(
    (geo?.phone ? 25 : 0) +
      (geo?.address || geo?.postcode ? 25 : 0) +
      (geo?.city || firm?.location ? 20 : 0) +
      (local.checks.has_local_schema ? 20 : 0) +
      (local.checks.has_contact_page ? 10 : 0),
  );
  const aeoScore = clamp(
    (aeoRows.some((a) => a.has_faq_schema) ? 35 : 0) +
      (aeoRows.some((a) => a.has_local_business_schema) ? 35 : 0) +
      (aeoRows.some((a) => a.has_qa_schema) ? 15 : 0) +
      Math.min((aeoRows.flatMap((a) => a.faq_items || []).length || 0) * 3, 15),
  );
  const techScore = clamp(
    100 -
      Math.min(
        (seoPages || []).reduce((n, p) => n + (p.broken_links || 0), 0) * 5,
        40,
      ) -
      ((seoPages || []).some((p) => p.http_status >= 400) ? 20 : 0) +
      Math.min((seoPages || []).length, 20),
  );
  const competitorScore = clamp(Math.min((competitors || []).length * 12, 60) + (refCount > 5 ? 20 : 0) + 20);

  const overall = clamp(
    authorityScore * 0.28 +
      seoScore * 0.22 +
      geoScore * 0.18 +
      aeoScore * 0.12 +
      techScore * 0.1 +
      competitorScore * 0.1,
  );

  const reasons = [];
  if (!home?.title) reasons.push("Missing homepage title");
  if (!geo?.phone) reasons.push("No phone found");
  if (!local.checks.has_local_schema) reasons.push("No LocalBusiness/Organization schema");
  if (!aeoRows.some((a) => a.has_faq_schema)) reasons.push("No FAQ schema (AEO gap)");
  if (refCount < 5) reasons.push("Low referring-domain count");
  if (!services.vat) reasons.push("No clear VAT service page signal");

  return {
    domain: bundle.domain,
    company_name: firm?.company_name || bundle.domain,
    location: firm?.location || geo?.city || null,
    crawl_status: firm?.crawl_status || null,
    overall_score: overall,
    scores: {
      authority: authorityScore,
      seo: seoScore,
      geo: geoScore,
      aeo: aeoScore,
      technical: techScore,
      competitive: competitorScore,
      local_pack: local.score,
    },
    metrics: {
      pages_crawled: (seoPages || []).length,
      backlinks: blCount,
      referring_domains: refCount,
      competitors: (competitors || []).length,
      authority_score: authority,
      phone: geo?.phone || null,
      postcode: geo?.postcode || null,
    },
    local_pack: local,
    services,
    opportunity_flags: reasons,
  };
}

export async function scorecardHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    if (!domain) return res.status(400).json({ error: "domain required" });
    const bundle = await loadFirmBundle(domain);
    if (!bundle.firm) return res.status(404).json({ error: "firm not found" });
    res.json({ ok: true, scorecard: buildScorecard(bundle) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function battleCardHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    if (!domain) return res.status(400).json({ error: "domain required" });
    const bundle = await loadFirmBundle(domain);
    if (!bundle.firm) return res.status(404).json({ error: "firm not found" });
    const selfCard = buildScorecard(bundle);
    const selfRefs = new Set(
      bundle.backlinks.map((l) => normalizeDomain(l.referring_domain)).filter(Boolean),
    );

    const competitorDomains = [
      ...new Set([
        ...(bundle.competitors || []).map((c) => c.competitor_domain),
        ...(await sameCityDomains(bundle.firm, 8)),
      ]),
    ]
      .filter((d) => d && d !== domain)
      .slice(0, 8);

    const rivals = [];
    for (const cd of competitorDomains) {
      const cb = await loadFirmBundle(cd);
      if (!cb.firm) continue;
      const card = buildScorecard(cb);
      const refs = new Set(cb.backlinks.map((l) => normalizeDomain(l.referring_domain)).filter(Boolean));
      const gaps = [...refs].filter((r) => !selfRefs.has(r));
      const selfServices = selfCard.services;
      const theirServices = card.services;
      const content_gaps = Object.keys(theirServices).filter(
        (k) => theirServices[k] && !selfServices[k],
      );
      rivals.push({
        domain: cd,
        company_name: cb.firm.company_name,
        overall_score: card.overall_score,
        scores: card.scores,
        metrics: card.metrics,
        backlink_gaps: gaps.slice(0, 20),
        content_gaps,
        aeo_gaps: {
          they_have_faq: card.local_pack
            ? (cb.aeoRows || []).some((a) => a.has_faq_schema)
            : false,
          you_have_faq: (bundle.aeoRows || []).some((a) => a.has_faq_schema),
        },
      });
    }

    rivals.sort((a, b) => b.overall_score - a.overall_score);

    res.json({
      ok: true,
      domain,
      self: selfCard,
      competitors: rivals,
      summary: {
        rival_count: rivals.length,
        avg_rival_score:
          rivals.length > 0
            ? Math.round(rivals.reduce((s, r) => s + r.overall_score, 0) / rivals.length)
            : null,
        top_backlink_gaps: [
          ...new Set(rivals.flatMap((r) => r.backlink_gaps)),
        ].slice(0, 30),
        top_content_gaps: [...new Set(rivals.flatMap((r) => r.content_gaps))],
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function sameCityDomains(firm, limit = 8) {
  const sb = getSupabase();
  const loc = firm?.location || "";
  let q = sb
    .from("accountancy_firms")
    .select("domain,location")
    .eq("website_verified", true)
    .neq("domain", firm.domain)
    .limit(80);
  if (loc && loc !== "UK") q = q.ilike("location", `%${loc}%`);
  const { data } = await q;
  return (data || []).map((d) => d.domain).slice(0, limit);
}

export async function backlinkGapsHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    if (!domain) return res.status(400).json({ error: "domain required" });
    const bundle = await loadFirmBundle(domain);
    if (!bundle.firm) return res.status(404).json({ error: "firm not found" });
    const selfRefs = new Set(
      bundle.backlinks.map((l) => normalizeDomain(l.referring_domain)).filter(Boolean),
    );
    const comps = [
      ...new Set([
        ...(bundle.competitors || []).map((c) => c.competitor_domain),
        ...(await sameCityDomains(bundle.firm, 10)),
      ]),
    ]
      .filter((d) => d && d !== domain)
      .slice(0, 10);

    const gapMap = new Map();
    for (const cd of comps) {
      const links = await getBacklinksForDomain(cd, { limit: 300 });
      for (const l of links) {
        const rd = normalizeDomain(l.referring_domain);
        if (!rd || selfRefs.has(rd)) continue;
        const cur = gapMap.get(rd) || { referring_domain: rd, linked_competitors: new Set(), examples: [] };
        cur.linked_competitors.add(cd);
        if (cur.examples.length < 3) {
          cur.examples.push({ competitor: cd, source_url: l.source_url, target_url: l.target_url });
        }
        gapMap.set(rd, cur);
      }
    }

    const opportunities = [...gapMap.values()]
      .map((g) => ({
        referring_domain: g.referring_domain,
        competitor_count: g.linked_competitors.size,
        linked_competitors: [...g.linked_competitors],
        examples: g.examples,
      }))
      .sort((a, b) => b.competitor_count - a.competitor_count)
      .slice(0, Number(req.query.limit || 50));

    res.json({
      ok: true,
      domain,
      self_referring_domains: selfRefs.size,
      competitors_compared: comps.length,
      opportunities,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function marketsHandler(req, res) {
  try {
    const city = String(req.query.city || req.query.location || "").trim();
    const limit = Number(req.query.limit || 40);
    const sb = getSupabase();

    // Aggregate from geo_data + firms
    const { data: geos } = await sb.from("geo_data").select("domain,city,postcode,phone,address").limit(3000);
    const { data: firms } = await sb
      .from("accountancy_firms")
      .select("domain,company_name,location,crawl_status,authority_score,website_verified")
      .eq("website_verified", true)
      .limit(3000);

    const geoByDomain = new Map((geos || []).map((g) => [g.domain, g]));

    const markets = new Map();
    for (const f of firms || []) {
      const g = geoByDomain.get(f.domain);
      const key = (g?.city || f.location || "UK").trim() || "UK";
      if (city && !key.toLowerCase().includes(city.toLowerCase())) continue;
      const m = markets.get(key) || {
        market: key,
        firms: 0,
        crawled: 0,
        with_phone: 0,
        with_postcode: 0,
        domains: [],
      };
      m.firms += 1;
      if (f.crawl_status === "completed") m.crawled += 1;
      if (g?.phone) m.with_phone += 1;
      if (g?.postcode) m.with_postcode += 1;
      if (m.domains.length < 12) {
        m.domains.push({
          domain: f.domain,
          company_name: f.company_name,
          authority_score: f.authority_score || 0,
          phone: g?.phone || null,
          postcode: g?.postcode || null,
        });
      }
      markets.set(key, m);
    }

    let list = [...markets.values()].sort((a, b) => b.firms - a.firms);
    if (city) {
      // detail for one market — enrich top firms with scorecards lightly
      const detail = list[0] || {
        market: city,
        firms: 0,
        crawled: 0,
        with_phone: 0,
        with_postcode: 0,
        domains: [],
      };
      const scored = [];
      for (const d of detail.domains.slice(0, Math.min(limit, 15))) {
        const b = await loadFirmBundle(d.domain);
        if (b.firm) scored.push(buildScorecard(b));
      }
      scored.sort((a, b) => b.overall_score - a.overall_score);
      return res.json({
        ok: true,
        market: detail.market,
        stats: {
          firms: detail.firms,
          crawled: detail.crawled,
          with_phone: detail.with_phone,
          with_postcode: detail.with_postcode,
        },
        top_firms: scored,
      });
    }

    res.json({
      ok: true,
      markets: list.slice(0, limit).map(({ domains, ...rest }) => ({
        ...rest,
        sample_domains: domains.slice(0, 5).map((d) => d.domain),
      })),
      total_markets: list.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function leadsHandler(req, res) {
  try {
    const {
      city,
      location,
      missing_schema,
      missing_phone,
      weak_title,
      max_authority,
      crawl_status,
      limit = "50",
      format,
    } = req.query;

    const sb = getSupabase();
    let q = sb
      .from("accountancy_firms")
      .select("*")
      .eq("website_verified", true)
      .order("discovered_at", { ascending: false })
      .limit(Math.min(Number(limit) || 50, 200));
    if (city || location) q = q.ilike("location", `%${city || location}%`);
    if (crawl_status) q = q.eq("crawl_status", String(crawl_status));
    if (max_authority != null && max_authority !== "") {
      q = q.lte("authority_score", Number(max_authority));
    }
    const { data: firms, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    const leads = [];
    for (const f of firms || []) {
      const bundle = await loadFirmBundle(f.domain);
      const card = buildScorecard(bundle);
      if (missing_schema === "1" && card.local_pack.checks.has_local_schema) continue;
      if (missing_phone === "1" && card.metrics.phone) continue;
      if (weak_title === "1" && card.scores.seo >= 50) continue;
      leads.push({
        domain: f.domain,
        company_name: f.company_name,
        location: f.location,
        website_url: f.website_url || `https://${f.domain}`,
        phone: card.metrics.phone,
        postcode: card.metrics.postcode,
        overall_score: card.overall_score,
        seo_score: card.scores.seo,
        geo_score: card.scores.geo,
        authority_score: card.scores.authority,
        opportunity_flags: card.opportunity_flags,
        why: card.opportunity_flags.slice(0, 3).join("; ") || "Crawled firm opportunity",
      });
    }

    leads.sort((a, b) => a.overall_score - b.overall_score);

    if (String(format || "").toLowerCase() === "csv") {
      const header = [
        "domain",
        "company_name",
        "location",
        "website_url",
        "phone",
        "postcode",
        "overall_score",
        "seo_score",
        "geo_score",
        "authority_score",
        "why",
      ];
      const rows = [header.join(",")].concat(
        leads.map((l) =>
          header
            .map((h) => `"${String(l[h] ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="taxotools-leads.csv"');
      return res.send(rows.join("\n"));
    }

    res.json({ ok: true, count: leads.length, leads });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function changesHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    const days = Number(req.query.days || 7);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const sb = getSupabase();

    if (domain) {
      const [{ data: logs }, { data: newLinks }, { data: seo }] = await Promise.all([
        sb
          .from("crawl_logs")
          .select("*")
          .eq("domain", domain)
          .gte("crawl_date", since)
          .order("crawl_date", { ascending: false })
          .limit(50),
        sb
          .from("backlinks")
          .select("source_url,target_url,referring_domain,first_seen,last_seen,link_type")
          .eq("accountant_domain", domain)
          .gte("first_seen", since)
          .limit(100),
        sb
          .from("seo_data")
          .select("page_url,title,h1,crawled_at")
          .eq("domain", domain)
          .gte("crawled_at", since)
          .order("crawled_at", { ascending: false })
          .limit(50),
      ]);
      return res.json({
        ok: true,
        domain,
        since,
        crawl_logs: logs || [],
        new_backlinks: newLinks || [],
        seo_pages_touched: seo || [],
      });
    }

    // Global recent activity
    const [{ data: recentFirms }, { data: recentLogs }] = await Promise.all([
      sb
        .from("accountancy_firms")
        .select("domain,company_name,location,last_crawled_at,crawl_status")
        .gte("last_crawled_at", since)
        .order("last_crawled_at", { ascending: false })
        .limit(50),
      sb
        .from("crawl_logs")
        .select("domain,status,pages_crawled,crawl_date,errors")
        .gte("crawl_date", since)
        .order("crawl_date", { ascending: false })
        .limit(50),
    ]);
    res.json({
      ok: true,
      since,
      recently_crawled_firms: recentFirms || [],
      recent_crawl_logs: recentLogs || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function ukCoverageHandler(_req, res) {
  try {
    const sb = getSupabase();
    const { getCoverageStats } = await import("../supabase/insertDomain.js");
    const coverage = await getCoverageStats();
    const { data: firms } = await sb
      .from("accountancy_firms")
      .select("domain,location,source,crawl_status,website_verified")
      .limit(5000);
    const bySource = {};
    const byLocation = {};
    let verified = 0;
    let crawled = 0;
    for (const f of firms || []) {
      const src = f.source || "unknown";
      bySource[src] = (bySource[src] || 0) + 1;
      const loc = (f.location || "UK").split(",")[0].trim() || "UK";
      byLocation[loc] = byLocation[loc] || { firms: 0, crawled: 0 };
      byLocation[loc].firms += 1;
      if (f.website_verified) verified += 1;
      if (f.crawl_status === "completed") {
        crawled += 1;
        byLocation[loc].crawled += 1;
      }
    }
    const topLocations = Object.entries(byLocation)
      .map(([location, v]) => ({ location, ...v }))
      .sort((a, b) => b.firms - a.firms)
      .slice(0, 40);

    res.json({
      ok: true,
      coverage,
      verified_in_sample: verified,
      crawled_in_sample: crawled,
      by_source: bySource,
      top_locations: topLocations,
      at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function importFirmsHandler(req, res) {
  try {
    const text = req.body?.text || req.body?.list || "";
    if (!text.trim()) return res.status(400).json({ error: "text required (Name — https://site)" });
    const { importFirmList } = await import("../discovery/manualImport.js");
    const r = await importFirmList(text, {
      location: req.body?.location || "UK",
      source: req.body?.source || "api_import",
    });
    res.json({
      ok: true,
      parsed: r.parsed,
      saved: r.saved,
      skippedDead: r.skippedDead,
      domains: r.found.map((f) => f.domain),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function contentGapsHandler(req, res) {
  try {
    const domain = normalizeDomain(req.query.domain || "");
    if (!domain) return res.status(400).json({ error: "domain required" });
    const bundle = await loadFirmBundle(domain);
    if (!bundle.firm) return res.status(404).json({ error: "firm not found" });
    const selfServices = detectServices(bundle.seoPages);
    const comps = [
      ...new Set([
        ...(bundle.competitors || []).map((c) => c.competitor_domain),
        ...(await sameCityDomains(bundle.firm, 8)),
      ]),
    ]
      .filter((d) => d !== domain)
      .slice(0, 8);

    const serviceHits = {};
    for (const key of Object.keys(selfServices)) serviceHits[key] = { you: selfServices[key], competitors: 0 };

    for (const cd of comps) {
      const pages = (
        await getSupabase()
          .from("seo_data")
          .select("page_url,title,h1,h2")
          .eq("domain", cd)
          .limit(40)
      ).data;
      const s = detectServices(pages || []);
      for (const [k, v] of Object.entries(s)) {
        if (v) serviceHits[k].competitors += 1;
      }
    }

    const gaps = Object.entries(serviceHits)
      .filter(([, v]) => !v.you && v.competitors > 0)
      .map(([service, v]) => ({
        service,
        competitors_with_signal: v.competitors,
        recommendation: `Add a clear ${service} page — ${v.competitors}/${comps.length} local rivals show this signal`,
      }))
      .sort((a, b) => b.competitors_with_signal - a.competitors_with_signal);

    const aeoGaps = {
      missing_faq_schema: !(bundle.aeoRows || []).some((a) => a.has_faq_schema),
      missing_local_business_schema: !(bundle.aeoRows || []).some((a) => a.has_local_business_schema),
      missing_qa_schema: !(bundle.aeoRows || []).some((a) => a.has_qa_schema),
    };

    res.json({
      ok: true,
      domain,
      your_services: selfServices,
      content_gaps: gaps,
      aeo_gaps: aeoGaps,
      local_pack: buildLocalPackChecklist(bundle),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
