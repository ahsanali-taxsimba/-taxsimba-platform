import type {
  BacklinkProvider,
  FetchBacklinksInput,
  FetchBacklinksResult,
  ProviderBacklink,
  ProviderDomainMetrics,
} from "./types";

function hash(s: string) {
  return [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
}

/** Deterministic stub used when live keys are missing or a call fails. */
export function stubBacklinks(
  providerId: string,
  input: FetchBacklinksInput,
): FetchBacklinksResult {
  const seeds = [
    { host: "forbes.com", auth: 92, spam: 2, rel: 0.82 },
    { host: "hubspot.com", auth: 91, spam: 5, rel: 0.78 },
    { host: "searchenginejournal.com", auth: 88, spam: 8, rel: 0.91 },
    { host: "moz.com", auth: 91, spam: 6, rel: 0.85 },
    { host: "techcrunch.com", auth: 89, spam: 4, rel: 0.55 },
    { host: "medium.com", auth: 94, spam: 18, rel: 0.42 },
    { host: "spam-directory.biz", auth: 12, spam: 88, rel: 0.05 },
    { host: "cheap-pbn.network", auth: 8, spam: 95, rel: 0.02 },
    { host: "guestpost-farm.ru", auth: 15, spam: 76, rel: 0.12 },
    { host: "niche-blog.io", auth: 46, spam: 14, rel: 0.74 },
    { host: "local-chamber.org", auth: 38, spam: 9, rel: 0.68 },
    { host: "industry-wiki.net", auth: 52, spam: 11, rel: 0.8 },
  ];

  const offset = hash(providerId + input.domain) % 5;
  const picks = seeds.slice(offset).concat(seeds.slice(0, offset)).slice(0, 8);
  const siteUrl = input.siteUrl.replace(/\/$/, "");

  const links: ProviderBacklink[] = picks.map((p, i) => {
    const risk = Math.min(1, p.spam / 100 + (p.rel < 0.2 ? 0.35 : 0.05));
    return {
      sourceUrl: `https://${p.host}/article/${providerId}-${input.domain.replace(/\./g, "-")}-${i}`,
      targetUrl: i % 3 === 0 ? siteUrl : `${siteUrl}/blog`,
      anchorText:
        i % 4 === 0
          ? input.domain
          : i % 4 === 1
            ? "click here"
            : i % 4 === 2
              ? "seo tools"
              : "best platform",
      authority: p.auth + (hash(providerId) % 3),
      relevance: p.rel,
      spam: p.spam,
      risk: Math.round(risk * 100) / 100,
      sourceApi: providerId,
      relNofollow: p.spam > 50,
      meta: { stub: true },
    };
  });

  for (const comp of (input.competitors || []).slice(0, 2)) {
    links.push({
      sourceUrl: `https://outreach-mag.com/mentions/${comp}`,
      targetUrl: `https://${comp}/`,
      anchorText: comp.split(".")[0],
      authority: 55 + (hash(comp) % 30),
      relevance: 0.6 + (hash(comp) % 30) / 100,
      spam: 10 + (hash(comp + providerId) % 20),
      risk: 0.15,
      sourceApi: providerId,
      competitorDomain: comp,
      meta: { stub: true },
    });
  }

  return {
    provider: providerId,
    mode: "stub",
    links,
    metrics: {
      domain: input.domain,
      authority: 45 + (hash(input.domain) % 40),
      referringDomains: links.filter((l) => !l.competitorDomain).length,
    },
  };
}

export function createStubProvider(id: string, displayName: string): BacklinkProvider {
  return {
    id,
    displayName,
    isConfigured: () => false,
    async fetchBacklinks(input) {
      return stubBacklinks(id, input);
    },
    async fetchDomainMetrics(domains) {
      return domains.map(
        (domain): ProviderDomainMetrics => ({
          domain,
          authority: 40 + (hash(domain) % 50),
          referringDomains: 10 + (hash(domain) % 90),
          raw: { stub: true },
        }),
      );
    },
  };
}
