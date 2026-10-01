import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAIJob, listAIJobs, scoreContent, generateArticleStub } from "@/server/services/ai-content.service";
import { prisma } from "@taxotools/database";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const jobs = await listAIJobs(user.id, siteId);
    return jsonOk({ jobs });
  } catch (err) {
    return jsonError(err);
  }
}

const schema = z.object({
  type: z.enum([
    "ARTICLE",
    "OUTLINE",
    "META",
    "FAQ",
    "SCHEMA",
    "BULK_ARTICLES",
    "PROGRAMMATIC",
    "SOCIAL_POST",
    "AD_COPY",
    "CONTENT_SCORE",
  ]),
  input: z.record(z.unknown()),
  sync: z.boolean().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const body = schema.parse(await req.json());

    if (body.type === "CONTENT_SCORE") {
      const page = await scoreContent({
        userId: user.id,
        siteId,
        url: String(body.input.url || "https://example.com/page"),
        targetKeyword: String(body.input.keyword || "seo"),
        text: String(body.input.text || ""),
      });
      return jsonOk({ page });
    }

    const job = await createAIJob({
      userId: user.id,
      siteId,
      type: body.type,
      input: body.input,
    });

    if (body.sync && body.type === "ARTICLE") {
      const output = generateArticleStub({
        keyword: String(body.input.keyword || "seo"),
        title: body.input.title ? String(body.input.title) : undefined,
        tone: body.input.tone ? String(body.input.tone) : undefined,
      });
      const updated = await prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          outputJson: output as object,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      });
      return jsonOk({ job: updated });
    }

    return jsonOk({ job }, 201);
  } catch (err) {
    return jsonError(err);
  }
}
