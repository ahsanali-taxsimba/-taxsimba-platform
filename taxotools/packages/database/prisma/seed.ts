import { PrismaClient, PlanCode } from "@prisma/client";
import { PLAN_LIMITS, PLAN_PRICES_CENTS } from "@taxotools/shared";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PLAN_NAMES: Record<PlanCode, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  PRO: "Pro",
  AGENCY: "Agency",
  ENTERPRISE: "Enterprise",
};

async function main() {
  for (const code of Object.keys(PLAN_LIMITS) as PlanCode[]) {
    const limits = PLAN_LIMITS[code];
    await prisma.plan.upsert({
      where: { code },
      create: {
        code,
        name: PLAN_NAMES[code],
        description: `${PLAN_NAMES[code]} — Taxo Agent, Content Genius, and CMS publish`,
        monthlyPriceCents: PLAN_PRICES_CENTS[code],
        sitesLimit: limits.sites,
        keywordsLimit: limits.keywords,
        crawlsPerMonth: limits.crawlsPerMonth,
        aiCreditsPerMonth: limits.aiCreditsPerMonth,
        aeoScansPerMonth: limits.aeoScansPerMonth,
        teamSeatsLimit: limits.teamSeats,
        ottoProjectsLimit: limits.ottoProjects,
        llmVisibilityPlatforms: limits.llmVisibilityPlatforms,
        whiteLabel: limits.whiteLabel,
        apiAccess: limits.apiAccess,
        outreachCrm: limits.outreachCrm,
        smartAds: limits.smartAds,
        cmsPublish: limits.cmsPublish,
      },
      update: {
        name: PLAN_NAMES[code],
        monthlyPriceCents: PLAN_PRICES_CENTS[code],
        sitesLimit: limits.sites,
        keywordsLimit: limits.keywords,
        crawlsPerMonth: limits.crawlsPerMonth,
        aiCreditsPerMonth: limits.aiCreditsPerMonth,
        aeoScansPerMonth: limits.aeoScansPerMonth,
        teamSeatsLimit: limits.teamSeats,
        ottoProjectsLimit: limits.ottoProjects,
        llmVisibilityPlatforms: limits.llmVisibilityPlatforms,
        whiteLabel: limits.whiteLabel,
        apiAccess: limits.apiAccess,
        outreachCrm: limits.outreachCrm,
        smartAds: limits.smartAds,
        cmsPublish: limits.cmsPublish,
      },
    });
  }

  const engines = [
    { code: "chatgpt", name: "ChatGPT", provider: "openai" },
    { code: "claude", name: "Claude", provider: "anthropic" },
    { code: "gemini", name: "Gemini", provider: "google" },
    { code: "copilot", name: "Copilot", provider: "microsoft" },
    { code: "perplexity", name: "Perplexity", provider: "perplexity" },
    { code: "google_aio", name: "Google AI Overviews", provider: "google" },
  ];
  for (const eng of engines) {
    await prisma.aIEngine.upsert({
      where: { code: eng.code },
      create: eng,
      update: { name: eng.name, provider: eng.provider, active: true },
    });
  }

  await prisma.reportTemplate.upsert({
    where: { id: "system-seo-audit" },
    create: {
      id: "system-seo-audit",
      name: "SEO Audit Report",
      description: "Technical + content + visibility overview",
      isSystem: true,
      sectionsJson: {
        sections: ["overview", "technical", "keywords", "content", "aeo", "backlinks", "autopilot"],
      },
    },
    update: {},
  });

  const demoEmail = "demo@taxotools.com";
  const passwordHash = await bcrypt.hash("TaxotoolsDemo1!", 10);
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    create: {
      email: demoEmail,
      name: "Taxotools Demo",
      passwordHash,
      emailVerified: new Date(),
    },
    update: { passwordHash },
  });

  const starter = await prisma.plan.findUniqueOrThrow({ where: { code: "STARTER" } });

  let account = await prisma.account.findUnique({ where: { ownerId: user.id } });
  if (!account) {
    account = await prisma.account.create({
      data: {
        name: "Demo Agency",
        slug: "demo-agency",
        ownerId: user.id,
        billingEmail: demoEmail,
        subscription: {
          create: {
            planId: starter.id,
            status: "TRIALING",
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
  }

  let workspace = await prisma.workspace.findFirst({
    where: { accountId: account.id, slug: "main" },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        accountId: account.id,
        name: "Main Workspace",
        slug: "main",
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    });
  }

  let site = await prisma.site.findFirst({
    where: { workspaceId: workspace.id, domain: "example.com" },
  });
  if (!site) {
    site = await prisma.site.create({
      data: {
        workspaceId: workspace.id,
        name: "Example Site",
        domain: "example.com",
        url: "https://example.com",
        locale: "en-US",
        countryCode: "US",
        pixelToken: `ttx_${Math.random().toString(36).slice(2, 14)}`,
        autopilotEnabled: true,
        approvalMode: true,
      },
    });
  } else if (!site.pixelToken) {
    site = await prisma.site.update({
      where: { id: site.id },
      data: {
        pixelToken: `ttx_${Math.random().toString(36).slice(2, 14)}`,
        autopilotEnabled: true,
      },
    });
  }

  const phrases = [
    { phrase: "seo tools", volume: 12000, difficulty: 68, intent: "COMMERCIAL" as const },
    { phrase: "ai search visibility", volume: 2400, difficulty: 42, intent: "INFORMATIONAL" as const },
    { phrase: "rank tracker", volume: 8100, difficulty: 55, intent: "TRANSACTIONAL" as const },
  ];
  for (const k of phrases) {
    await prisma.keyword.upsert({
      where: {
        siteId_phrase_locale_device_location: {
          siteId: site.id,
          phrase: k.phrase,
          locale: "en-US",
          device: "DESKTOP",
          location: "",
        },
      },
      create: {
        siteId: site.id,
        phrase: k.phrase,
        volume: k.volume,
        difficulty: k.difficulty,
        intent: k.intent,
        location: "",
        tracking: true,
      },
      update: {
        volume: k.volume,
        difficulty: k.difficulty,
        intent: k.intent,
      },
    });
  }

  console.log("Taxotools seed complete.");
  console.log(`Demo login: ${demoEmail} / TaxotoolsDemo1!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
