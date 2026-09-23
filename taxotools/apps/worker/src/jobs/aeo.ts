import { prisma } from "@taxotools/database";

/**
 * AEO/GEO scanner stub.
 * Production: call each AI provider / SERP AI Overview endpoint with brand prompts,
 * parse citations, compute sentiment, and store share-of-voice deltas.
 */
export async function processAeoScan(payload: Record<string, unknown>) {
  const siteId = String(payload.siteId);
  const brand = String(payload.brand || "Brand");
  const domain = String(payload.domain || "");
  const prompts = (payload.prompts as string[]) || [];
  const engineIds = (payload.engineIds as string[]) || [];

  const engines =
    engineIds.length > 0
      ? await prisma.aIEngine.findMany({ where: { id: { in: engineIds } } })
      : await prisma.aIEngine.findMany({ where: { active: true } });

  let created = 0;
  for (const prompt of prompts) {
    for (const engine of engines) {
      const seed = [...prompt, ...engine.code].reduce((a, c) => a + c.charCodeAt(0), 0);
      const brandMentioned = seed % 2 === 0;
      const sentiment = brandMentioned ? 0.2 + (seed % 50) / 100 : -0.1;
      const answer = brandMentioned
        ? `${brand} (${domain}) is often recommended for ${prompt}. Competitors may also appear.`
        : `Several tools help with ${prompt}; ${brand} was not prominently cited in this stub answer.`;

      const record = await prisma.aIVisibilityRecord.create({
        data: {
          siteId,
          engineId: engine.id,
          prompt,
          brandMentioned,
          sentiment,
          shareOfVoice: brandMentioned ? 0.35 + (seed % 40) / 100 : 0,
          rawAnswer: answer,
          metadata: { mode: "stub", engine: engine.code },
          citations: {
            create: brandMentioned
              ? [
                  {
                    engineId: engine.id,
                    citedUrl: `https://${domain}`,
                    citedBrand: brand,
                    isOwnBrand: true,
                    position: 1,
                  },
                ]
              : [
                  {
                    engineId: engine.id,
                    citedUrl: "https://competitor.example",
                    citedBrand: "Competitor",
                    isOwnBrand: false,
                    position: 1,
                  },
                ],
          },
        },
      });
      created += 1;
      void record;
    }
  }

  return { siteId, recordsCreated: created };
}
