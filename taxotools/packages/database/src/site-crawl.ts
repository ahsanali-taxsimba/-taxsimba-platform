import type { CrawlIssueType, IssueSeverity } from "@prisma/client";
import { prisma } from "./client";

export type SiteCrawlPayload = {
  crawlId: string;
  siteId: string;
  url: string;
  maxPages?: number;
};

type ParsedPage = {
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string | null;
  wordCount: number;
  indexable: boolean;
  hasSchema: boolean;
  links: string[];
  error?: string;
};

const UA = "TaxoToolsBot/1.0 (+https://taxotools.com; site-audit)";

function absUrl(base: string, href: string): string | null {
  try {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return null;
    }
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
    "i",
  );
  return html.match(re)?.[1]?.trim() || html.match(re2)?.[1]?.trim() || null;
}

export async function fetchAndParsePage(url: string, timeoutMs = 12_000): Promise<ParsedPage> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const statusCode = res.status;
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("html") && !ctype.includes("text/")) {
      return {
        statusCode,
        title: null,
        metaDescription: null,
        canonical: null,
        h1: null,
        wordCount: 0,
        indexable: statusCode < 400,
        hasSchema: false,
        links: [],
      };
    }
    const html = await res.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null;
    const metaDescription = metaContent(html, "description");
    const robots = (metaContent(html, "robots") || "").toLowerCase();
    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ||
      null;
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ? stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)![1]!).slice(0, 300)
      : null;
    const text = stripTags(html);
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const hasSchema = /application\/ld\+json/i.test(html) || /itemscope/i.test(html);
    const links: string[] = [];
    const linkRe = /<a[^>]+href=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html))) {
      const abs = absUrl(url, m[1]!);
      if (abs) links.push(abs);
    }
    return {
      statusCode,
      title,
      metaDescription,
      canonical: canonical ? absUrl(url, canonical) : null,
      h1,
      wordCount,
      indexable: !robots.includes("noindex") && statusCode < 400,
      hasSchema,
      links: [...new Set(links)],
    };
  } catch (e) {
    return {
      statusCode: 0,
      title: null,
      metaDescription: null,
      canonical: null,
      h1: null,
      wordCount: 0,
      indexable: false,
      hasSchema: false,
      links: [],
      error: e instanceof Error ? e.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function pathOf(url: string): string {
  try {
    const p = new URL(url).pathname || "/";
    return p.length > 1 ? p.replace(/\/$/, "") : "/";
  } catch {
    return "/";
  }
}

/**
 * Live site crawl: BFS over same-host links, extract SEO fields, write Page + CrawlIssue rows.
 */
export async function processSiteCrawl(payload: SiteCrawlPayload) {
  const maxPages = Math.min(Math.max(payload.maxPages ?? 25, 1), 100);
  const seed = payload.url.replace(/\/$/, "") || payload.url;

  await prisma.crawl.update({
    where: { id: payload.crawlId },
    data: { status: "RUNNING", startedAt: new Date(), errorMessage: null },
  });

  const queue: string[] = [seed];
  const seen = new Set<string>();
  let pagesFound = 0;
  let issuesFound = 0;

  try {
    while (queue.length && pagesFound < maxPages) {
      const url = queue.shift()!;
      const key = url.replace(/\/$/, "") || url;
      if (seen.has(key)) continue;
      seen.add(key);

      const parsed = await fetchAndParsePage(url);
      const path = pathOf(url);
      pagesFound += 1;

      const page = await prisma.page.upsert({
        where: { siteId_url: { siteId: payload.siteId, url: key } },
        create: {
          siteId: payload.siteId,
          crawlId: payload.crawlId,
          url: key,
          path,
          statusCode: parsed.statusCode || null,
          title: parsed.title,
          metaDescription: parsed.metaDescription,
          canonical: parsed.canonical,
          wordCount: parsed.wordCount,
          indexable: parsed.indexable,
          schemaJson: parsed.hasSchema ? { detected: true } : undefined,
          lastCrawledAt: new Date(),
        },
        update: {
          crawlId: payload.crawlId,
          statusCode: parsed.statusCode || null,
          title: parsed.title,
          metaDescription: parsed.metaDescription,
          canonical: parsed.canonical,
          wordCount: parsed.wordCount,
          indexable: parsed.indexable,
          schemaJson: parsed.hasSchema ? { detected: true } : undefined,
          lastCrawledAt: new Date(),
        },
      });

      const issueSpecs: Array<{ type: CrawlIssueType; severity: IssueSeverity; message: string }> = [];

      if (parsed.error) {
        issueSpecs.push({
          type: "OTHER",
          severity: "HIGH",
          message: `Fetch failed: ${parsed.error}`,
        });
      }
      if (parsed.statusCode === 404 || parsed.statusCode >= 500) {
        issueSpecs.push({
          type: "BROKEN_LINK",
          severity: parsed.statusCode >= 500 ? "CRITICAL" : "HIGH",
          message: `URL returned HTTP ${parsed.statusCode}`,
        });
      }
      if (parsed.statusCode > 0 && parsed.statusCode < 400) {
        if (!parsed.title) {
          issueSpecs.push({ type: "MISSING_TITLE", severity: "HIGH", message: "Missing <title>" });
        } else if (parsed.title.length < 15 || parsed.title.length > 65) {
          issueSpecs.push({
            type: "OTHER",
            severity: "LOW",
            message: `Title length ${parsed.title.length} (ideal 15–65)`,
          });
        }
        if (!parsed.metaDescription) {
          issueSpecs.push({
            type: "MISSING_META",
            severity: "MEDIUM",
            message: "Missing meta description",
          });
        }
        if (!parsed.h1) {
          issueSpecs.push({
            type: "OTHER",
            severity: "MEDIUM",
            message: "Missing H1 heading",
          });
        }
        if (parsed.wordCount > 0 && parsed.wordCount < 300) {
          issueSpecs.push({
            type: "THIN_CONTENT",
            severity: "LOW",
            message: `Thin content (${parsed.wordCount} words)`,
          });
        }
        if (!parsed.hasSchema) {
          issueSpecs.push({
            type: "MISSING_SCHEMA",
            severity: "INFO",
            message: "No structured data (JSON-LD / microdata) detected",
          });
        }
        if (!parsed.indexable) {
          issueSpecs.push({
            type: "NOINDEX",
            severity: "HIGH",
            message: "Page is noindex or non-indexable",
          });
        }
      }

      for (const spec of issueSpecs) {
        await prisma.crawlIssue.create({
          data: {
            crawlId: payload.crawlId,
            pageId: page.id,
            url: key,
            ...spec,
          },
        });
        issuesFound += 1;
      }

      for (const link of parsed.links) {
        if (!sameHost(seed, link)) continue;
        const norm = link.replace(/\/$/, "") || link;
        if (!seen.has(norm) && !queue.includes(norm)) queue.push(norm);
      }
    }

    await prisma.site.update({
      where: { id: payload.siteId },
      data: { lastCrawledAt: new Date() },
    });

    const crawl = await prisma.crawl.update({
      where: { id: payload.crawlId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        pagesFound,
        issuesFound,
        errorMessage: null,
      },
    });

    return {
      crawlId: crawl.id,
      pagesFound,
      issuesFound,
      mode: "live-http" as const,
      seed,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "crawl failed";
    await prisma.crawl.update({
      where: { id: payload.crawlId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        pagesFound,
        issuesFound,
        errorMessage: message,
      },
    });
    throw e;
  }
}
