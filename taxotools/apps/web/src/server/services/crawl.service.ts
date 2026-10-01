import { processSiteCrawl, prisma } from "@taxotools/database";
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

  // Cap inline serverless crawls so Vercel timeouts are respected.
  const requested = params.maxPages ?? 50;
  const maxPages = Math.min(requested, 100);

  const crawl = await prisma.crawl.create({
    data: {
      siteId: site.id,
      status: "QUEUED",
      maxPages,
    },
  });

  await incrementUsage(site.workspace.accountId, "CRAWLS", 1);
  const job = await enqueueJob({
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

  // No Redis/worker → run live crawl inline so the product actually works on Vercel.
  if (job.transport === "db") {
    const inlineMax = Math.min(maxPages, Number(process.env.CRAWL_INLINE_MAX || 20));
    try {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
      });
      const result = await processSiteCrawl({
        crawlId: crawl.id,
        siteId: site.id,
        url: site.url,
        maxPages: inlineMax,
      });
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          result: { ...result, transport: "inline" },
          errorMessage: null,
        },
      });
      const fresh = await prisma.crawl.findUniqueOrThrow({ where: { id: crawl.id } });
      return Object.assign(fresh, { transport: "inline" as const, jobId: job.id });
    } catch (e) {
      const message = e instanceof Error ? e.message : "inline crawl failed";
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
      });
      await prisma.crawl.update({
        where: { id: crawl.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
      });
      throw e;
    }
  }

  return Object.assign(crawl, { transport: "redis" as const, jobId: job.id });
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
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      maxPages: true,
      pagesFound: true,
      issuesFound: true,
      errorMessage: true,
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

  if (latest) {
    const groups = await prisma.crawlIssue.groupBy({
      by: ["severity"],
      where: { crawlId: latest.id },
      _count: { _all: true },
    });
    for (const row of groups) {
      bySeverity[row.severity] = row._count._all;
    }
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
    dataSource: latest ? ("live-http" as const) : ("none" as const),
  };
}
