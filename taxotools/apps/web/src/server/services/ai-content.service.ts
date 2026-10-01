import { prisma, AIJobType, type Prisma } from "@taxotools/database";
import { generateSeoContent } from "@taxotools/integrations";
import { getSiteForUser } from "@/server/services/tenant.service";
import { assertWithinLimit, incrementUsage } from "@/server/services/usage.service";
import { enqueueJob } from "@/server/queue";

const CREDIT_COST: Partial<Record<AIJobType, number>> = {
  OUTLINE: 1,
  META: 1,
  FAQ: 1,
  SCHEMA: 1,
  SOCIAL_POST: 1,
  ARTICLE: 5,
  CONTENT_SCORE: 2,
  BULK_ARTICLES: 10,
  PROGRAMMATIC: 15,
  AD_COPY: 1,
};

export async function createAIJob(params: {
  userId: string;
  siteId: string;
  type: AIJobType;
  input: Record<string, unknown>;
}) {
  const site = await getSiteForUser(params.userId, params.siteId);
  const credits = CREDIT_COST[params.type] ?? 2;
  await assertWithinLimit(site.workspace.accountId, "AI_CREDITS", credits);

  const job = await prisma.aIJob.create({
    data: {
      siteId: site.id,
      accountId: site.workspace.accountId,
      type: params.type,
      status: "QUEUED",
      inputJson: params.input as Prisma.InputJsonValue,
      creditsUsed: credits,
    },
  });

  await incrementUsage(site.workspace.accountId, "AI_CREDITS", credits);
  const queued = await enqueueJob({
    queue: "taxotools-ai-content",
    name: params.type.toLowerCase(),
    payload: {
      aiJobId: job.id,
      siteId: site.id,
      type: params.type,
      input: params.input,
    },
  });

  // No Redis/worker → generate inline so Content Genius works on Vercel.
  if (queued.transport === "db") {
    try {
      await prisma.backgroundJob.update({
        where: { id: queued.id },
        data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
      });
      await prisma.aIJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", startedAt: new Date() },
      });
      const generated = await generateSeoContent({
        type: params.type,
        keyword: String(params.input.keyword || "seo"),
        title: params.input.title ? String(params.input.title) : undefined,
        tone: params.input.tone ? String(params.input.tone) : undefined,
        brand: site.name,
        domain: site.domain,
        extra: params.input,
      });
      const completed = await prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          outputJson: {
            ...generated.output,
            _meta: { mode: generated.mode, source: generated.source },
          } as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      await prisma.backgroundJob.update({
        where: { id: queued.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          result: { aiJobId: job.id, mode: generated.mode, transport: "inline" },
          errorMessage: null,
        },
      });
      return completed;
    } catch (e) {
      const message = e instanceof Error ? e.message : "inline AI content failed";
      await prisma.aIJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: message, finishedAt: new Date() },
      });
      await prisma.backgroundJob.update({
        where: { id: queued.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
      });
      throw e;
    }
  }

  return job;
}

export async function listAIJobs(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  return prisma.aIJob.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Synchronous generator for UI previews — uses OpenAI when configured via async path elsewhere */
export function generateArticleStub(input: {
  keyword: string;
  title?: string;
  tone?: string;
}) {
  const title = input.title || `The Complete Guide to ${input.keyword}`;
  const tone = input.tone || "expert";
  return {
    title,
    metaTitle: `${title} | Taxotools`.slice(0, 60),
    metaDescription: `Learn how to master ${input.keyword} with actionable SEO and AI visibility tactics.`.slice(
      0,
      155,
    ),
    outline: [
      { level: "h2", text: `What is ${input.keyword}?` },
      { level: "h2", text: `Why ${input.keyword} matters in 2026` },
      { level: "h3", text: "Search vs AI answer engines" },
      { level: "h2", text: `How to improve ${input.keyword}` },
      { level: "h2", text: "Measurement and reporting" },
      { level: "h2", text: "FAQs" },
    ],
    bodyMarkdown: `# ${title}\n\n${input.keyword} is a critical growth lever for modern marketing teams.\n\n## What is ${input.keyword}?\n\nA practical overview written in a ${tone} tone...\n\n## Why it matters\n\nOrganic and AI surfaces now share visibility...\n`,
    faq: [
      {
        q: `What is ${input.keyword}?`,
        a: `${input.keyword} refers to strategies that improve discovery across search and AI engines.`,
      },
      {
        q: `How do I track ${input.keyword}?`,
        a: "Use rank tracking plus AEO/GEO citation monitoring in Taxotools.",
      },
    ],
    schemaJsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      about: input.keyword,
    },
  };
}

export async function scoreContent(params: {
  userId: string;
  siteId: string;
  url: string;
  targetKeyword: string;
  text: string;
}) {
  const site = await getSiteForUser(params.userId, params.siteId);
  const words = params.text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const keyword = params.targetKeyword.toLowerCase();
  const density =
    words.filter((w) => w.toLowerCase().includes(keyword.split(" ")[0] ?? keyword)).length /
    Math.max(wordCount, 1);

  const coverage = Math.min(100, density * 400 + (wordCount > 800 ? 30 : wordCount / 40));
  const structure = /#{1,3}\s/.test(params.text) ? 80 : 45;
  const readability = Math.max(20, 100 - Math.abs(wordCount - 1200) / 40);
  const overall = Math.round(coverage * 0.45 + structure * 0.25 + readability * 0.3);

  const page = await prisma.contentPage.upsert({
    where: { siteId_url: { siteId: site.id, url: params.url } },
    create: {
      siteId: site.id,
      url: params.url,
      targetKeyword: params.targetKeyword,
      wordCount,
      score: overall,
      scoreBreakdown: { coverage, structure, readability, density } as Prisma.InputJsonValue,
      lastScoredAt: new Date(),
    },
    update: {
      targetKeyword: params.targetKeyword,
      wordCount,
      score: overall,
      scoreBreakdown: { coverage, structure, readability, density } as Prisma.InputJsonValue,
      lastScoredAt: new Date(),
    },
  });

  await prisma.contentScore.create({
    data: {
      contentPageId: page.id,
      overall,
      coverage,
      structure,
      readability,
      notes: "Heuristic NLP score — swap for embedding-based scorer in production.",
    },
  });

  return page;
}
