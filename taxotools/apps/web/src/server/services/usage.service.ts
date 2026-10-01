import { prisma, UsageMetric } from "@taxotools/database";
import { isUnlimited } from "@taxotools/shared";
import { currentUsagePeriod } from "@/lib/utils";
import { LimitError } from "@/lib/auth";

const metricToPlanField: Record<
  UsageMetric,
  | "sitesLimit"
  | "keywordsLimit"
  | "crawlsPerMonth"
  | "aiCreditsPerMonth"
  | "aeoScansPerMonth"
  | "teamSeatsLimit"
> = {
  SITES: "sitesLimit",
  KEYWORDS: "keywordsLimit",
  CRAWLS: "crawlsPerMonth",
  AI_CREDITS: "aiCreditsPerMonth",
  AEO_SCANS: "aeoScansPerMonth",
  TEAM_SEATS: "teamSeatsLimit",
};

export async function getPlanForAccount(accountId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { accountId },
    include: { plan: true },
  });
  if (!sub) throw new LimitError("No active subscription");
  return sub.plan;
}

export async function getUsage(accountId: string, metric: UsageMetric, period = currentUsagePeriod()) {
  const record = await prisma.usageRecord.findUnique({
    where: { accountId_metric_period: { accountId, metric, period } },
  });
  return record?.quantity ?? 0;
}

export async function assertWithinLimit(
  accountId: string,
  metric: UsageMetric,
  increment = 1,
) {
  const plan = await getPlanForAccount(accountId);
  const limit = plan[metricToPlanField[metric]];
  if (isUnlimited(limit)) return { plan, used: 0, limit };

  // Live counts for seat/site style metrics
  if (metric === "SITES") {
    const used = await prisma.site.count({
      where: { workspace: { accountId } },
    });
    if (used + increment > limit) {
      throw new LimitError(`Site limit reached (${limit}). Upgrade your plan.`);
    }
    return { plan, used, limit };
  }
  if (metric === "KEYWORDS") {
    const used = await prisma.keyword.count({
      where: { site: { workspace: { accountId } } },
    });
    if (used + increment > limit) {
      throw new LimitError(`Keyword limit reached (${limit}). Upgrade your plan.`);
    }
    return { plan, used, limit };
  }
  if (metric === "TEAM_SEATS") {
    const used = await prisma.workspaceMember.count({
      where: { workspace: { accountId } },
    });
    if (used + increment > limit) {
      throw new LimitError(`Team seat limit reached (${limit}).`);
    }
    return { plan, used, limit };
  }

  const used = await getUsage(accountId, metric);
  if (used + increment > limit) {
    throw new LimitError(`${metric} monthly limit reached (${limit}).`);
  }
  return { plan, used, limit };
}

export async function incrementUsage(
  accountId: string,
  metric: UsageMetric,
  quantity = 1,
  period = currentUsagePeriod(),
) {
  await prisma.usageRecord.upsert({
    where: { accountId_metric_period: { accountId, metric, period } },
    create: { accountId, metric, period, quantity },
    update: { quantity: { increment: quantity } },
  });
}

/** One plan read + parallel counters — avoids 6× sequential DB round-trips. */
export async function usageSummary(accountId: string) {
  const period = currentUsagePeriod();
  const [plan, sitesUsed, keywordsUsed, seatsUsed, usageRows] = await Promise.all([
    getPlanForAccount(accountId),
    prisma.site.count({ where: { workspace: { accountId } } }),
    prisma.keyword.count({ where: { site: { workspace: { accountId } } } }),
    prisma.workspaceMember.count({ where: { workspace: { accountId } } }),
    prisma.usageRecord.findMany({
      where: { accountId, period },
      select: { metric: true, quantity: true },
    }),
  ]);

  const usedByMetric = Object.fromEntries(
    usageRows.map((row) => [row.metric, row.quantity]),
  ) as Partial<Record<UsageMetric, number>>;

  const items: { metric: UsageMetric; used: number; limit: number }[] = [
    { metric: "SITES", used: sitesUsed, limit: plan.sitesLimit },
    { metric: "KEYWORDS", used: keywordsUsed, limit: plan.keywordsLimit },
    {
      metric: "CRAWLS",
      used: usedByMetric.CRAWLS ?? 0,
      limit: plan.crawlsPerMonth,
    },
    {
      metric: "AI_CREDITS",
      used: usedByMetric.AI_CREDITS ?? 0,
      limit: plan.aiCreditsPerMonth,
    },
    {
      metric: "AEO_SCANS",
      used: usedByMetric.AEO_SCANS ?? 0,
      limit: plan.aeoScansPerMonth,
    },
    { metric: "TEAM_SEATS", used: seatsUsed, limit: plan.teamSeatsLimit },
  ];

  return { plan, period, items };
}
