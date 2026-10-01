import type {
  BacklinkProvider,
  FetchBacklinksInput,
  FetchBacklinksResult,
  ProviderBacklink,
  ProviderDomainMetrics,
} from "./types";
import { stubBacklinks } from "./stub";

type OprResult = {
  domain: string;
  found?: boolean;
  open_page_rank?: number | null;
  rank?: number | null;
  referring_domains?: number | null;
};

type OprResponse = {
  as_of?: string;
  count?: number;
  results?: OprResult[];
  invalid?: string[];
};

function envKey() {
  return (
    process.env.OPENPAGERANK_API_KEY?.trim() ||
    process.env.KEYWORDS_EVERYWHERE_API_KEY?.trim() ||
    ""
  );
}

/** Map Open PageRank 0–10 → 0–100 authority. */
export function oprToAuthority(score: number | null | undefined): number {
  if (score == null || Number.isNaN(score)) return 30;
  return Math.max(0, Math.min(100, Math.round(score * 10)));
}

async function bulkMetrics(domains: string[]): Promise<ProviderDomainMetrics[]> {
  const key = envKey();
  if (!key || !domains.length) return [];

  const unique = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))].slice(
    0,
    100,
  );

  const res = await fetch("https://openpagerank.keywordseverywhere.com/v1/domains/bulk", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ domains: unique, include_history: false }),
  });

  if (!res.ok) {
    throw new Error(`OpenPageRank HTTP ${res.status}`);
  }

  const data = (await res.json()) as OprResponse;
  return (data.results || []).map((r) => ({
    domain: r.domain,
    authority: oprToAuthority(r.open_page_rank),
    referringDomains: r.referring_domains ?? undefined,
    rank: r.rank ?? null,
    raw: {
      open_page_rank: r.open_page_rank,
      found: r.found,
      as_of: data.as_of,
    },
  }));
}

/**
 * Open PageRank does not return link lists — it returns domain authority metrics.
 * When used as a "source API", we emit synthetic referring-domain rows from the
 * RD count (capped) so the engine can score/store something useful, and expose
 * metrics for enrichment of CrawlGraph (or stub) rows.
 */
export function createOpenPageRankProvider(): BacklinkProvider {
  return {
    id: "openpagerank",
    displayName: "Open PageRank",
    isConfigured: () => Boolean(envKey()),
    async fetchDomainMetrics(domains) {
      const key = envKey();
      if (!key) {
        return domains.map((domain) => ({
          domain,
          authority: 35,
          referringDomains: 0,
          raw: { stub: true },
        }));
      }
      try {
        return await bulkMetrics(domains);
      } catch {
        return domains.map((domain) => ({
          domain,
          authority: 35,
          referringDomains: 0,
          raw: { stub: true, error: true },
        }));
      }
    },
    async fetchBacklinks(input: FetchBacklinksInput): Promise<FetchBacklinksResult> {
      const key = envKey();
      if (!key) {
        return stubBacklinks("openpagerank", input);
      }

      try {
        const domains = [input.domain, ...(input.competitors || []).slice(0, 5)];
        const metricsList = await bulkMetrics(domains);
        const target = metricsList.find(
          (m) => m.domain.replace(/^www\./, "") === input.domain.replace(/^www\./, ""),
        ) || metricsList[0];

        const rd = Math.min(target?.referringDomains ?? 0, 25);
        const siteUrl = input.siteUrl.replace(/\/$/, "");
        const links: ProviderBacklink[] = [];

        // Synthetic sample rows representing OPR referring-domain breadth
        for (let i = 0; i < Math.min(rd, 12); i++) {
          const auth = Math.max(15, (target?.authority ?? 40) - i * 3);
          links.push({
            sourceUrl: `https://opr-ref-${i}.${input.domain.split(".").slice(-2).join(".")}/ref`,
            targetUrl: siteUrl,
            anchorText: input.domain,
            authority: auth,
            relevance: 0.5,
            spam: auth < 25 ? 40 : 10,
            risk: auth < 25 ? 0.35 : 0.1,
            sourceApi: "openpagerank",
            meta: {
              synthetic: true,
              open_page_rank: target?.raw?.open_page_rank,
              referring_domains: target?.referringDomains,
            },
          });
        }

        // Competitor domain power snapshots
        for (const m of metricsList) {
          const host = m.domain.replace(/^www\./, "");
          if (host === input.domain.replace(/^www\./, "")) continue;
          links.push({
            sourceUrl: `https://${host}/`,
            targetUrl: `https://${host}/`,
            anchorText: host.split(".")[0],
            authority: m.authority,
            relevance: 0.4,
            spam: 8,
            risk: 0.1,
            sourceApi: "openpagerank",
            competitorDomain: host,
            meta: {
              open_page_rank: m.raw?.open_page_rank,
              referring_domains: m.referringDomains,
              snapshot: true,
            },
          });
        }

        return {
          provider: "openpagerank",
          mode: "live",
          links,
          metrics: target,
        };
      } catch (e) {
        return {
          ...stubBacklinks("openpagerank", input),
          error: e instanceof Error ? e.message : "OpenPageRank request failed",
        };
      }
    },
  };
}
