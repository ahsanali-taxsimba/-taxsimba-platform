import { prisma, SearchIntent, type Prisma } from "@taxotools/database";
import {
  fetchKeywordMetrics,
  suggestKeywords,
  phrasesFromCrawlPages,
  checkKeywordRank,
  listSeoProviderStatuses,
} from "@taxotools/integrations";
import { assertWithinLimit } from "@/server/services/usage.service";
import { getSiteForUser } from "@/server/services/tenant.service";
import { enqueueJob } from "@/server/queue";

function detectIntent(phrase: string): SearchIntent {
  const p = phrase.toLowerCase();
  if (/\b(buy|pricing|price|cost|cheap|deal|subscription)\b/.test(p)) return "TRANSACTIONAL";
  if (/\b(best|vs|versus|review|compare|top)\b/.test(p)) return "COMMERCIAL";
  if (/\b(login|signin|official|website)\b/.test(p)) return "NAVIGATIONAL";
  return "INFORMATIONAL";
}

async function countryForSite(locale: string) {
  const l = (locale || "en-GB").toLowerCase();
  if (l.startsWith("en-us")) return "us";
  if (l.startsWith("en-au")) return "au";
  return "uk";
}

/** Persist a rank check for one site (used by worker-equivalent inline path). */
export async function runRankCheckForSite(siteId: string) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const keywords = await prisma.keyword.findMany({ where: { siteId, tracking: true } });
  const pages = await prisma.page.findMany({
    where: { siteId },
    select: {
      url: true,
      title: true,
      metaDescription: true,
      path: true,
      wordCount: true,
    },
    take: 200,
    orderBy: { lastCrawledAt: "desc" },
  });

  let checked = 0;
  for (const kw of keywords) {
    const prev = await prisma.rankRecord.findFirst({
      where: { keywordId: kw.id },
      orderBy: { checkedAt: "desc" },
    });
    const result = await checkKeywordRank({
      phrase: kw.phrase,
      domain: site.domain,
      locale: kw.locale || site.locale,
      device: kw.device,
      location: kw.location || undefined,
      pages,
    });
    await prisma.rankRecord.create({
      data: {
        keywordId: kw.id,
        position: result.position,
        previousPosition: prev?.position ?? null,
        url: result.url,
        hasAiOverview: result.hasAiOverview,
        shareOfVoice: result.shareOfVoice,
        serpJson: {
          source: result.source,
          mode: result.mode,
          device: kw.device,
          organics: result.organics.slice(0, 10),
        } as Prisma.InputJsonValue,
      },
    });
    for (const feature of result.features) {
      if (
        feature.type !== "AI_OVERVIEW" &&
        feature.type !== "PEOPLE_ALSO_ASK" &&
        feature.type !== "KNOWLEDGE_PANEL"
      ) {
        continue;
      }
      await prisma.sERPFeature.create({
        data: {
          keywordId: kw.id,
          type: feature.type,
          present: feature.present,
          metadata: (feature.metadata || {}) as Prisma.InputJsonValue,
        },
      });
    }
    checked += 1;
  }
  return { siteId, checked, providers: listSeoProviderStatuses() };
}

export async function addKeywords(params: {
  userId: string;
  siteId: string;
  phrases: string[];
  locale?: string;
  device?: "DESKTOP" | "MOBILE";
  location?: string;
}) {
  const site = await getSiteForUser(params.userId, params.siteId);
  const cleaned = [
    ...new Set(params.phrases.map((p) => p.trim().toLowerCase()).filter(Boolean)),
  ];
  if (!cleaned.length) return [];

  await assertWithinLimit(site.workspace.accountId, "KEYWORDS", cleaned.length);

  const locale = params.locale ?? site.locale;
  const device = params.device ?? "DESKTOP";
  const location = params.location ?? "";
  const country = await countryForSite(locale);

  const metricsList = await fetchKeywordMetrics(cleaned, { country });
  const byPhrase = new Map(metricsList.map((m) => [m.keyword, m]));

  const created = [];
  for (const phrase of cleaned) {
    const metrics = byPhrase.get(phrase) || {
      volume: 50,
      difficulty: 45,
      cpcCents: 120,
      trend: [] as number[],
      source: "heuristic",
      mode: "heuristic" as const,
    };
    const kw = await prisma.keyword.upsert({
      where: {
        siteId_phrase_locale_device_location: {
          siteId: site.id,
          phrase,
          locale,
          device,
          location,
        },
      },
      create: {
        siteId: site.id,
        phrase,
        locale,
        device,
        location,
        intent: detectIntent(phrase),
        volume: metrics.volume,
        difficulty: metrics.difficulty,
        cpcCents: metrics.cpcCents,
        trendJson: { trend: metrics.trend || [], source: metrics.source },
        tracking: true,
      },
      update: {
        intent: detectIntent(phrase),
        volume: metrics.volume,
        difficulty: metrics.difficulty,
        cpcCents: metrics.cpcCents,
        trendJson: { trend: metrics.trend || [], source: metrics.source },
        tracking: true,
      },
    });
    created.push(kw);
  }
  return created;
}

