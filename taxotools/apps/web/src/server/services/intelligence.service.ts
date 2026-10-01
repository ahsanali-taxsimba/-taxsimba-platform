const DEFAULT_CRAWLER_URL = "https://taxotools-crawler.fly.dev";

export function crawlerBaseUrl() {
  return (
    process.env.TAXOTOOLS_CRAWLER_URL ||
    process.env.CRAWLER_URL ||
    DEFAULT_CRAWLER_URL
  ).replace(/\/$/, "");
}

export type IntelligenceResource =
  | "coverage"
  | "accountants"
  | "firm"
  | "backlinks"
  | "referring-domains"
  | "competitors"
  | "geo"
  | "seo"
  | "aeo"
  | "keywords"
  | "crawler-status"
  | "scorecard"
  | "battle-card"
  | "backlink-gaps"
  | "markets"
  | "leads"
  | "changes"
  | "coverage-uk"
  | "content-gaps";

const RESOURCE_PATH: Record<IntelligenceResource, string> = {
  coverage: "/coverage",
  accountants: "/accountants",
  firm: "/firm",
  backlinks: "/backlinks",
  "referring-domains": "/referring-domains",
  competitors: "/competitors",
  geo: "/geo",
  seo: "/seo",
  aeo: "/aeo",
  keywords: "/keywords",
  "crawler-status": "/crawler/status",
  scorecard: "/scorecard",
  "battle-card": "/battle-card",
  "backlink-gaps": "/backlink-gaps",
  markets: "/markets",
  leads: "/leads",
  changes: "/changes",
  "coverage-uk": "/coverage/uk",
  "content-gaps": "/content-gaps",
};

export async function fetchCrawlerIntelligence(
  resource: IntelligenceResource,
  query: Record<string, string | undefined> = {},
) {
  const path = RESOURCE_PATH[resource];
  if (!path) throw new Error(`Unknown intelligence resource: ${resource}`);

  const url = new URL(`${crawlerBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text.slice(0, 300) || "Invalid response from crawler" };
  }

  if (!res.ok) {
    const err =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : `Crawler returned ${res.status}`;
    // Newer platform routes may not be deployed yet — surface a clear message.
    if (res.status === 404) {
      return {
        ok: false,
        unavailable: true,
        status: 404,
        resource,
        path,
        error: err,
        hint: "This intelligence route is not live on the crawler yet. Core firm / coverage / SEO / AEO / backlink endpoints remain available.",
      };
    }
    throw new Error(err);
  }

  return data;
}
