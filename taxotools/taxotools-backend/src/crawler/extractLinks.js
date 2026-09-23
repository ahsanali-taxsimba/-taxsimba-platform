import * as cheerio from "cheerio";
import { normalizeDomain, toAbsoluteUrl } from "../utils/normalizeDomain.js";
import { classifyLinkType } from "./classifyLinkType.js";

/**
 * Extract outbound links from an HTML page.
 */
export function extractLinks(html, pageUrl, accountantDomain) {
  const $ = cheerio.load(html || "");
  const pageHost = normalizeDomain(pageUrl);
  const accountant = normalizeDomain(accountantDomain);
  const links = [];
  const internal = new Set();

  $("a[href]").each((_, el) => {
    const a = $(el);
    const href = a.attr("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
      return;
    }
    const abs = toAbsoluteUrl(href, pageUrl);
    if (!abs || !/^https?:/i.test(abs)) return;
    const targetHost = normalizeDomain(abs);
    const anchor_text = (a.text() || "").replace(/\s+/g, " ").trim().slice(0, 240);
    const link_type = classifyLinkType(a, a.attr("rel"));

    if (targetHost === pageHost || targetHost === accountant) {
      internal.add(abs.split("#")[0]);
      return;
    }

    links.push({
      source_url: pageUrl,
      target_url: abs.split("#")[0],
      anchor_text,
      referring_domain: pageHost,
      link_type,
      accountant_domain: accountant,
      direction: "outbound",
    });
  });

  return { outbound: links, internalUrls: [...internal] };
}

/** Prefer service/blog/contact paths when ranking crawl frontier */
export function scorePathPriority(url) {
  const u = url.toLowerCase();
  if (/contact|about|team/.test(u)) return 3;
  if (/service|tax|vat|cis|bookkeep|account/.test(u)) return 2;
  if (/blog|news|insight|resource/.test(u)) return 2;
  return 1;
}
