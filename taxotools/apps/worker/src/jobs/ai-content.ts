import { prisma } from "@taxotools/database";
import { generateSeoContent } from "@taxotools/integrations";

export async function processAIContent(payload: Record<string, unknown>) {
  const aiJobId = String(payload.aiJobId);
  const type = String(payload.type || "ARTICLE");
  const input = (payload.input || {}) as Record<string, unknown>;

  await prisma.aIJob.update({
    where: { id: aiJobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const siteId = String(payload.siteId || "");
  const site = siteId
    ? await prisma.site.findUnique({ where: { id: siteId }, select: { name: true, domain: true } })
    : null;

  try {
    const generated = await generateSeoContent({
      type,
      keyword: String(input.keyword || "seo"),
      title: input.title ? String(input.title) : undefined,
      tone: input.tone ? String(input.tone) : undefined,
      brand: site?.name,
      domain: site?.domain,
      extra: input,
    });

    const job = await prisma.aIJob.update({
      where: { id: aiJobId },
      data: {
        status: "COMPLETED",
        outputJson: {
          ...generated.output,
          _meta: { mode: generated.mode, source: generated.source },
        } as object,
        finishedAt: new Date(),
      },
    });

    return { aiJobId: job.id, type, mode: generated.mode, source: generated.source };
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI content failed";
    await prisma.aIJob.update({
      where: { id: aiJobId },
      data: {
        status: "FAILED",
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
    throw e;
  }
}