export async function listKeywords(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  return prisma.keyword.findMany({
    where: { siteId },
    include: {
      ranks: { orderBy: { checkedAt: "desc" }, take: 1 },
      cluster: true,
    },
    orderBy: [{ volume: "desc" }, { phrase: "asc" }],
  });
}

export async function clusterKeywords(userId: string, siteId: string) {
  const keywords = await listKeywords(userId, siteId);
  const groups = new Map<string, typeof keywords>();

  for (const kw of keywords) {
    const seed = kw.phrase.split(/\s+/).slice(0, 2).join(" ") || kw.phrase;
    const list = groups.get(seed) ?? [];
    list.push(kw);
    groups.set(seed, list);
  }

  const clusters = [];
  for (const [name, kws] of groups) {
    const cluster = await prisma.keywordCluster.create({
      data: {
        siteId,
        name,
        topic: name,
        keywords: { connect: kws.map((k) => ({ id: k.id })) },
      },
      include: { keywords: true },
    });
    clusters.push(cluster);
  }
  return clusters;
}

export async function enqueueRankCheck(userId: string, siteId: string) {
  const site = await getSiteForUser(userId, siteId);
  const job = await enqueueJob({
    queue: "taxotools-rank",
    name: "rank-check",
    payload: { siteId: site.id, accountId: site.workspace.accountId },
  });

  // No Redis/worker → run rank check inline so keywords/SERP still update on Vercel.
  if (job.transport === "db") {
    try {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
      });
      const result = await runRankCheckForSite(site.id);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          result: { ...result, transport: "inline" },
          errorMessage: null,
        },
      });
      return Object.assign(job, { transport: "inline" as const, result });
    } catch (e) {
      const message = e instanceof Error ? e.message : "inline rank check failed";
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
      });
      throw e;
    }
  }

  return job;
}

export async function keywordMagic(userId: string, siteId: string, query?: string) {
  const site = await getSiteForUser(userId, siteId);
  const pages = await prisma.page.findMany({
    where: { siteId },
    select: { title: true, path: true },
    take: 40,
    orderBy: { lastCrawledAt: "desc" },
  });
  const crawlPhrases = phrasesFromCrawlPages(pages, 12);
  const seed = (query || site.name || crawlPhrases[0] || "seo").toLowerCase();
  const suggested = await suggestKeywords(seed, {
    country: await countryForSite(site.locale),
    extras: crawlPhrases,
  });
  return {
    ...suggested,
    query: seed,
    crawlPhrases,
    providers: listSeoProviderStatuses(),
  };
}

export async function keywordGap(userId: string, siteId: string, competitorDomain: string) {
  const site = await getSiteForUser(userId, siteId);
  const ours = await prisma.keyword.findMany({ where: { siteId }, select: { phrase: true } });
  const ourSet = new Set(ours.map((k) => k.phrase));

  const brand = competitorDomain.split(".")[0] || "competitor";
  const pages = await prisma.page.findMany({
    where: { siteId },
    select: { title: true, path: true },
    take: 30,
  });
  const fromCrawl = phrasesFromCrawlPages(pages, 8);
  const seedPhrases = [
    `${brand} software`,
    `${brand} pricing`,
    `best ${brand} alternative`,
    `${site.name.toLowerCase()} vs ${brand}`,
    "seo audit checklist",
    "ai overview tracking",
    ...fromCrawl,
  ];
  const metrics = await fetchKeywordMetrics(seedPhrases, {
    country: await countryForSite(site.locale),
  });

  const missing = metrics.filter((m) => !ourSet.has(m.keyword));
  const overlapping = metrics.filter((m) => ourSet.has(m.keyword));

  return {
    competitorDomain,
    missing: missing.map((m) => m.keyword),
    overlapping: overlapping.map((m) => m.keyword),
    missingMetrics: missing,
    mode: metrics.some((m) => m.mode === "live") ? "live" : "heuristic",
    providers: listSeoProviderStatuses(),
  };
}
