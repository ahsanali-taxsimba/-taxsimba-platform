import { prisma } from "@taxotools/database";
import { scanAeoPrompt, listSeoProviderStatuses } from "@taxotools/integrations";
import { getSiteForUser } from "@/server/services/tenant.service";
import { assertWithinLimit, incrementUsage } from "@/server/services/usage.service";
import { enqueueJob } from "@/server/queue";

async function runAeoScanInline(payload: {
  siteId: string;
  brand: string;
  domain: string;
  prompts: string[];
  engineIds: string[];
}) {
  const engines =
    payload.engineIds.length > 0
      ? await prisma.aIEngine.findMany({ where: { id: { in: payload.engineIds } } })
      : await prisma.aIEngine.findMany({ where: { active: true } });

  let created = 0;
  let live = 0;
  for (const prompt of payload.prompts) {
    for (const engine of engines) {
      const result = await scanAeoPrompt({
        prompt,
        engineCode: engine.code,
        brand: payload.brand,
        domain: payload.domain,
      });
      if (result.mode === "live") live += 1;
      await prisma.aIVisibilityRecord.create({
        data: {
          siteId: payload.siteId,
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
  return { siteId: payload.siteId, recordsCreated: created, live, providers: listSeoProviderStatuses() };
}

export async function startAeoScan(params: {
  userId: string;
  siteId: string;
  prompts: string[];
  engineCodes?: string[];
}) {
  const site = await getSiteForUser(params.userId, params.siteId);
  const prompts = params.prompts.map((p) => p.trim()).filter(Boolean);
  if (!prompts.length) throw new Error("At least one prompt is required");

  await assertWithinLimit(site.workspace.accountId, "AEO_SCANS", prompts.length);

  const engines = await prisma.aIEngine.findMany({
    where: {
      active: true,
      ...(params.engineCodes?.length ? { code: { in: params.engineCodes } } : {}),
    },
  });

  const payload = {
    siteId: site.id,
    accountId: site.workspace.accountId,
    brand: site.name,
    domain: site.domain,
    prompts,
    engineIds: engines.map((e) => e.id),
  };

  const job = await enqueueJob({
    queue: "taxotools-aeo-scan",
    name: "aeo-visibility-scan",
    payload,
  });

  await incrementUsage(site.workspace.accountId, "AEO_SCANS", prompts.length);

  if (job.transport === "db") {
    try {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
      });
      const result = await runAeoScanInline(payload);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          result: { ...result, transport: "inline" },
          errorMessage: null,
        },
      });
      return { job: Object.assign(job, { transport: "inline" as const }), engines, promptCount: prompts.length, result };
    } catch (e) {
      const message = e instanceof Error ? e.message : "inline AEO scan failed";
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
      });
      throw e;
    }
  }

  return { job, engines, promptCount: prompts.length };
}

export async function listVisibility(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  return prisma.aIVisibilityRecord.findMany({
    where: { siteId },
    include: { engine: { select: { id: true, code: true, name: true } }, citations: true },
    orderBy: { checkedAt: "desc" },
    take: 50,
  });
}

export async function aeoShareOfVoice(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  // Aggregate in SQL instead of pulling full citation graphs.
  const records = await prisma.aIVisibilityRecord.findMany({
    where: { siteId },
    select: {
      brandMentioned: true,
      engine: { select: { code: true, name: true } },
    },
    orderBy: { checkedAt: "desc" },
    take: 200,
  });
  const byEngine = new Map<string, { mentioned: number; total: number; name: string }>();
  for (const r of records) {
    const key = r.engine.code;
    const cur = byEngine.get(key) ?? { mentioned: 0, total: 0, name: r.engine.name };
    cur.total += 1;
    if (r.brandMentioned) cur.mentioned += 1;
    byEngine.set(key, cur);
  }
  return [...byEngine.entries()].map(([code, v]) => ({
    code,
    name: v.name,
    shareOfVoice: v.total ? v.mentioned / v.total : 0,
    samples: v.total,
  }));
}
