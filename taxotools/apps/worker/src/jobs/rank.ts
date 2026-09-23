import { prisma } from "@taxotools/database";

export async function processRankCheck(payload: Record<string, unknown>) {
  const siteId = String(payload.siteId);
  const keywords = await prisma.keyword.findMany({
    where: { siteId, tracking: true },
  });

  let checked = 0;
  for (const kw of keywords) {
    const prev = await prisma.rankRecord.findFirst({
      where: { keywordId: kw.id },
      orderBy: { checkedAt: "desc" },
    });
    // Deterministic pseudo-rank for demos; replace with SERP API
    const seed = [...kw.phrase].reduce((a, c) => a + c.charCodeAt(0), 0);
    const position = (seed % 40) + 1;
    const hasAiOverview = seed % 3 === 0;

    await prisma.rankRecord.create({
      data: {
        keywordId: kw.id,
        position,
        previousPosition: prev?.position ?? null,
        url: `https://example.com/${kw.phrase.replace(/\s+/g, "-")}`,
        hasAiOverview,
        shareOfVoice: Math.max(0, (41 - position) / 40),
        serpJson: { source: "stub", device: kw.device },
      },
    });

    if (hasAiOverview) {
      await prisma.sERPFeature.create({
        data: {
          keywordId: kw.id,
          type: "AI_OVERVIEW",
          present: true,
          metadata: { cited: seed % 2 === 0 },
        },
      });
    }
    checked += 1;
  }

  return { siteId, checked };
}
