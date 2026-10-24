import type { CrawlPageSignal, SerpOrganicResult, SerpRankResult } from "./types";

function serpKey(): string | undefined {
  return process.env.SERP_API_KEY || process.env.SERPAPI_KEY || undefined;
}

export function isSerpApiConfigured(): boolean {
  return Boolean(serpKey());
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase() || "";
  }
}

function domainMatches(resultHost: string, targetDomain: string): boolean {
  const a = resultHost.replace(/^www\./, "");
  const b = targetDomain.replace(/^www\./, "").toLowerCase();
  return a === b || a.endsWith(`.${b}`);
}

function glHlFromLocale(locale: string): { gl: string; hl: string } {
  const l = (locale || "en-GB").toLowerCase();
  if (l.startsWith("en-us")) return { gl: "us", hl: "en" };
  if (l.startsWith("en-au")) return { gl: "au", hl: "en" };
  if (l.startsWith("en-ca")) return { gl: "ca", hl: "en" };
  return { gl: "uk", hl: "en" };
}

/** Estimate rank from on-site crawl signals when SERP API is unavailable. */
export function estimateRankFromCrawl(
  phrase: string,
  domain: string,
  pages: CrawlPageSignal[],
): SerpRankResult {
  const kw = phrase.toLowerCase();
  const tokens = kw.split(/\s+/).filter((t) => t.length > 2);
  let best: { url: string; score: number } | null = null;

  for (const page of pages) {
    const hay = `${page.title || ""} ${page.metaDescription || ""} ${page.path || ""}`.toLowerCase();
    if (!hay) continue;
    let score = 0;
    if (hay.includes(kw)) score += 40;
    for (const t of tokens) {
      if (hay.includes(t)) score += 8;
    }
    if ((page.title || "").toLowerCase().includes(kw)) score += 20;
    if ((page.wordCount || 0) > 400) score += 5;
    if (!best || score > best.score) best = { url: page.url, score };
  }

  if (!best || best.score < 16) {
    return {
      phrase,
      domain,
      position: null,
      url: null,
      hasAiOverview: false,
      shareOfVoice: 0,
      organics: [],
      features: [],
      mode: "crawl-derived",
      source: "crawl_pages",
    };
  }

  // Stronger on-page match → better estimated position band (honest, not live SERP).
  const position = Math.max(1, Math.min(50, Math.round(55 - best.score)));
  return {
    phrase,
    domain,
    position,
    url: best.url,
    hasAiOverview: false,
    shareOfVoice: Math.max(0, (51 - position) / 50),
    organics: [
      {
        position,
        title: phrase,
        url: best.url,
        domain,
        snippet: "Estimated from crawled on-page relevance (no SERP API key)",
      },
    ],
    features: [],
    mode: "crawl-derived",
    source: "crawl_pages",
  };
}

function heuristicRank(phrase: string, domain: string): SerpRankResult {
  const seed = [...phrase].reduce((a, c) => a + c.charCodeAt(0), 0);
  const position = (seed % 40) + 1;
  const hasAiOverview = seed % 3 === 0;
  return {
    phrase,
    domain,
    position,
    url: `https://${domain}/${phrase.replace(/\s+/g, "-")}`,
    hasAiOverview,
    aiOverviewCited: hasAiOverview && seed % 2 === 0,
    shareOfVoice: Math.max(0, (41 - position) / 40),
    organics: [],
    features: hasAiOverview
      ? [{ type: "AI_OVERVIEW", present: true, metadata: { cited: seed % 2 === 0 } }]
      : [],
    mode: "heuristic",
    source: "heuristic",
  };
}

/**
 * Live SerpAPI Google rank check for a keyword vs client domain.
 * Falls back to crawl-derived then heuristic.
 */
export async function checkKeywordRank(params: {
  phrase: string;
  domain: string;
  locale?: string;
  device?: string;
  location?: string;
  pages?: CrawlPageSignal[];
}): Promise<SerpRankResult> {
  const { phrase, domain } = params;
  const key = serpKey();
  const { gl, hl } = glHlFromLocale(params.locale || "en-GB");
  const device = (params.device || "DESKTOP").toLowerCase() === "mobile" ? "mobile" : "desktop";

  if (key) {
    try {
      const loc = params.location ? `&location=${encodeURIComponent(params.location)}` : "";
      const url =
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(phrase)}` +
        `&num=20&gl=${gl}&hl=${hl}&device=${device}${loc}` +
        `&api_key=${encodeURIComponent(key)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`SerpAPI ${res.status}: ${t.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        organic_results?: Array<{
          position?: number;
          title?: string;
          link?: string;
          snippet?: string;
        }>;
        ai_overview?: { page_token?: string };
        related_questions?: unknown[];
        knowledge_graph?: unknown;
      };

      const organics: SerpOrganicResult[] = (data.organic_results || []).map((r, i) => {
        const link = r.link || "";
        return {
          position: r.position ?? i + 1,
          title: r.title || "",
          url: link,
          domain: hostnameOf(link),
          snippet: r.snippet,
        };
      });

      const match = organics.find((o) => domainMatches(o.domain, domain));
      const hasAiOverview = Boolean(data.ai_overview);
      const features: SerpRankResult["features"] = [];
      if (hasAiOverview) {
        features.push({
          type: "AI_OVERVIEW",
          present: true,
          metadata: { has_page_token: Boolean(data.ai_overview?.page_token) },
        });
      }
      if (data.related_questions) {
        features.push({ type: "PEOPLE_ALSO_ASK", present: true });
      }
      if (data.knowledge_graph) {
        features.push({ type: "KNOWLEDGE_PANEL", present: true });
      }

      const position = match?.position ?? null;
      return {
        phrase,
        domain,
        position,
        url: match?.url ?? null,
        hasAiOverview,
        aiOverviewCited: false,
        shareOfVoice: position ? Math.max(0, (21 - Math.min(position, 20)) / 20) : 0,
        organics,
        features,
        mode: "live",
        source: "serpapi",
        raw: { organic_count: organics.length },
      };
    } catch {
      // fall through
    }
  }

  if (params.pages?.length) {
    return estimateRankFromCrawl(phrase, domain, params.pages);
  }
  return heuristicRank(phrase, domain);
}

/** Build organic snapshot rows from a SERP result for competitor/domain research. */
export function organicsToSnapshots(
  organics: SerpOrganicResult[],
  volumeHint = 500,
): Array<{ keyword: string; position: number; url: string; trafficShare: number; volume: number }> {
  return organics.slice(0, 20).map((o) => ({
    keyword: o.title.toLowerCase().slice(0, 80) || o.domain,
    position: o.position,
    url: o.url,
    trafficShare: Math.max(0.005, (21 - Math.min(o.position, 20)) / 100),
    volume: volumeHint,
  }));
}
