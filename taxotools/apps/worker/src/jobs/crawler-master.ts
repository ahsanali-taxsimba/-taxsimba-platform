import { prisma } from "@taxotools/database";
import { CRAWLER_MASTER_DEFAULTS } from "@taxotools/shared";

export async function processCrawlerMaster(data: {
  siteId?: string;
  runId?: string;
  mode?: string;
  backgroundJobId?: string;
}) {
  if (!data.siteId) {
    const due = await prisma.crawlerMasterConfig.findMany({
      where: {
        status: "active",
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
      },
      take: 20,
    });
    return {
      due: due.length,
      siteIds: due.map((d) => d.siteId),
      defaults: {
        frequency: CRAWLER_MASTER_DEFAULTS.frequency,
        maxDepth: CRAWLER_MASTER_DEFAULTS.maxDepth,
        threads: CRAWLER_MASTER_DEFAULTS.parallelThreads,
      },
    };
  }

  const config = await prisma.crawlerMasterConfig.findUnique({ where: { siteId: data.siteId } });
  if (!config) return { siteId: data.siteId, skipped: true };

  if (data.runId) {
    const run = await prisma.crawlerMasterRun.findUnique({ where: { id: data.runId } });
    return {
      siteId: data.siteId,
      runId: data.runId,
      status: run?.status,
      pagesCrawled: run?.pagesCrawled,
      extractsStored: run?.extractsStored,
    };
  }

  await prisma.crawlerMasterConfig.update({
    where: { siteId: data.siteId },
    data: {
      nextRunAt: new Date(Date.now() + config.frequencyHours * 3600 * 1000),
    },
  });

  return { siteId: data.siteId, scheduled: true, mode: data.mode || "scheduled" };
}
