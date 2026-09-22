import { prisma } from "@taxotools/database";
import { getSiteForUser } from "@/server/services/tenant.service";
import { assertWithinLimit, incrementUsage } from "@/server/services/usage.service";
import { enqueueJob } from "@/server/queue";

export async function startCrawl(params: {
  userId: string;
  siteId: string;
  maxPages?: number;
}) {
  const site = await getSiteForUser(params.userId, params.siteId);
  await assertWithinLimit(site.workspace.accountId, "CRAWLS", 1);

  const crawl = await prisma.crawl.create({
    data: {
      siteId: site.id,
      status: "QUEUED",
      maxPages: params.maxPages ?? 100,
    },
  });

  await incrementUsage(site.workspace.accountId, "CRAWLS", 1);
  await enqueueJob({
    queue: "taxotools-crawl",
    name: "site-crawl",
    payload: {
      crawlId: crawl.id,
      siteId: site.id,
      url: site.url,
      maxPages: crawl.maxPages,
      accountId: site.workspace.accountId,
    },
  });

  return crawl;
}

export async function listCrawls(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  return prisma.crawl.findMany({
    where: { siteId },
    include: { _count: { select: { issues: true, pages: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getCrawlIssues(userId: string, siteId: string, crawlId: string) {
  await getSiteForUser(userId, siteId);
  return prisma.crawlIssue.findMany({
    where: { crawlId, crawl: { siteId } },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  });
}

export async function siteHealthSummary(userId: string, siteId: string) {
  const site = await getSiteForUser(userId, siteId);
  const latest = await prisma.crawl.findFirst({
    where: { siteId, status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    include: {
      issues: true,
      _count: { select: { pages: true, issues: true } },
    },
  });

  const bySeverity = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const issue of latest?.issues ?? []) {
    bySeverity[issue.severity] += 1;
  }

  const score = latest
    ? Math.max(
        0,
        100 -
          bySeverity.CRITICAL * 15 -
          bySeverity.HIGH * 8 -
          bySeverity.MEDIUM * 3 -
          bySeverity.LOW * 1,
      )
    : null;

  return {
    site,
    latestCrawl: latest,
    issueCounts: bySeverity,
    healthScore: score,
  };
}
