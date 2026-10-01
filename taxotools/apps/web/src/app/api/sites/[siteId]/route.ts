import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { siteHealthSummary } from "@/server/services/crawl.service";
import { aeoShareOfVoice } from "@/server/services/aeo.service";
import { prisma } from "@taxotools/database";
import { jsonError, jsonOk } from "@/server/http";

export const preferredRegion = ["lhr1"];

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const [site, health, sov, latestRanks] = await Promise.all([
      getSiteForUser(user.id, siteId),
      siteHealthSummary(user.id, siteId),
      aeoShareOfVoice(user.id, siteId),
      prisma.rankRecord.findMany({
        where: { keyword: { siteId } },
        orderBy: { checkedAt: "desc" },
        take: 10,
        include: { keyword: { select: { id: true, phrase: true, locale: true } } },
      }),
    ]);

    return jsonOk({
      site,
      health,
      aeoShareOfVoice: sov,
      keywordCount: site._count.keywords,
      latestRanks,
    });
  } catch (err) {
    return jsonError(err);
  }
}
