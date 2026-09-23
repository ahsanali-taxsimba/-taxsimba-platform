import type {
  BacklinkProvider,
  FetchBacklinksInput,
  FetchBacklinksResult,
  ProviderBacklink,
} from "./types";
import { stubBacklinks } from "./stub";

type CrawlGraphItem = {
  linking_domain: string;
  num_hosts?: number;
  tld?: string;
  cg_authority?: number | null;
  cg_rank?: number | null;
};

type CrawlGraphResponse = {
  domain: string;
  release_id?: string;
  release_label?: string;
  total_linking_domains?: number;
  returned?: number;
  cg_authority?: number | null;
  cg_rank?: number | null;
  results?: CrawlGraphItem[];
};

function envKey() {
  return (
    process.env.CRAWLGRAPH_API_KEY?.trim() ||
    process.env.BACKLINK_API_KEY?.trim() ||
    ""
  );
}

function toLinks(
  targetDomain: string,
  siteUrl: string,
  items: CrawlGraphItem[],
): ProviderBacklink[] {
  const base = siteUrl.replace(/\/$/, "");
  return items.map((item, i) => {
    const host = item.linking_domain.replace(/^www\./, "");
    const authority = Math.max(0, Math.min(100, item.cg_authority ?? 35));
    const hosts = item.num_hosts ?? 1;
    // More hosts → slightly higher relevance; low authority → higher spam/risk
    const relevance = Math.min(0.95, 0.35 + Math.min(hosts, 20) / 40);
    const spam = authority < 20 ? 75 : authority < 40 ? 35 : 8;
    const risk = Math.min(1, spam / 100 + (authority < 25 ? 0.35 : 0.05));
    return {
      sourceUrl: `https://${host}/`,
      targetUrl: i % 3 === 0 ? base : `${base}/`,
      anchorText: targetDomain,
      authority,
      relevance: Math.round(relevance * 100) / 100,
      spam,
      risk: Math.round(risk * 100) / 100,
      sourceApi: "crawlgraph",
      relNofollow: spam > 50,
      meta: {
        num_hosts: hosts,
        tld: item.tld,
        cg_rank: item.cg_rank,
        release: true,
      },
    };
  });
}

export function createCrawlGraphProvider(): BacklinkProvider {
  return {
    id: "crawlgraph",
    displayName: "CrawlGraph",
    isConfigured: () => Boolean(envKey()),
    async fetchBacklinks(input: FetchBacklinksInput): Promise<FetchBacklinksResult> {
      const key = envKey();
      if (!key) {
        return stubBacklinks("crawlgraph", input);
      }

      const limit = Math.min(Math.max(input.limit ?? 50, 1), 1000);
      try {
        const res = await fetch("https://crawlgraph.com/api/v1/backlinks", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            domain: input.domain,
            limit,
            sort: "authority",
          }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            ...stubBacklinks("crawlgraph", input),
            error: `CrawlGraph HTTP ${res.status}: ${body.slice(0, 200)}`,
          };
        }

        const data = (await res.json()) as CrawlGraphResponse;
        const items = data.results || [];
        const links = toLinks(input.domain, input.siteUrl, items);

        // Competitor monitoring: one lightweight lookup per competitor (capped)
        for (const comp of (input.competitors || []).slice(0, 1)) {
          try {
            const cres = await fetch("https://crawlgraph.com/api/v1/backlinks", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ domain: comp, limit: 5, sort: "authority" }),
            });
            if (cres.ok) {
              const cdata = (await cres.json()) as CrawlGraphResponse;
              for (const item of (cdata.results || []).slice(0, 5)) {
                const host = item.linking_domain.replace(/^www\./, "");
                links.push({
                  sourceUrl: `https://${host}/`,
                  targetUrl: `https://${comp}/`,
                  anchorText: comp.split(".")[0],
                  authority: Math.max(0, Math.min(100, item.cg_authority ?? 40)),
                  relevance: 0.55,
                  spam: 12,
                  risk: 0.12,
                  sourceApi: "crawlgraph",
                  competitorDomain: comp,
                  meta: { num_hosts: item.num_hosts, competitor: true },
                });
              }
            }
          } catch {
            // ignore competitor fetch errors
          }
        }

        return {
          provider: "crawlgraph",
          mode: "live",
          links,
          metrics: {
            domain: input.domain,
            authority: Math.max(0, Math.min(100, data.cg_authority ?? 40)),
            referringDomains: data.total_linking_domains,
            rank: data.cg_rank ?? null,
            raw: {
              release_id: data.release_id,
              release_label: data.release_label,
              returned: data.returned,
            },
          },
        };
      } catch (e) {
        return {
          ...stubBacklinks("crawlgraph", input),
          error: e instanceof Error ? e.message : "CrawlGraph request failed",
        };
      }
    },
  };
}
