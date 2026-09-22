import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { startCrawl, listCrawls, getCrawlIssues } from "@/server/services/crawl.service";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const crawlId = new URL(req.url).searchParams.get("crawlId");
    if (crawlId) {
      const issues = await getCrawlIssues(user.id, siteId, crawlId);
      return jsonOk({ issues });
    }
    const crawls = await listCrawls(user.id, siteId);
    return jsonOk({ crawls });
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
      .object({ maxPages: z.number().int().min(1).max(5000).optional() })
      .parse(await req.json().catch(() => ({})));
    const crawl = await startCrawl({ userId: user.id, siteId, maxPages: body.maxPages });
    return jsonOk({ crawl }, 201);
  } catch (err) {
    return jsonError(err);
  }
}
