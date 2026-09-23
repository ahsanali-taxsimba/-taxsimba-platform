import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addKeywords, listKeywords, clusterKeywords, enqueueRankCheck, keywordGap } from "@/server/services/keyword.service";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const keywords = await listKeywords(user.id, siteId);
    return jsonOk({ keywords });
  } catch (err) {
    return jsonError(err);
  }
}

const postSchema = z.object({
  phrases: z.array(z.string()).min(1),
  locale: z.string().optional(),
  device: z.enum(["DESKTOP", "MOBILE"]).optional(),
  location: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const body = postSchema.parse(await req.json());
    const keywords = await addKeywords({ userId: user.id, siteId, ...body });
    return jsonOk({ keywords }, 201);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const body = z
      .object({
        action: z.enum(["cluster", "rank-check", "gap"]),
        competitorDomain: z.string().optional(),
      })
      .parse(await req.json());

    if (body.action === "cluster") {
      return jsonOk({ clusters: await clusterKeywords(user.id, siteId) });
    }
    if (body.action === "rank-check") {
      return jsonOk({ job: await enqueueRankCheck(user.id, siteId) });
    }
    return jsonOk({
      gap: await keywordGap(user.id, siteId, body.competitorDomain || "competitor.com"),
    });
  } catch (err) {
    return jsonError(err);
  }
}
