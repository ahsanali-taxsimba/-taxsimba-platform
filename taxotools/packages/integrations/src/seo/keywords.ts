import type { KeywordMetrics, KeywordSuggestResult } from "./types";

function keKey(): string | undefined {
  return (
    process.env.KEYWORDS_EVERYWHERE_API_KEY ||
    process.env.OPENPAGERANK_API_KEY ||
    process.env.OPEN_PAGERANK_API_KEY ||
    undefined
  );
}

function difficultyFrom(volume: number, competition: number): number {
  const v = Number(volume) || 0;
  const c = Number(competition) || 0;
  return Math.min(100, Math.round(c * 70 + Math.log10(Math.max(v, 1)) * 8));
}

/** Deterministic heuristic metrics when no API key / API fails. */
export function heuristicKeywordMetrics(phrase: string): KeywordMetrics {
  const keyword = phrase.trim().toLowerCase();
  const len = keyword.length;
  const words = keyword.split(/\s+/).filter(Boolean).length || 1;
  const volume = Math.max(50, Math.round(18000 / (words * 1.8 + len * 0.15)));
  const difficulty = Math.min(95, Math.round(25 + words * 8 + (len % 17)));
  const cpcCents = Math.round(50 + difficulty * 4);
  return {
    keyword,
    volume,
    difficulty,
    cpcCents,
    competition: Number((difficulty / 100).toFixed(2)),
    trend: [],
    related: [],
    source: "heuristic",
    mode: "heuristic",
  };
}

export function isKeywordsEverywhereConfigured(): boolean {
  return Boolean(keKey());
}

/**
 * Keywords Everywhere — volume / CPC / competition.
 * Falls back to heuristics when key missing or request fails.
 */
export async function fetchKeywordMetrics(
  phrases: string[],
  opts: { country?: string; currency?: string } = {},
): Promise<KeywordMetrics[]> {
  const unique = [
    ...new Set(phrases.map((k) => String(k).trim().toLowerCase()).filter(Boolean)),
  ].slice(0, 100);
  if (!unique.length) return [];

  const key = keKey();
  if (!key) {
    return unique.map(heuristicKeywordMetrics);
  }

  try {
    const body = new URLSearchParams();
    body.set("dataSource", "gkp");
    body.set("country", (opts.country || "uk").toLowerCase());
    body.set("currency", opts.currency || "GBP");
    for (const kw of unique) body.append("kw[]", kw);

    const res = await fetch("https://api.keywordseverywhere.com/v1/get_keyword_data", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Keywords Everywhere ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const byKw = new Map<string, KeywordMetrics>();
    for (const row of list as Array<Record<string, unknown>>) {
      const keyword = String(row.keyword || row.kw || "").toLowerCase();
      if (!keyword) continue;
      const volume = Number(row.vol ?? row.volume ?? 0);
      const competition = Number(row.competition ?? row.comp ?? 0);
      const cpcRaw = row.cpc;
      const cpc =
        typeof cpcRaw === "object" && cpcRaw !== null
          ? Number((cpcRaw as { value?: number }).value ?? 0)
          : Number(cpcRaw ?? 0);
      byKw.set(keyword, {
        keyword,
        volume,
        difficulty: difficultyFrom(volume, competition),
        cpcCents: Math.round(cpc * 100),
        competition,
        trend: Array.isArray(row.trend) ? (row.trend as number[]) : [],
        related: Array.isArray(row.related)
          ? (row.related as unknown[]).map(String).slice(0, 20)
          : [],
        source: "keywords_everywhere",
        mode: "live",
      });
    }
    return unique.map((kw) => byKw.get(kw) || { ...heuristicKeywordMetrics(kw), source: "heuristic_gap" });
  } catch {
    return unique.map((kw) => ({
      ...heuristicKeywordMetrics(kw),
      source: "heuristic_fallback",
    }));
  }
}

/** Expand a seed into related phrases, enriching with live metrics when possible. */
export async function suggestKeywords(
  seedPhrase: string,
  opts: { country?: string; extras?: string[] } = {},
): Promise<KeywordSuggestResult> {
  const seed = seedPhrase.trim().toLowerCase() || "seo";
  const bases = [
    seed,
    `${seed} tool`,
    `${seed} software`,
    `best ${seed}`,
    `${seed} for agencies`,
    `${seed} pricing`,
    `how to ${seed}`,
    `${seed} checklist`,
    `${seed} examples`,
    `${seed} vs alternatives`,
    `what is ${seed}`,
    `${seed} template`,
    ...(opts.extras || []).map((e) => e.trim().toLowerCase()).filter(Boolean),
  ].slice(0, 40);

  const metrics = await fetchKeywordMetrics(bases, { country: opts.country });
  const live = metrics.some((m) => m.mode === "live");
  return {
    query: seed,
    suggestions: metrics,
    mode: live ? "live" : "heuristic",
    source: live ? "keywords_everywhere" : "heuristic",
  };
}

/** Pull candidate phrases from crawled page titles for client-specific SEO. */
export function phrasesFromCrawlPages(
  pages: Array<{ title?: string | null; path?: string | null }>,
  limit = 24,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    const title = (p.title || "").replace(/\s*[|–—-]\s*.*$/, "").trim().toLowerCase();
    if (title && title.length > 3 && title.length < 80 && !seen.has(title)) {
      seen.add(title);
      out.push(title);
    }
    const path = (p.path || "").replace(/^\//, "").replace(/[-_/]+/g, " ").trim().toLowerCase();
    if (path && path.length > 2 && path.length < 60 && !seen.has(path) && !/^\d+$/.test(path)) {
      seen.add(path);
      out.push(path);
    }
    if (out.length >= limit) break;
  }
  return out;
}
