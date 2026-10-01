import type { BacklinkProvider, FetchBacklinksInput, FetchBacklinksResult } from "./types";
import { createCrawlGraphProvider } from "./crawlgraph";
import { createOpenPageRankProvider } from "./openpagerank";
import { createStubProvider } from "./stub";

const legacyStubIds = ["ahrefs", "semrush", "majestic", "dataforseo"] as const;

function buildRegistry(): Map<string, BacklinkProvider> {
  const map = new Map<string, BacklinkProvider>();
  const crawlgraph = createCrawlGraphProvider();
  const openpagerank = createOpenPageRankProvider();
  map.set(crawlgraph.id, crawlgraph);
  map.set(openpagerank.id, openpagerank);
  for (const id of legacyStubIds) {
    map.set(id, createStubProvider(id, id));
  }
  return map;
}

let registry: Map<string, BacklinkProvider> | null = null;

export function getBacklinkProviders(): Map<string, BacklinkProvider> {
  if (!registry) registry = buildRegistry();
  return registry;
}

export function getBacklinkProvider(id: string): BacklinkProvider | undefined {
  return getBacklinkProviders().get(id);
}

export function listBacklinkProviderStatuses(): Array<{
  id: string;
  displayName: string;
  configured: boolean;
}> {
  return [...getBacklinkProviders().values()].map((p) => ({
    id: p.id,
    displayName: p.displayName,
    configured: p.isConfigured(),
  }));
}

/**
 * Fetch + merge backlinks from the requested provider ids.
 * When openpagerank is available, enrich authority on CrawlGraph (and other) rows.
 */
export async function fetchBacklinksFromProviders(
  providerIds: string[],
  input: FetchBacklinksInput,
): Promise<{
  links: FetchBacklinksResult["links"];
  results: FetchBacklinksResult[];
  providers: ReturnType<typeof listBacklinkProviderStatuses>;
}> {
  const ids = providerIds.length ? providerIds : ["crawlgraph", "openpagerank"];
  const results: FetchBacklinksResult[] = [];
  const links: FetchBacklinksResult["links"] = [];

  for (const id of ids) {
    const provider = getBacklinkProvider(id) || createStubProvider(id, id);
    const result = await provider.fetchBacklinks(input);
    results.push(result);
    links.push(...result.links);
  }

  // Enrich authority via Open PageRank when configured and we have referring hosts
  const opr = getBacklinkProvider("openpagerank");
  if (opr?.isConfigured() && opr.fetchDomainMetrics && links.length) {
    const hosts = [
      ...new Set(
        links
          .map((l) => {
            try {
              return new URL(l.sourceUrl).hostname.replace(/^www\./, "");
            } catch {
              return "";
            }
          })
          .filter(Boolean),
      ),
    ].slice(0, 100);

    try {
      const metrics = await opr.fetchDomainMetrics(hosts);
      const byHost = new Map(metrics.map((m) => [m.domain.replace(/^www\./, ""), m]));
      for (const link of links) {
        if (link.sourceApi === "openpagerank") continue;
        try {
          const host = new URL(link.sourceUrl).hostname.replace(/^www\./, "");
          const m = byHost.get(host);
          if (m && m.authority > 0) {
            link.authority = m.authority;
            link.meta = {
              ...(link.meta || {}),
              open_page_rank: m.raw?.open_page_rank,
              opr_enriched: true,
            };
          }
        } catch {
          // skip bad urls
        }
      }
      results.push({
        provider: "openpagerank-enrich",
        mode: "live",
        links: [],
        metrics: metrics[0],
      });
    } catch {
      // enrichment is best-effort
    }
  }

  return {
    links,
    results,
    providers: listBacklinkProviderStatuses(),
  };
}

export type { BacklinkProvider, FetchBacklinksInput, FetchBacklinksResult };
