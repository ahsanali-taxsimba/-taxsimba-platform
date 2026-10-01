import { prisma } from "@taxotools/database";
import {
  CRAWLER_MASTER_QUEUE_WORKER_MAP,
  type CrawlerMasterQueue,
} from "@taxotools/shared";

/**
 * Handles named seo.crawler.master pipeline queues:
 * crawl.urls | crawl.api.backlinks | crawl.api.serp | crawl.api.index | process.raw | alerts.events
 */
export async function processCrawlerPipeline(data: {
  siteId?: string;
  runId?: string;
  mode?: string;
  worker?: string;
  queue?: string;
  modules?: string[];
  providers?: string[];
  maxDepth?: number;
  parallelThreads?: number;
  backgroundJobId?: string;
}) {
  const queue = (data.queue || "crawl.urls") as CrawlerMasterQueue;
  const worker =
    data.worker ||
    CRAWLER_MASTER_QUEUE_WORKER_MAP[queue] ||
    "url_crawler";

  if (data.siteId && data.runId) {
    await prisma.crawlerLog.create({
      data: {
        siteId: data.siteId,
        runId: data.runId,
        queue,
        worker,
        level: "info",
        message: `pipeline worker=${worker} queue=${queue} mode=${data.mode || "live"}`,
        meta: {
          modules: data.modules || [],
          providers: data.providers || [],
          maxDepth: data.maxDepth,
          parallelThreads: data.parallelThreads,
        },
      },
    });
  }

  return {
    ok: true,
    queue,
    worker,
    siteId: data.siteId || null,
    runId: data.runId || null,
    mode: data.mode || "live",
    at: new Date().toISOString(),
  };
}
