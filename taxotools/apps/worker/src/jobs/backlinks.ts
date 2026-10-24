import { prisma } from "@taxotools/database";
import {
  BACKLINK_SOURCE_APIS,
  computeBacklinkScore,
  classifyBacklink,
} from "@taxotools/shared";
import { fetchBacklinksFromProviders } from "@taxotools/integrations";

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function toPrismaClass(c: ReturnType<typeof classifyBacklink>) {
  if (c === "toxic") return "TOXIC" as const;
  if (c === "high_value") return "HIGH_VALUE" as const;
  if (c === "lost") return "LOST" as const;
  return "NORMAL" as const;
}

async function fetchAndPersistBacklinks(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error(`Site not found: ${siteId}`);

  let config = await prisma.backlinkEngineConfig.findUnique({ where: { siteId } });
  const apis = (
    (config?.sourceApis as string[] | undefined)?.length
      ? (config!.sourceApis as string[])
      : ["crawlgraph", "openpagerank"]
  ).filter((a) => (BACKLINK_SOURCE_APIS as readonly string[]).includes(a));

  const competitors =
    config?.enableCompetitorMonitoring
      ? (await prisma.competitor.findMany({ where: { siteId }, take: 5 })).map((c) => c.domain)
      : [];

  const fetched = await fetchBacklinksFromProviders(apis, {
    domain: site.domain,
    siteUrl: site.url,
    competitors,
    limit: 50,
  });

  let upserted = 0;
  for (const link of fetched.links) {
    const score = computeBacklinkScore(link);
    const classification = toPrismaClass(classifyBacklink(link));
    const host = hostnameOf(link.sourceUrl);
    const domain = await prisma.domain.upsert({
      where: { hostname: host },
      create: {
        hostname: host,
        domainRating: link.authority,
        spamScore: link.spam / 100,
      },
      update: {
        domainRating: link.authority,
        spamScore: link.spam / 100,
      },
    });

    await prisma.backlink.upsert({
      where: {
        siteId_sourceUrl_targetUrl: {
          siteId,
          sourceUrl: link.sourceUrl,
          targetUrl: link.targetUrl,
        },
      },
      create: {
        siteId,
        sourceDomainId: domain.id,
        sourceUrl: link.sourceUrl,
        targetUrl: link.targetUrl,
        anchorText: link.anchorText,
        relNofollow: !!link.relNofollow,
        authority: link.authority,
        relevance: link.relevance,
        spam: link.spam,
        risk: link.risk,
        score,
        toxicScore: link.risk,
        classification,
        sourceApi: link.sourceApi,
        competitorDomain: link.competitorDomain || null,
      },
      update: {
        sourceDomainId: domain.id,
        anchorText: link.anchorText,
        authority: link.authority,
        relevance: link.relevance,
        spam: link.spam,
        risk: link.risk,
        score,
        toxicScore: link.risk,
        classification,
        sourceApi: link.sourceApi,
        competitorDomain: link.competitorDomain || null,
        lastSeenAt: new Date(),
        lostAt: null,
      },
    });
    upserted += 1;
  }

  if (config) {
    await prisma.backlinkEngineConfig.update({
      where: { siteId },
      data: {
        lastRefreshAt: new Date(),
        nextRefreshAt: new Date(Date.now() + config.refreshIntervalHours * 3600 * 1000),
      },
    });
  }

  return {
    siteId,
    upserted,
    providers: fetched.providers,
    results: fetched.results.map((r) => ({
      provider: r.provider,
      mode: r.mode,
      links: r.links.length,
      error: r.error || null,
    })),
  };
}

/**
 * Worker-side backlink refresh:
 * - When runRefresh / init payload → live provider fetch + upsert
 * - Otherwise re-score existing rows and advance nextRefreshAt
 */
export async function processBacklinkRefresh(data: {
  siteId?: string;
  backgroundJobId?: string;
  runRefresh?: boolean;
  sourceApis?: string[];
}) {
  if (!data.siteId) {
    const due = await prisma.backlinkEngineConfig.findMany({
      where: {
        status: "active",
        OR: [{ nextRefreshAt: null }, { nextRefreshAt: { lte: new Date() } }],
      },
      take: 20,
    });
    const refreshed = [];
    for (const row of due) {
      refreshed.push(await fetchAndPersistBacklinks(row.siteId));
    }
    return { scanned: due.length, refreshed };
  }

  if (data.runRefresh || data.sourceApis?.length) {
    return fetchAndPersistBacklinks(data.siteId);
  }

  const links = await prisma.backlink.findMany({ where: { siteId: data.siteId } });
  let updated = 0;
  for (const link of links) {
    if (link.authority == null || link.relevance == null || link.spam == null || link.risk == null) {
      continue;
    }
    const input = {
      authority: link.authority,
      relevance: link.relevance,
      spam: link.spam,
      risk: link.risk,
    };
    const score = computeBacklinkScore(input);
    const classification = classifyBacklink(input);
    const prismaClass = toPrismaClass(classification);
    await prisma.backlink.update({
      where: { id: link.id },
      data: { score, classification: prismaClass, toxicScore: link.risk },
    });
    updated += 1;
  }

  const config = await prisma.backlinkEngineConfig.findUnique({ where: { siteId: data.siteId } });
  if (config) {
    await prisma.backlinkEngineConfig.update({
      where: { siteId: data.siteId },
      data: {
        lastRefreshAt: new Date(),
        nextRefreshAt: new Date(Date.now() + config.refreshIntervalHours * 3600 * 1000),
      },
    });
  }

  return { siteId: data.siteId, rescored: updated };
}
