import { prisma, CrawlIssueType, IssueSeverity } from "@taxotools/database";

type CrawlPayload = {
  crawlId: string;
  siteId: string;
  url: string;
  maxPages?: number;
};

/**
 * Production: replace with a real crawler (Playwright/Chromium or dedicated crawl service).
 * This stub simulates discovery + common technical issues so the product loop works end-to-end.
 */
export async function processCrawl(payload: Record<string, unknown>) {
  const data = payload as CrawlPayload;
  await prisma.crawl.update({
    where: { id: data.crawlId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const base = data.url.replace(/\/$/, "");
  const paths = ["/", "/about", "/pricing", "/blog", "/blog/seo-guide", "/contact", "/docs"];
  const max = Math.min(data.maxPages ?? 100, paths.length);

  let issuesFound = 0;
  for (let i = 0; i < max; i++) {
    const path = paths[i]!;
    const url = `${base}${path === "/" ? "" : path}`;
    const page = await prisma.page.upsert({
      where: { siteId_url: { siteId: data.siteId, url } },
      create: {
        siteId: data.siteId,
        crawlId: data.crawlId,
        url,
        path,
        statusCode: path === "/docs" ? 404 : 200,
        title: path === "/" ? "Home" : path.slice(1),
        metaDescription: path === "/about" ? null : `Description for ${path}`,
        wordCount: path.includes("blog") ? 1400 : 220,
        indexable: true,
        lcpMs: 1800 + i * 120,
        cls: 0.05,
        inpMs: 120,
        lastCrawledAt: new Date(),
      },
      update: {
        crawlId: data.crawlId,
        statusCode: path === "/docs" ? 404 : 200,
        lastCrawledAt: new Date(),
      },
    });

    const issueSpecs: Array<{
      type: CrawlIssueType;
      severity: IssueSeverity;
      message: string;
    }> = [];
    if (path === "/docs") {
      issueSpecs.push({
        type: "BROKEN_LINK",
        severity: "HIGH",
        message: "URL returned 404",
      });
    }
    if (!page.metaDescription) {
      issueSpecs.push({
        type: "MISSING_META",
        severity: "MEDIUM",
        message: "Missing meta description",
      });
    }
    if ((page.wordCount ?? 0) < 300 && path !== "/") {
      issueSpecs.push({
        type: "THIN_CONTENT",
        severity: "LOW",
        message: "Thin content detected",
      });
    }

    for (const spec of issueSpecs) {
      await prisma.crawlIssue.create({
        data: {
          crawlId: data.crawlId,
          pageId: page.id,
          url,
          ...spec,
        },
      });
      issuesFound += 1;
    }
  }

  await prisma.site.update({
    where: { id: data.siteId },
    data: { lastCrawledAt: new Date() },
  });

  const crawl = await prisma.crawl.update({
    where: { id: data.crawlId },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      pagesFound: max,
      issuesFound,
    },
  });

  return { crawlId: crawl.id, pagesFound: max, issuesFound };
}
