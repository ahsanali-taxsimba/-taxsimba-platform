import { prisma } from "@taxotools/database";
import { BACKLINK_SOURCE_APIS, computeBacklinkScore, classifyBacklink } from "@taxotools/shared";

/**
 * Worker-side refresh for sites whose nextRefreshAt is due.
 * Full provider fetch lives in web backlinks.service; here we re-score and
 * mark overdue engines for the next poll cycle.
 */
export async function processBacklinkRefresh(data: {
  siteId?: string;
  backgroundJobId?: string;
}) {
  if (!data.siteId) {
    const due = await prisma.backlinkEngineConfig.findMany({
      where: {
        status: "active",
        OR: [{ nextRefreshAt: null }, { nextRefreshAt: { lte: new Date() } }],
      },
      take: 20,
    });
    return { scanned: due.length, siteIds: due.map((d) => d.siteId), apis: BACKLINK_SOURCE_APIS };
  }

  const links = await prisma.backlink.findMany({ where: { siteId: data.siteId } });
  let updated = 0;
  for (const link of links) {
    if (link.authority == null || link.relevance == null || link.spam == null || link.risk == null) {
      continue;
    }
    const input = {
      authority: link.authority,
      relevance: link.relevance,
      spam: link.spam,
      risk: link.risk,
    };
    const score = computeBacklinkScore(input);
    const classification = classifyBacklink(input);
    const prismaClass =
      classification === "toxic"
        ? "TOXIC"
        : classification === "high_value"
          ? "HIGH_VALUE"
          : classification === "lost"
            ? "LOST"
            : "NORMAL";
    await prisma.backlink.update({
      where: { id: link.id },
      data: { score, classification: prismaClass, toxicScore: link.risk },
    });
    updated += 1;
  }

  const config = await prisma.backlinkEngineConfig.findUnique({ where: { siteId: data.siteId } });
  if (config) {
    await prisma.backlinkEngineConfig.update({
      where: { siteId: data.siteId },
      data: {
        lastRefreshAt: new Date(),
        nextRefreshAt: new Date(Date.now() + config.refreshIntervalHours * 3600 * 1000),
      },
    });
  }

  return { siteId: data.siteId, rescored: updated };
}
