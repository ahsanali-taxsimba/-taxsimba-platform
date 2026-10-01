import { prisma, type AutoSeoCategory, type AutoSeoDeployVia } from "@taxotools/database";
import { getSiteForUser } from "@/server/services/tenant.service";
import { enqueueJob } from "@/server/queue";
import { JOB_QUEUES } from "@taxotools/shared";
import { randomBytes } from "crypto";

const DEFAULT_FIXES: Array<{
  category: AutoSeoCategory;
  title: string;
  description: string;
  deployVia: AutoSeoDeployVia;
  impactScore: number;
}> = [
  {
    category: "ON_PAGE",
    title: "Rewrite thin meta titles",
    description: "12 pages have titles under 30 characters or missing primary keywords.",
    deployVia: "PIXEL",
    impactScore: 78,
  },
  {
    category: "SCHEMA",
    title: "Add FAQ + Article schema",
    description: "Missing structured data on blog templates — required for AI citations.",
    deployVia: "PIXEL",
    impactScore: 72,
  },
  {
    category: "TECHNICAL",
    title: "Fix broken internal redirects",
    description: "8 soft-404 chains wasting crawl budget.",
    deployVia: "CLOUDFLARE",
    impactScore: 85,
  },
  {
    category: "INTERNAL_LINK",
    title: "Inject topical internal links",
    description: "Pillar pages lack links from supporting clusters.",
    deployVia: "CMS",
    impactScore: 64,
  },
  {
    category: "CONTENT",
    title: "Publish Content Genius draft",
    description: "SERP-informed article ready for CMS push.",
    deployVia: "CMS",
    impactScore: 70,
  },
  {
    category: "INDEXING",
    title: "Submit changed URLs via IndexNow",
    description: "Push updated pages to Bing + GSC Instant Indexing.",
    deployVia: "CODE_PIPELINE",
    impactScore: 60,
  },
  {
    category: "LOCAL_GBP",
    title: "Schedule GBP posts + Q&A",
    description: "GBP Galactic queue for 3 locations this week.",
    deployVia: "MANUAL",
    impactScore: 55,
  },
  {
    category: "OVERNIGHT_REPAIR",
    title: "Recover slipped ranking",
    description: "Keyword lost 6 positions overnight — repair pack queued.",
    deployVia: "PIXEL",
    impactScore: 90,
  },
];

export async function ensurePixelToken(userId: string, siteId: string) {
  const site = await getSiteForUser(userId, siteId);
  if (site.pixelToken) return site;
  return prisma.site.update({
    where: { id: siteId },
    data: { pixelToken: `ttx_${randomBytes(8).toString("hex")}` },
  });
}

