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

/**
 * Claim DB-only QUEUED jobs (jobId null) so work still runs when Redis is down.
 * BullMQ-enqueued jobs get a Redis job id and are left for workers.
 */
export async function pollDbJobs() {
  const queued = await prisma.backgroundJob.findMany({
    where: { status: "QUEUED", jobId: null },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  for (const job of queued) {
    const claimed = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: "QUEUED", jobId: null },
      data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

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
          result = {
            ok: false,
            queue: job.queue,
            stub: true,
            message: `No live worker handler for queue ${job.queue} yet`,
          };
          break;
      }

      const failedStub =
        typeof result === "object" &&
        result !== null &&
        "stub" in result &&
        (result as { stub?: boolean }).stub === true;

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: failedStub ? "FAILED" : "COMPLETED",
          finishedAt: new Date(),
          result: result as object,
          errorMessage: failedStub
            ? String((result as { message?: string }).message || "Stub queue — not implemented")
            : null,
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
