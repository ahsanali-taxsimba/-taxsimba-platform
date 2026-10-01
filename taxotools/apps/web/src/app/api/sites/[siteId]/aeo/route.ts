import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { startAeoScan, listVisibility, aeoShareOfVoice } from "@/server/services/aeo.service";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const [records, shareOfVoice] = await Promise.all([
      listVisibility(user.id, siteId),
      aeoShareOfVoice(user.id, siteId),
    ]);
    return jsonOk({ records, shareOfVoice });
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
        prompts: z.array(z.string()).min(1),
        engineCodes: z.array(z.string()).optional(),
      })
      .parse(await req.json());
    const result = await startAeoScan({
      userId: user.id,
      siteId,
      prompts: body.prompts,
      engineCodes: body.engineCodes,
    });
    return jsonOk(result, 201);
  } catch (err) {
    return jsonError(err);
  }
}
