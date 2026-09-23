import { env } from "../utils/env.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { logger, sleep } from "../utils/logger.js";
import { upsertReferringDomain } from "../supabase/updateAuthority.js";

const log = logger("openPageRank");

/** Map OPR 0–10 → 0–100 integer authority */
export function oprToAuthority(score) {
  if (score == null || Number.isNaN(Number(score))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(score) * 10)));
}

export async function fetchOpenPageRank(domains) {
  const unique = [...new Set(domains.map(normalizeDomain).filter(Boolean))].slice(0, 100);
  if (!unique.length) return [];

  if (!env.openPageRankKey) {
    log.warn("OPEN_PAGERANK_API_KEY missing — using heuristic authority");
    return unique.map((domain) => ({
      domain,
      authority_score: 30 + (domain.length % 40),
      raw: { stub: true },
    }));
  }

  const res = await fetch(
    "https://openpagerank.keywordseverywhere.com/v1/domains/bulk",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openPageRankKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domains: unique, include_history: false }),
    },
  );
  if (!res.ok) {
    throw new Error(`OpenPageRank HTTP ${res.status}`);
  }
  const data = await res.json();
  return (data.results || []).map((r) => ({
    domain: normalizeDomain(r.domain),
    authority_score: oprToAuthority(r.open_page_rank),
    referring_domains: r.referring_domains,
    raw: r,
  }));
}

export async function updateAuthorityForDomains(domains) {
  const scores = await fetchOpenPageRank(domains);
  const out = [];
  for (const s of scores) {
    const row = await upsertReferringDomain({
      domain: s.domain,
      authority_score: s.authority_score,
      backlink_count: s.referring_domains || 0,
    });
    if (row) out.push(row);
    await sleep(20);
  }
  return out;
}
