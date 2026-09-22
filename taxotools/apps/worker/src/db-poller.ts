import { prisma } from "@taxotools/database";
import { processCrawl } from "./jobs/crawl";
import { processRankCheck } from "./jobs/rank";
import { processAIContent } from "./jobs/ai-content";
import { processAeoScan } from "./jobs/aeo";
import { processReport } from "./jobs/report";
import { JOB_QUEUES } from "@taxotools/shared";

export async function pollDbJobs() {
  const queued = await prisma.backgroundJob.findMany({
    where: { status: "QUEUED", jobId: null },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  for (const job of queued) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      const payload = job.payload as Record<string, unknown>;
      let result: unknown;
      switch (job.queue) {
        case JOB_QUEUES.CRAWL:
          result = await processCrawl(payload);
          break;
        case JOB_QUEUES.RANK:
          result = await processRankCheck(payload);
          break;
        case JOB_QUEUES.AI_CONTENT:
          result = await processAIContent(payload);
          break;
        case JOB_QUEUES.AEO_SCAN:
          result = await processAeoScan(payload);
          break;
        case JOB_QUEUES.REPORT:
          result = await processReport(payload);
          break;
        default:
          throw new Error(`Unknown queue ${job.queue}`);
      }
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          result: result as object,
        },
      });
    } catch (e) {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMessage: e instanceof Error ? e.message : "failed",
        },
      });
    }
  }
}
