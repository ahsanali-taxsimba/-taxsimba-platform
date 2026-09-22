import { requireUser } from "@/lib/auth";
import { getSiteForUser } from "@/server/services/tenant.service";
import { siteHealthSummary } from "@/server/services/crawl.service";
import { aeoShareOfVoice } from "@/server/services/aeo.service";
import { prisma } from "@taxotools/database";
import { jsonError, jsonOk } from "@/server/http";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ siteId: string }> },
) {
  try {
    const user = await requireUser();
    const { siteId } = await ctx.params;
    const site = await getSiteForUser(user.id, siteId);
    const health = await siteHealthSummary(user.id, siteId);
    const sov = await aeoShareOfVoice(user.id, siteId);
    const keywordCount = site._count.keywords;
    const latestRanks = await prisma.rankRecord.findMany({
      where: { keyword: { siteId } },
      orderBy: { checkedAt: "desc" },
      take: 10,
      include: { keyword: true },
    });

    return jsonOk({
      site,
      health,
      aeoShareOfVoice: sov,
      keywordCount,
      latestRanks,
    });
  } catch (err) {
    return jsonError(err);
  }
}
