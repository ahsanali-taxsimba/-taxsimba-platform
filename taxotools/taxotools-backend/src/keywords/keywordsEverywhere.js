import fetch from "node-fetch";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { normalizeDomain } from "../utils/normalizeDomain.js";
import { upsertKeywordRows } from "../supabase/insertIntelligence.js";

const log = logger("keywordsEverywhere");

function difficultyFrom(volume, competition) {
  const v = Number(volume) || 0;
  const c = Number(competition) || 0;
  // Internal heuristic 0–100
  return Math.min(100, Math.round(c * 70 + Math.log10(Math.max(v, 1)) * 8));
}

/**
 * Keywords Everywhere API — volume / CPC / competition / trend.
 * Falls back to heuristic rows when the API key is missing or rate-limited.
 */
export async function fetchKeywordMetrics(keywords = []) {
  const unique = [...new Set(keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean))].slice(
    0,
    100,
  );
  if (!unique.length) return [];

  if (!env.keywordsEverywhereKey) {
    log.warn("KEYWORDS_EVERYWHERE_API_KEY missing — using heuristic keyword metrics");
    return unique.map((keyword) => ({
      keyword,
      search_volume: Math.max(10, Math.round(800 / Math.max(1, keyword.split(" ").length))),
      cpc: Number((0.4 + keyword.length * 0.02).toFixed(2)),
      competition: Number((0.2 + (keyword.split(" ").length % 5) * 0.1).toFixed(2)),
      trend: [],
      related_keywords: [],
      long_tail: keyword.split(" ").length >= 3,
      difficulty: difficultyFrom(100, 0.4),
      source: "heuristic",
    }));
  }

  try {
    const body = new URLSearchParams();
    body.set("dataSource", "gkp");
    body.set("country", "uk");
    body.set("currency", "GBP");
    for (const kw of unique) body.append("kw[]", kw);

    const res = await fetch("https://api.keywordseverywhere.com/v1/get_keyword_data", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.keywordsEverywhereKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Keywords Everywhere ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    return list.map((row) => {
      const keyword = String(row.keyword || row.kw || "").toLowerCase();
      const volume = Number(row.vol ?? row.volume ?? 0);
      const competition = Number(row.competition ?? row.comp ?? 0);
      const cpc = Number(row.cpc?.value ?? row.cpc ?? 0);
      return {
        keyword,
        search_volume: volume,
        cpc,
        competition,
        trend: row.trend || [],
        related_keywords: (row.related || []).slice?.(0, 20) || [],
        long_tail: keyword.split(" ").length >= 3,
        difficulty: difficultyFrom(volume, competition),
        source: "keywords_everywhere",
      };
    });
  } catch (e) {
    log.warn("Keywords Everywhere failed — heuristic fallback", { error: String(e.message || e) });
    return unique.map((keyword) => ({
      keyword,
      search_volume: 50,
      cpc: 1.2,
      competition: 0.45,
      trend: [],
      related_keywords: [],
      long_tail: keyword.split(" ").length >= 3,
      difficulty: 45,
      source: "heuristic_fallback",
    }));
  }
}

export async function refreshKeywordsForDomain(domain, candidates = []) {
  const host = normalizeDomain(domain);
  const metrics = await fetchKeywordMetrics(candidates);
  const rows = metrics.map((m) => ({
    domain: host,
    ...m,
    updated_at: new Date().toISOString(),
  }));
  const n = await upsertKeywordRows(rows);
  log.info(`keywords saved for ${host}`, { count: n });
  return { domain: host, count: n };
}
