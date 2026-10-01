import { prisma, type Prisma } from "@taxotools/database";
import { checkKeywordRank } from "@taxotools/integrations";

export async function processRankCheck(payload: Record<string, unknown>) {
  const siteId = String(payload.siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new Error(`Site not found: ${siteId}`);

  const keywords = await prisma.keyword.findMany({
    where: { siteId, tracking: true },
  });

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
  let live = 0;
  let crawlDerived = 0;

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

    if (result.mode === "live") live += 1;
    if (result.mode === "crawl-derived") crawlDerived += 1;

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
          features: result.features,
        } as Prisma.InputJsonValue,
      },
    });

    const allowedFeatures = new Set([
      "AI_OVERVIEW",
      "FEATURED_SNIPPET",
      "PEOPLE_ALSO_ASK",
      "LOCAL_PACK",
      "IMAGE_PACK",
      "VIDEO",
      "REVIEWS",
      "KNOWLEDGE_PANEL",
      "SHOPPING",
      "SITELINKS",
    ]);
    for (const feature of result.features) {
      if (!allowedFeatures.has(feature.type)) continue;
      await prisma.sERPFeature.create({
        data: {
          keywordId: kw.id,
          type: feature.type as
            | "AI_OVERVIEW"
            | "FEATURED_SNIPPET"
            | "PEOPLE_ALSO_ASK"
            | "LOCAL_PACK"
            | "IMAGE_PACK"
            | "VIDEO"
            | "REVIEWS"
            | "KNOWLEDGE_PANEL"
            | "SHOPPING"
            | "SITELINKS",
          present: feature.present,
          metadata: (feature.metadata || {}) as Prisma.InputJsonValue,
        },
      });
    }

    // Persist top organics as competitor organic snapshots for research tools
    if (result.mode === "live" && result.organics.length) {
      for (const org of result.organics.slice(0, 8)) {
        if (!org.url) continue;
        await prisma.organicSnapshot.create({
          data: {
            siteId,
            competitorDomain: org.domain === site.domain.replace(/^www\./, "") ? null : org.domain,
            keyword: kw.phrase,
            position: org.position,
            url: org.url,
            trafficShare: Math.max(0.005, (21 - Math.min(org.position, 20)) / 100),
            volume: kw.volume ?? 0,
          },
        });
      }
    }

    checked += 1;
  }

  return { siteId, checked, live, crawlDerived, domain: site.domain };
}
