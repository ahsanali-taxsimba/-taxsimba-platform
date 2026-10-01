import { prisma, SearchIntent } from "@taxotools/database";
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

/** Heuristic keyword metrics until a SERP data provider is wired */
function estimateMetrics(phrase: string) {
  const len = phrase.length;
  const words = phrase.trim().split(/\s+/).length;
  const volume = Math.max(50, Math.round(18000 / (words * 1.8 + len * 0.15)));
  const difficulty = Math.min(95, Math.round(25 + words * 8 + (len % 17)));
  const cpcCents = Math.round(50 + difficulty * 4);
  return { volume, difficulty, cpcCents };
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

  const created = [];
  for (const phrase of cleaned) {
    const metrics = estimateMetrics(phrase);
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
        ...metrics,
        tracking: true,
      },
      update: {
        intent: detectIntent(phrase),
        ...metrics,
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
  return enqueueJob({
    queue: "taxotools-rank",
    name: "rank-check",
    payload: { siteId: site.id, accountId: site.workspace.accountId },
  });
}

export async function keywordGap(userId: string, siteId: string, competitorDomain: string) {
  await getSiteForUser(userId, siteId);
  const ours = await prisma.keyword.findMany({ where: { siteId }, select: { phrase: true } });
  const ourSet = new Set(ours.map((k) => k.phrase));

  // Stub competitor discovery — replace with backlink/SERP API
  const discovered = [
    `${competitorDomain.split(".")[0]} software`,
    `${competitorDomain.split(".")[0]} pricing`,
    `best ${competitorDomain.split(".")[0]} alternative`,
    "seo audit checklist",
    "ai overview tracking",
  ];

  return {
    competitorDomain,
    missing: discovered.filter((p) => !ourSet.has(p)),
    overlapping: discovered.filter((p) => ourSet.has(p)),
  };
}
