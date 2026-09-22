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

export async function usageSummary(accountId: string) {
  const plan = await getPlanForAccount(accountId);
  const period = currentUsagePeriod();
  const metrics: UsageMetric[] = [
    "SITES",
    "KEYWORDS",
    "CRAWLS",
    "AI_CREDITS",
    "AEO_SCANS",
    "TEAM_SEATS",
  ];
  const items = [];
  for (const metric of metrics) {
    const { used, limit } = await assertWithinLimit(accountId, metric, 0).catch(async () => {
      // assert with 0 still throws if already over — fall back
      const limit = plan[metricToPlanField[metric]];
      let used = 0;
      if (metric === "SITES") {
        used = await prisma.site.count({ where: { workspace: { accountId } } });
      } else if (metric === "KEYWORDS") {
        used = await prisma.keyword.count({ where: { site: { workspace: { accountId } } } });
      } else if (metric === "TEAM_SEATS") {
        used = await prisma.workspaceMember.count({ where: { workspace: { accountId } } });
      } else {
        used = await getUsage(accountId, metric, period);
      }
      return { plan, used, limit };
    });
    items.push({ metric, used, limit });
  }
  return { plan, period, items };
}
