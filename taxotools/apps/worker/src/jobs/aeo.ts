import { prisma } from "@taxotools/database";
import { scanAeoPrompt } from "@taxotools/integrations";

/**
 * AEO/GEO scanner — uses OpenAI when OPENAI_API_KEY is set,
 * otherwise stores honest heuristic visibility samples.
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
  let live = 0;

  for (const prompt of prompts) {
    for (const engine of engines) {
      const result = await scanAeoPrompt({
        prompt,
        engineCode: engine.code,
        brand,
        domain,
      });
      if (result.mode === "live") live += 1;

      await prisma.aIVisibilityRecord.create({
        data: {
          siteId,
          engineId: engine.id,
          prompt,
          brandMentioned: result.brandMentioned,
          sentiment: result.sentiment,
          shareOfVoice: result.shareOfVoice,
          rawAnswer: result.rawAnswer,
          metadata: { mode: result.mode, source: result.source, engine: engine.code },
          citations: {
            create: result.citations.map((c) => ({
              engineId: engine.id,
              citedUrl: c.citedUrl,
              citedBrand: c.citedBrand,
              isOwnBrand: c.isOwnBrand,
              position: c.position,
            })),
          },
        },
      });
      created += 1;
    }
  }

  return { siteId, recordsCreated: created, live };
}
