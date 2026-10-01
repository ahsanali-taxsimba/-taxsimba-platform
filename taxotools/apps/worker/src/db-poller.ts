import { prisma } from "@taxotools/database";
import { processCrawl } from "./jobs/crawl";
import { processRankCheck } from "./jobs/rank";
import { processAIContent } from "./jobs/ai-content";
import { processAeoScan } from "./jobs/aeo";
import { processReport } from "./jobs/report";
import { processCrawlerMaster } from "./jobs/crawler-master";
import { processCrawlerPipeline } from "./jobs/crawler-pipeline";
import { processBacklinkRefresh } from "./jobs/backlinks";
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
        case JOB_QUEUES.BACKLINK_REFRESH:
          result = await processBacklinkRefresh(payload);
          break;
        case JOB_QUEUES.CRAWLER_MASTER:
          result = await processCrawlerMaster(payload);
          break;
        case JOB_QUEUES.CRAWL_URLS:
        case JOB_QUEUES.CRAWL_API_BACKLINKS:
        case JOB_QUEUES.CRAWL_API_SERP:
        case JOB_QUEUES.CRAWL_API_INDEX:
        case JOB_QUEUES.PROCESS_RAW:
        case JOB_QUEUES.ALERTS_EVENTS:
          result = await processCrawlerPipeline({
            ...payload,
            queue: (payload.queue as string) || job.queue,
          });
          break;
        default:
          // Soft-ack unknown/automation queues so they don't stick in QUEUED forever
          result = { ok: true, queue: job.queue, polled: true };
          break;
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
