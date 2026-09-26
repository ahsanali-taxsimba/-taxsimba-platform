/**
 * Import a pasted list of "Name — website" lines into accountancy_firms.
 * Only live unique domains are saved. Skip invented/placeholder hosts.
 */
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { isWebsiteLive } from "./resolveWebsite.js";
import { upsertAccountancyFirm } from "../supabase/insertDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { env } from "../utils/env.js";

const log = logger("manualImport");

/** Domains that look like SEO-placeholder / not real firm sites */
const SKIP_DOMAIN =
  /^(manchester(ledger|tax|accounts?|finance|audit|compliance|corporate|business|advisory|vat|payroll|bookkeeping|taxation).+\.co\.uk)$/i;

export function parseFirmLines(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(
      /^\s*(?:\d+[–\-]\d+\s+)?(?:\d+\.\s*)?(.+?)\s*[—–\-]\s*(https?:\/\/\S+|\S+\.[a-z]{2,}(?:\/\S*)?)\s*$/i,
    );
    if (!m) continue;
    let name = m[1].replace(/^\d+\.\s*/, "").trim();
    // Drop city-branch prefixes that are just duplicates of national brand
    name = name.replace(/\s+\((Tax|Tax & Accounting).*?\)$/i, "").trim();
    const domain = normalizeDomain(m[2]);
    if (!domain || !name || name.length < 2) continue;
    if (SKIP_DOMAIN.test(domain)) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    out.push({ name, domain });
  }
  return out;
}

export async function importFirmList(text, { location = "UK", source = "manual_paste" } = {}) {
  const firms = parseFirmLines(text);
  log.info(`Parsed ${firms.length} unique firm/domain pairs`);
  const found = [];
  let skippedDead = 0;

  for (const f of firms) {
    try {
      if (!(await isWebsiteLive(f.domain, { timeoutMs: 5000 }))) {
        skippedDead += 1;
        continue;
      }
      const row = await upsertAccountancyFirm({
        domain: f.domain,
        company_name: f.name,
        location,
        source,
        website_url: `https://${f.domain}`,
        website_verified: true,
        crawl_status: "pending",
      });
      if (row) found.push(row);
      await sleep(env.crawlDelayMs || 150);
    } catch (e) {
      log.warn(`import failed ${f.domain}`, { error: String(e.message || e) });
    }
  }

  log.info("Manual import complete", {
    parsed: firms.length,
    saved: found.length,
    skippedDead,
  });
  return { parsed: firms.length, saved: found.length, skippedDead, found };
}
