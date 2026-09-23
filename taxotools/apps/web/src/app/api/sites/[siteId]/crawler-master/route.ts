import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/server/http";
import {
  initCrawlerMaster,
  executeCrawlerMasterRun,
  summarizeCrawlerMaster,
} from "@/server/services/crawler-master.service";
import { CRAWLER_MASTER_MODES, type CrawlerMasterMode } from "@taxotools/shared";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    void user;
    return jsonOk(await summarizeCrawlerMaster(siteId));
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const body = z
      .object({
        action: z.enum(["init", "run", "summary"]).default("init"),
        enable: z.array(z.string()).optional(),
        modules: z.array(z.string()).optional(),
        providers: z.array(z.string()).optional(),
        ukDirectories: z.array(z.string()).optional(),
        accountingDirectories: z.array(z.string()).optional(),
        govSources: z.array(z.string()).optional(),
        queues: z.array(z.string()).optional(),
        workers: z.array(z.string()).optional(),
        dbSchema: z.array(z.string()).optional(),
        crawlModes: z.array(z.string()).optional(),
        frequency: z.string().optional(),
        maxDepth: z.number().int().positive().optional(),
        parallelThreads: z.number().int().positive().optional(),
        respectRobots: z.boolean().optional(),
        extract: z.array(z.string()).optional(),
        storeFormat: z.string().optional(),
        autoClean: z.boolean().optional(),
        errorRetry: z.number().int().min(0).optional(),
        logLevel: z.string().optional(),
        mode: z.string().optional(),
      })
      .parse(await req.json().catch(() => ({ action: "init" })));

    if (body.action === "summary") {
      return jsonOk(await summarizeCrawlerMaster(siteId));
    }

    if (body.action === "run") {
      const mode = (
        body.mode && (CRAWLER_MASTER_MODES as readonly string[]).includes(body.mode)
          ? body.mode
          : "live"
      ) as CrawlerMasterMode;
      return jsonOk(await executeCrawlerMasterRun(user.id, siteId, mode));
    }

    return jsonOk(
      await initCrawlerMaster(user.id, siteId, {
        enable: body.enable,
        modules: body.modules,
        providers: body.providers,
        ukDirectories: body.ukDirectories,
        accountingDirectories: body.accountingDirectories,
        govSources: body.govSources,
        queues: body.queues,
        workers: body.workers,
        dbSchema: body.dbSchema,
        crawlModes: body.crawlModes,
        frequency: body.frequency,
        maxDepth: body.maxDepth,
        parallelThreads: body.parallelThreads,
        respectRobots: body.respectRobots,
        extract: body.extract,
        storeFormat: body.storeFormat,
        autoClean: body.autoClean,
        errorRetry: body.errorRetry,
        logLevel: body.logLevel,
        mode: body.mode,
      }),
    );
  } catch (err) {
    return jsonError(err);
  }
}
