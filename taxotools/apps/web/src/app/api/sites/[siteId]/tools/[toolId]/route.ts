import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { findTool } from "@taxotools/shared";
import { runTool, triggerToolAction } from "@/server/services/toolkit.service";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ siteId: string; toolId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId, toolId } = await ctx.params;
    if (!findTool(toolId)) return jsonError(new Error("Unknown tool"));
    const result = await runTool(user.id, siteId, toolId);
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ siteId: string; toolId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId, toolId } = await ctx.params;
    if (!findTool(toolId)) return jsonError(new Error("Unknown tool"));
    const body = z
      .object({
        action: z.string().optional(),
        input: z.record(z.unknown()).optional(),
      })
      .parse(await req.json().catch(() => ({})));

    if (body.action) {
      const result = await triggerToolAction(
        user.id,
        siteId,
        toolId,
        body.action,
        body.input || {},
      );
      return jsonOk({ result });
    }

    const result = await runTool(user.id, siteId, toolId, body.input || {});
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}
