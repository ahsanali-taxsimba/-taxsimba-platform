import { Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { JOB_QUEUES } from "@taxotools/shared";
import { prisma } from "@taxotools/database";
import { processCrawl } from "./jobs/crawl";
import { processRankCheck } from "./jobs/rank";
import { processAIContent } from "./jobs/ai-content";
import { processAeoScan } from "./jobs/aeo";
import { processReport } from "./jobs/report";
import { processBacklinkRefresh } from "./jobs/backlinks";
import { processCrawlerMaster } from "./jobs/crawler-master";
import { processCrawlerPipeline } from "./jobs/crawler-pipeline";
import { pollDbJobs } from "./db-poller";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";

async function markJob(
  backgroundJobId: string | undefined,
  status: "RUNNING" | "COMPLETED" | "FAILED",
  extra: { result?: unknown; errorMessage?: string } = {},
) {
  if (!backgroundJobId) return;
  await prisma.backgroundJob.update({
    where: { id: backgroundJobId },
    data: {
      status,
      ...(status === "RUNNING" ? { startedAt: new Date(), attempts: { increment: 1 } } : {}),
      ...(status === "COMPLETED"
        ? { finishedAt: new Date(), result: extra.result as object | undefined }
        : {}),
      ...(status === "FAILED"
        ? { finishedAt: new Date(), errorMessage: extra.errorMessage }
        : {}),
    },
  });
}

function createWorkers(connection: IORedis) {
  const concurrency = Number(process.env.WORKER_CONCURRENCY || 5);
  const conn = connection as unknown as ConnectionOptions;

  new Worker(
    JOB_QUEUES.CRAWL,
    async (job) => {
      await markJob(job.data.backgroundJobId, "RUNNING");
      try {
        const result = await processCrawl(job.data);
        await markJob(job.data.backgroundJobId, "COMPLETED", { result });
        return result;
      } catch (e) {
        await markJob(job.data.backgroundJobId, "FAILED", {
          errorMessage: e instanceof Error ? e.message : "crawl failed",
        });
        throw e;
      }
    },
    { connection: conn, concurrency },
  );

  new Worker(
    JOB_QUEUES.RANK,
    async (job) => {
      await markJob(job.data.backgroundJobId, "RUNNING");
      try {
        const result = await processRankCheck(job.data);
        await markJob(job.data.backgroundJobId, "COMPLETED", { result });
        return result;
      } catch (e) {
        await markJob(job.data.backgroundJobId, "FAILED", {
          errorMessage: e instanceof Error ? e.message : "rank failed",
        });
        throw e;
      }
    },
    { connection: conn, concurrency },
  );

  new Worker(
    JOB_QUEUES.AI_CONTENT,
    async (job) => {
      await markJob(job.data.backgroundJobId, "RUNNING");
      try {
        const result = await processAIContent(job.data);
        await markJob(job.data.backgroundJobId, "COMPLETED", { result });
        return result;
      } catch (e) {
        await markJob(job.data.backgroundJobId, "FAILED", {
          errorMessage: e instanceof Error ? e.message : "ai failed",
        });
        throw e;
      }
    },
    { connection: conn, concurrency },
  );

  new Worker(
    JOB_QUEUES.AEO_SCAN,
    async (job) => {
      await markJob(job.data.backgroundJobId, "RUNNING");
      try {
        const result = await processAeoScan(job.data);
        await markJob(job.data.backgroundJobId, "COMPLETED", { result });
        return result;
      } catch (e) {
        await markJob(job.data.backgroundJobId, "FAILED", {
          errorMessage: e instanceof Error ? e.message : "aeo failed",
        });
        throw e;
      }
    },
    { connection: conn, concurrency },
  );

  new Worker(
    JOB_QUEUES.REPORT,
    async (job) => {
      await markJob(job.data.backgroundJobId, "RUNNING");
      try {
        const result = await processReport(job.data);
        await markJob(job.data.backgroundJobId, "COMPLETED", { result });
        return result;
      } catch (e) {
        await markJob(job.data.backgroundJobId, "FAILED", {
          errorMessage: e instanceof Error ? e.message : "report failed",
        });
        throw e;
      }
    },
    { connection: conn, concurrency },
  );

  new Worker(
    JOB_QUEUES.BACKLINK_REFRESH,
    async (job) => {
      await markJob(job.data.backgroundJobId, "RUNNING");
      try {
        const result = await processBacklinkRefresh(job.data);
        await markJob(job.data.backgroundJobId, "COMPLETED", { result });
        return result;
      } catch (e) {
        await markJob(job.data.backgroundJobId, "FAILED", {
          errorMessage: e instanceof Error ? e.message : "backlink refresh failed",
        });
        throw e;
      }
    },
    { connection: conn, concurrency },
  );

  new Worker(
    JOB_QUEUES.CRAWLER_MASTER,
    async (job) => {
      await markJob(job.data.backgroundJobId, "RUNNING");
      try {
        const result = await processCrawlerMaster(job.data);
        await markJob(job.data.backgroundJobId, "COMPLETED", { result });
        return result;
      } catch (e) {
        await markJob(job.data.backgroundJobId, "FAILED", {
          errorMessage: e instanceof Error ? e.message : "crawler master failed",
        });
        throw e;
      }
    },
    { connection: conn, concurrency },
  );

  // Named seo.crawler.master.init pipeline queues → workers
  for (const queue of [
    JOB_QUEUES.CRAWL_URLS,
    JOB_QUEUES.CRAWL_API_BACKLINKS,
    JOB_QUEUES.CRAWL_API_SERP,
    JOB_QUEUES.CRAWL_API_INDEX,
    JOB_QUEUES.PROCESS_RAW,
    JOB_QUEUES.ALERTS_EVENTS,
  ] as const) {
    new Worker(
      queue,
      async (job) => {
        await markJob(job.data.backgroundJobId, "RUNNING");
        try {
          const result = await processCrawlerPipeline({
            ...job.data,
            queue: job.data.queue || queue,
          });
          await markJob(job.data.backgroundJobId, "COMPLETED", { result });
          return result;
        } catch (e) {
          await markJob(job.data.backgroundJobId, "FAILED", {
            errorMessage: e instanceof Error ? e.message : `${queue} failed`,
          });
          throw e;
        }
      },
      { connection: conn, concurrency },
    );
  }

  for (const queue of [
    JOB_QUEUES.AUTO_SEO,
    JOB_QUEUES.CMS_PUBLISH,
    JOB_QUEUES.SMART_ADS,
    JOB_QUEUES.WILDFIRE,
    JOB_QUEUES.HYPERDRIVE,
    JOB_QUEUES.QUEST,
    JOB_QUEUES.INSTANT_INDEX,
    JOB_QUEUES.ALERTS,
    JOB_QUEUES.BACKLINK,
  ] as const) {
    new Worker(
      queue,
      async (job) => {
        await markJob(job.data.backgroundJobId, "RUNNING");
        try {
          const result = { ok: true, queue, name: job.name, at: new Date().toISOString() };
          await markJob(job.data.backgroundJobId, "COMPLETED", { result });
          return result;
        } catch (e) {
          await markJob(job.data.backgroundJobId, "FAILED", {
            errorMessage: e instanceof Error ? e.message : `${queue} failed`,
          });
          throw e;
        }
      },
      { connection: conn, concurrency },
    );
  }
}

async function main() {
  console.log("[taxotools-worker] starting…");

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    await connection.connect();
    createWorkers(connection);
    console.log("[taxotools-worker] BullMQ workers online");
  } catch (err) {
    console.warn(
      "[taxotools-worker] Redis unavailable — falling back to DB poller only",
      err instanceof Error ? err.message : err,
    );
  }

  // Always poll BackgroundJob for resilience when Redis is down
  setInterval(() => {
    pollDbJobs().catch((e) => console.error("[db-poller]", e));
  }, 5000);

  console.log("[taxotools-worker] ready");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
