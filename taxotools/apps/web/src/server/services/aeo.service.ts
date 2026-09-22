import { prisma } from "@taxotools/database";
import { getSiteForUser } from "@/server/services/tenant.service";
import { assertWithinLimit, incrementUsage } from "@/server/services/usage.service";
import { enqueueJob } from "@/server/queue";

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

  const job = await enqueueJob({
    queue: "taxotools-aeo-scan",
    name: "aeo-visibility-scan",
    payload: {
      siteId: site.id,
      accountId: site.workspace.accountId,
      brand: site.name,
      domain: site.domain,
      prompts,
      engineIds: engines.map((e) => e.id),
    },
  });

  await incrementUsage(site.workspace.accountId, "AEO_SCANS", prompts.length);
  return { job, engines, promptCount: prompts.length };
}

export async function listVisibility(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  return prisma.aIVisibilityRecord.findMany({
    where: { siteId },
    include: { engine: true, citations: true },
    orderBy: { checkedAt: "desc" },
    take: 100,
  });
}

export async function aeoShareOfVoice(userId: string, siteId: string) {
  const records = await listVisibility(userId, siteId);
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
