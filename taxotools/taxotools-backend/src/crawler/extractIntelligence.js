import * as cheerio from "cheerio";
import { normalizeDomain } from "../utils/normalizeDomain.js";

function textList($, sel, limit = 20) {
  const out = [];
  $(sel).each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) out.push(t.slice(0, 300));
  });
  return out.slice(0, limit);
}

function parseJsonLd(html) {
  const $ = cheerio.load(html || "");
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      const parsed = JSON.parse(raw);
      blocks.push(parsed);
    } catch {
      // ignore invalid json-ld
    }
  });
  return blocks;
}

function collectTypes(node, set = new Set()) {
  if (!node) return set;
  if (Array.isArray(node)) {
    for (const n of node) collectTypes(n, set);
    return set;
  }
  if (typeof node === "object") {
    const t = node["@type"];
    if (Array.isArray(t)) t.forEach((x) => set.add(String(x)));
    else if (t) set.add(String(t));
    if (node["@graph"]) collectTypes(node["@graph"], set);
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") collectTypes(v, set);
    }
  }
  return set;
}

function flattenFaqs(blocks) {
  const faqs = [];
  const walk = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n !== "object") return;
    const type = String(n["@type"] || "");
    if (/FAQPage/i.test(type) && Array.isArray(n.mainEntity)) {
      for (const q of n.mainEntity) {
        faqs.push({
          question: q.name || q.question || null,
          answer: q.acceptedAnswer?.text || q.answer || null,
        });
      }
    }
    if (/Question/i.test(type)) {
      faqs.push({
        question: n.name || null,
        answer: n.acceptedAnswer?.text || null,
      });
    }
    if (n["@graph"]) walk(n["@graph"]);
  };
  walk(blocks);
  return faqs.filter((f) => f.question).slice(0, 50);
}

function extractAddress(blocks, $) {
  let addr = {
    business_name: null,
    address: null,
    city: null,
    region: null,
    postcode: null,
    latitude: null,
    longitude: null,
    phone: null,
  };
  const walk = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n !== "object") return;
    const type = String(n["@type"] || "");
    if (/LocalBusiness|AccountingService|Organization|ProfessionalService/i.test(type)) {
      addr.business_name = addr.business_name || n.name || null;
      addr.phone = addr.phone || n.telephone || null;
      const a = n.address || {};
      addr.address =
        addr.address ||
        [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(", ") ||
        null;
      addr.city = addr.city || a.addressLocality || null;
      addr.region = addr.region || a.addressRegion || null;
      addr.postcode = addr.postcode || a.postalCode || null;
      if (n.geo) {
        addr.latitude = n.geo.latitude ?? addr.latitude;
        addr.longitude = n.geo.longitude ?? addr.longitude;
      }
    }
    if (n["@graph"]) walk(n["@graph"]);
  };
  walk(blocks);

  // Fallback: footer-ish text patterns for UK postcodes
  if (!addr.postcode) {
    const body = $("body").text().replace(/\s+/g, " ");
    const m = body.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
    if (m) addr.postcode = m[1].toUpperCase();
  }
  if (!addr.phone) {
    const tel = $('a[href^="tel:"]').first().attr("href");
    if (tel) addr.phone = tel.replace(/^tel:/, "");
  }
  return addr;
}

function snippetCandidates($) {
  const out = [];
  $("p").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 40 && t.length < 320) out.push(t);
  });
  return out.slice(0, 15);
}

/**
 * Extract SEO + AEO + GEO signals from a single HTML page.
 */
export function extractPageIntelligence(html, pageUrl, domain, extras = {}) {
  const $ = cheerio.load(html || "");
  const host = normalizeDomain(domain);
  const blocks = parseJsonLd(html);
  const types = [...collectTypes(blocks)];
  const faqs = flattenFaqs(blocks);
  const geo = extractAddress(blocks, $);

  const title = ($("title").first().text() || "").trim().slice(0, 300);
  const meta_description = (
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    ""
  )
    .trim()
    .slice(0, 500);
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim().slice(0, 300);
  const h2 = textList($, "h2");
  const h3 = textList($, "h3");
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const robots_meta = $('meta[name="robots"]').attr("content") || null;
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const word_count = bodyText ? bodyText.split(" ").filter(Boolean).length : 0;

  const seo = {
    domain: host,
    page_url: pageUrl,
    title: title || null,
    meta_description: meta_description || null,
    h1: h1 || null,
    h2,
    h3,
    canonical,
    robots_meta,
    schema_types: types,
    sitemap_urls: extras.sitemap_urls || [],
    robots_txt: extras.robots_txt || null,
    http_status: extras.http_status ?? null,
    redirect_chain: extras.redirect_chain || [],
    word_count,
    internal_links: extras.internal_links ?? 0,
    external_links: extras.external_links ?? 0,
    broken_links: extras.broken_links ?? 0,
    page_depth: extras.page_depth ?? 0,
    lcp_ms: extras.lcp_ms ?? null,
    cls: extras.cls ?? null,
    inp_ms: extras.inp_ms ?? null,
    performance_score: extras.performance_score ?? null,
    raw: { schema_count: blocks.length },
    crawled_at: new Date().toISOString(),
  };

  const aeo = {
    domain: host,
    page_url: pageUrl,
    has_faq_schema: types.some((t) => /FAQPage/i.test(t)),
    has_qa_schema: types.some((t) => /QAPage|Question/i.test(t)),
    has_local_business_schema: types.some((t) =>
      /LocalBusiness|AccountingService|ProfessionalService/i.test(t),
    ),
    faq_items: faqs,
    qa_items: faqs,
    featured_snippet_candidates: snippetCandidates($),
    structured_answers: faqs.slice(0, 10).map((f) => f.answer).filter(Boolean),
    updated_at: new Date().toISOString(),
  };

  return { seo, aeo, geo: { domain: host, ...geo, updated_at: new Date().toISOString() } };
}

/** Pull candidate keywords from titles/headings/body for Keywords Everywhere lookup */
export function extractKeywordCandidates(seoRows = [], limit = 40) {
  const bag = new Map();
  const add = (phrase) => {
    const p = String(phrase || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!p || p.length < 3 || p.length > 80) return;
    // prefer 2–5 word phrases
    const words = p.split(" ");
    if (words.length < 1 || words.length > 6) return;
    bag.set(p, (bag.get(p) || 0) + 1);
  };

  for (const row of seoRows) {
    add(row.title);
    add(row.h1);
    for (const h of row.h2 || []) add(h);
    for (const h of row.h3 || []) add(h);
  }

  // Always include accountancy seeds
  [
    "accountant",
    "tax advisor",
    "vat accountant",
    "cis accountant",
    "bookkeeping services",
    "chartered accountant",
    "payroll services",
  ].forEach(add);

  return [...bag.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword);
}
