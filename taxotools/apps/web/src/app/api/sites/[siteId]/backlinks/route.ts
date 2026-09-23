import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/server/http";
import {
  initBacklinkEngine,
  refreshBacklinks,
  summarizeBacklinks,
  exportDisavowFile,
  listCompetitorBacklinks,
} from "@/server/services/backlinks.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const data = await summarizeBacklinks(siteId);
    return jsonOk(data);
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
        action: z
          .enum(["init", "refresh", "disavow_export", "competitors", "summary"])
          .default("init"),
        sourceApis: z.array(z.string()).optional(),
        crawlMode: z.string().optional(),
        refreshInterval: z.string().optional(),
        enableDisavow: z.boolean().optional(),
        enableCompetitorMonitoring: z.boolean().optional(),
        competitors: z.array(z.string()).optional(),
      })
      .parse(await req.json().catch(() => ({ action: "init" })));

    if (body.action === "refresh") {
      return jsonOk(await refreshBacklinks(user.id, siteId));
    }
    if (body.action === "disavow_export") {
      return jsonOk(await exportDisavowFile(user.id, siteId));
    }
    if (body.action === "competitors") {
      return jsonOk(await listCompetitorBacklinks(user.id, siteId));
    }
    if (body.action === "summary") {
      return jsonOk(await summarizeBacklinks(siteId));
    }

    return jsonOk(
      await initBacklinkEngine(user.id, siteId, {
        sourceApis: body.sourceApis,
        crawlMode: body.crawlMode,
        refreshInterval: body.refreshInterval,
        enableDisavow: body.enableDisavow,
        enableCompetitorMonitoring: body.enableCompetitorMonitoring,
        competitors: body.competitors,
      }),
    );
  } catch (err) {
    return jsonError(err);
  }
}