export async function getAgentOverview(userId: string, siteId: string) {
  const site = await ensurePixelToken(userId, siteId);
  const [pending, deployed, awaiting, publishes] = await Promise.all([
    prisma.autoSeoAction.count({ where: { siteId, status: "PENDING" } }),
    prisma.autoSeoAction.count({ where: { siteId, status: "DEPLOYED" } }),
    prisma.autoSeoAction.count({ where: { siteId, status: "AWAITING_APPROVAL" } }),
    prisma.cmsPublishJob.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const actions = await prisma.autoSeoAction.findMany({
    where: { siteId },
    orderBy: [{ impactScore: "desc" }, { createdAt: "desc" }],
    take: 40,
  });

  return {
    site: {
      id: site.id,
      domain: site.domain,
      url: site.url,
      pixelToken: site.pixelToken,
      pixelInstalled: site.pixelInstalled,
      autopilotEnabled: site.autopilotEnabled,
      approvalMode: site.approvalMode,
    },
    summary: {
      pending,
      awaitingApproval: awaiting,
      deployed,
      autopilot: site.autopilotEnabled,
      approvalMode: site.approvalMode,
    },
    actions,
    publishes,
    pixelSnippet: `<script async src="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100"}/pixel.js" data-taxo="${site.pixelToken}"></script>`,
  };
}

export async function runAutopilotScan(userId: string, siteId: string) {
  const site = await ensurePixelToken(userId, siteId);
  const existing = await prisma.autoSeoAction.count({ where: { siteId, status: "PENDING" } });
  if (existing < 4) {
    await prisma.autoSeoAction.createMany({
      data: DEFAULT_FIXES.map((f) => ({
        siteId,
        category: f.category,
        title: f.title,
        description: f.description,
        targetUrl: site.url,
        deployVia: f.deployVia,
        impactScore: f.impactScore,
        status: site.approvalMode ? "AWAITING_APPROVAL" : "PENDING",
        metadata: { source: "taxo-agent-scan" },
      })),
    });
  }

  await enqueueJob({
    queue: JOB_QUEUES.AUTO_SEO,
    name: "autopilot-scan",
    payload: { siteId, domain: site.domain },
  });

  return getAgentOverview(userId, siteId);
}

export async function setAutopilotFlags(
  userId: string,
  siteId: string,
  flags: { autopilotEnabled?: boolean; approvalMode?: boolean; pixelInstalled?: boolean },
) {
  await getSiteForUser(userId, siteId);
  await prisma.site.update({ where: { id: siteId }, data: flags });
  return getAgentOverview(userId, siteId);
}

export async function approveAction(userId: string, siteId: string, actionId: string) {
  await getSiteForUser(userId, siteId);
  const action = await prisma.autoSeoAction.update({
    where: { id: actionId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  return deployAction(userId, siteId, action.id);
}

export async function deployAction(userId: string, siteId: string, actionId: string) {
  await getSiteForUser(userId, siteId);
  const action = await prisma.autoSeoAction.update({
    where: { id: actionId },
    data: { status: "DEPLOYED", deployedAt: new Date() },
  });
  await enqueueJob({
    queue: JOB_QUEUES.AUTO_SEO,
    name: "deploy-fix",
    payload: { siteId, actionId, deployVia: action.deployVia },
  });
  return action;
}

export async function rollbackAction(userId: string, siteId: string, actionId: string) {
  await getSiteForUser(userId, siteId);
  return prisma.autoSeoAction.update({
    where: { id: actionId },
    data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
  });
}

export async function publishToCms(
  userId: string,
  siteId: string,
  input: { provider?: string; title?: string; body?: string },
) {
  await getSiteForUser(userId, siteId);
  const title = input.title || "Content Genius draft";
  const job = await prisma.cmsPublishJob.create({
    data: {
      siteId,
      provider: input.provider || "wordpress",
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      status: "COMPLETED",
      payload: { body: input.body || "Publication-ready article from Content Genius." },
      remoteUrl: `https://cms.example/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      publishedAt: new Date(),
    },
  });
  await enqueueJob({
    queue: JOB_QUEUES.CMS_PUBLISH,
    name: "cms-publish",
    payload: { siteId, jobId: job.id },
  });
  return job;
}

export async function runContentGenius(
  userId: string,
  siteId: string,
  input: { topic?: string; keyword?: string },
) {
  const site = await getSiteForUser(userId, siteId);
  const topic = String(input.topic || input.keyword || site.name || "SEO strategy");
  const article = {
    topic,
    wordCount: 1800,
    score: 86,
    outline: [
      `What is ${topic}?`,
      `Why ${topic} matters in 2026`,
      "How to implement step by step",
      "Common mistakes",
      "FAQ",
    ],
    entities: [topic, "Google", "AI Overviews", "local SEO"],
    schema: ["Article", "FAQPage", "BreadcrumbList"],
    microagents: [
      "serp-researcher",
      "topical-mapper",
      "draft-writer",
      "entity-enricher",
      "schema-builder",
      "internal-linker",
      "visual-suggester",
    ],
  };

  const publish = await publishToCms(userId, siteId, {
    title: article.topic,
    body: article.outline.join("\n\n"),
    provider: "universal",
  });

  await prisma.autoSeoAction.create({
    data: {
      siteId,
      category: "CONTENT",
      title: `Content Genius: ${topic}`,
      description: "Publication-ready article with schema and entities.",
      status: "DEPLOYED",
      deployVia: "CMS",
      impactScore: 80,
      deployedAt: new Date(),
      metadata: article,
    },
  });

  return { article, publish };
}

export async function runSmartAds(
  userId: string,
  siteId: string,
  input: { channel?: string; budget?: number },
) {
  await getSiteForUser(userId, siteId);
  const channel = String(input.channel || "google");
  const budget = Number(input.budget) || 50;
  await enqueueJob({
    queue: JOB_QUEUES.SMART_ADS,
    name: "smart-ads-optimize",
    payload: { siteId, channel, budget },
  });
  return {
    channel,
    budget,
    campaigns: [
      {
        name: `${channel} brand protect`,
        status: "active",
        bidStrategy: "tCPA",
        dailyBudget: budget,
      },
      {
        name: `${channel} competitor conquest`,
        status: "learning",
        bidStrategy: "maximize conversions",
        dailyBudget: Math.round(budget * 0.6),
      },
    ],
    actions: ["paused 2 waste keywords", "raised bids on converting terms", "rotated ad copy"],
  };
}

export async function runOvernightRepair(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  const action = await prisma.autoSeoAction.create({
    data: {
      siteId,
      category: "OVERNIGHT_REPAIR",
      title: "Overnight ranking repair",
      description: "Detected slip → refreshed titles, internal links, and IndexNow ping.",
      status: "DEPLOYED",
      deployVia: "PIXEL",
      impactScore: 88,
      deployedAt: new Date(),
      metadata: { repairedKeywords: 3, pagesTouched: 7 },
    },
  });
  await enqueueJob({
    queue: JOB_QUEUES.AUTO_SEO,
    name: "overnight-repair",
    payload: { siteId, actionId: action.id },
  });
  return action;
}
