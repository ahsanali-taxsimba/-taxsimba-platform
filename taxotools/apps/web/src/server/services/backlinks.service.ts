import { prisma, type BacklinkClassification, type Prisma } from "@taxotools/database";
import {
  BACKLINK_ENGINE_DEFAULTS,
  BACKLINK_SOURCE_APIS,
  computeBacklinkScore,
  classifyBacklink,
  JOB_QUEUES,
  type BacklinkSourceApi,
} from "@taxotools/shared";
import { fetchBacklinksFromProviders } from "@taxotools/integrations";
import { getSiteForUser } from "@/server/services/tenant.service";
import { enqueueJob } from "@/server/queue";

type RawLink = {
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  authority: number;
  relevance: number;
  spam: number;
  risk: number;
  sourceApi: string;
  competitorDomain?: string | null;
  relNofollow?: boolean;
};

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function toPrismaClass(c: ReturnType<typeof classifyBacklink>): BacklinkClassification {
  if (c === "toxic") return "TOXIC";
  if (c === "high_value") return "HIGH_VALUE";
  if (c === "lost") return "LOST";
  return "NORMAL";
}

export async function initBacklinkEngine(
  userId: string,
  siteId: string,
  overrides: Partial<{
    sourceApis: string[];
    crawlMode: string;
    refreshInterval: string;
    enableDisavow: boolean;
    enableCompetitorMonitoring: boolean;
    competitors: string[];
  }> = {},
) {
  const site = await getSiteForUser(userId, siteId);
  const sourceApis = (overrides.sourceApis?.length
    ? overrides.sourceApis
    : [...BACKLINK_ENGINE_DEFAULTS.sourceApis]
  ).filter((a): a is BacklinkSourceApi =>
    (BACKLINK_SOURCE_APIS as readonly string[]).includes(a),
  );

  const refreshHours = BACKLINK_ENGINE_DEFAULTS.refreshIntervalHours;
  const next = new Date(Date.now() + refreshHours * 60 * 60 * 1000);

  const config = await prisma.backlinkEngineConfig.upsert({
    where: { siteId },
    create: {
      siteId,
      sourceApis,
      crawlMode: overrides.crawlMode || BACKLINK_ENGINE_DEFAULTS.crawlMode,
      refreshInterval: overrides.refreshInterval || BACKLINK_ENGINE_DEFAULTS.refreshInterval,
      refreshIntervalHours: refreshHours,
      scoreFormula: BACKLINK_ENGINE_DEFAULTS.scoreFormula,
      toxicSpamGt: BACKLINK_ENGINE_DEFAULTS.toxic.spamGt,
      toxicRiskGt: BACKLINK_ENGINE_DEFAULTS.toxic.riskGt,
      highValueAuthorityGt: BACKLINK_ENGINE_DEFAULTS.highValue.authorityGt,
      highValueRelevanceGt: BACKLINK_ENGINE_DEFAULTS.highValue.relevanceGt,
      alertVelocitySpikePct: BACKLINK_ENGINE_DEFAULTS.alerts.velocitySpikePct,
      alertAnchorRepeatPct: BACKLINK_ENGINE_DEFAULTS.alerts.anchorRepeatPct,
      enableDisavow: overrides.enableDisavow ?? BACKLINK_ENGINE_DEFAULTS.enableDisavow,
      enableCompetitorMonitoring:
        overrides.enableCompetitorMonitoring ??
        BACKLINK_ENGINE_DEFAULTS.enableCompetitorMonitoring,
      status: "active",
      nextRefreshAt: next,
    },
    update: {
      sourceApis,
      crawlMode: overrides.crawlMode || BACKLINK_ENGINE_DEFAULTS.crawlMode,
      refreshInterval: overrides.refreshInterval || BACKLINK_ENGINE_DEFAULTS.refreshInterval,
      enableDisavow: overrides.enableDisavow ?? BACKLINK_ENGINE_DEFAULTS.enableDisavow,
      enableCompetitorMonitoring:
        overrides.enableCompetitorMonitoring ??
        BACKLINK_ENGINE_DEFAULTS.enableCompetitorMonitoring,
      status: "active",
      nextRefreshAt: next,
    },
  });

  // Ensure competitor rows exist when monitoring is on
  if (config.enableCompetitorMonitoring) {
    const comps = overrides.competitors?.length
      ? overrides.competitors
      : ["ahrefs.com", "semrush.com"];
    for (const domain of comps) {
      await prisma.competitor.upsert({
        where: { siteId_domain: { siteId, domain } },
        create: { siteId, domain, name: domain },
        update: {},
      });
    }
  }

  const refresh = await refreshBacklinks(userId, siteId);

  await enqueueJob({
    queue: JOB_QUEUES.BACKLINK_REFRESH,
    name: "backlink-engine-init",
    payload: {
      siteId,
      domain: site.domain,
      sourceApis,
      crawlMode: config.crawlMode,
      refreshInterval: config.refreshInterval,
    },
  });

  return {
    init: {
      command: "seo.backlinks.init",
      sourceApis,
      crawlMode: config.crawlMode,
      refreshInterval: config.refreshInterval,
      scoreFormula: config.scoreFormula,
      toxicThreshold: `spam>${config.toxicSpamGt} || risk>${config.toxicRiskGt}`,
      highValueThreshold: `authority>${config.highValueAuthorityGt} && relevance>${config.highValueRelevanceGt}`,
      alertRules: `velocity_spike>${config.alertVelocitySpikePct}%,anchor_repeat>${config.alertAnchorRepeatPct}`,
      enableDisavow: config.enableDisavow,
      enableCompetitorMonitoring: config.enableCompetitorMonitoring,
    },
    ...refresh,
    config,
  };
}

export async function refreshBacklinks(userId: string, siteId: string) {
  const site = await getSiteForUser(userId, siteId);
  let config = await prisma.backlinkEngineConfig.findUnique({ where: { siteId } });
  if (!config) {
    await initBacklinkEngine(userId, siteId);
    config = await prisma.backlinkEngineConfig.findUniqueOrThrow({ where: { siteId } });
  }

  const apis = (config.sourceApis as string[]).filter((a): a is BacklinkSourceApi =>
    (BACKLINK_SOURCE_APIS as readonly string[]).includes(a),
  );

  const competitors = config.enableCompetitorMonitoring
    ? (
        await prisma.competitor.findMany({ where: { siteId }, take: 5 })
      ).map((c) => c.domain)
    : [];

  const previousCount = await prisma.backlink.count({
    where: { siteId, competitorDomain: null },
  });

  const fetched = await fetchBacklinksFromProviders(apis, {
    domain: site.domain,
    siteUrl: site.url,
    competitors,
    limit: 50,
  });

  const raw: RawLink[] = fetched.links.map((l) => ({
    sourceUrl: l.sourceUrl,
    targetUrl: l.targetUrl,
    anchorText: l.anchorText,
    authority: l.authority,
    relevance: l.relevance,
    spam: l.spam,
    risk: l.risk,
    sourceApi: l.sourceApi,
    competitorDomain: l.competitorDomain,
    relNofollow: l.relNofollow,
  }));

  let upserted = 0;
  for (const link of raw) {
    const score = computeBacklinkScore(link);
    const classification = toPrismaClass(classifyBacklink(link));
    const host = hostnameOf(link.sourceUrl);
    const domain = await prisma.domain.upsert({
      where: { hostname: host },
      create: {
        hostname: host,
        domainRating: link.authority,
        spamScore: link.spam / 100,
      },
      update: {
        domainRating: link.authority,
        spamScore: link.spam / 100,
      },
    });

    await prisma.backlink.upsert({
      where: {
        siteId_sourceUrl_targetUrl: {
          siteId,
          sourceUrl: link.sourceUrl,
          targetUrl: link.targetUrl,
        },
      },
      create: {
        siteId,
        sourceDomainId: domain.id,
        sourceUrl: link.sourceUrl,
        targetUrl: link.targetUrl,
        anchorText: link.anchorText,
        relNofollow: !!link.relNofollow,
        authority: link.authority,
        relevance: link.relevance,
        spam: link.spam,
        risk: link.risk,
        score,
        toxicScore: link.risk,
        classification,
        sourceApi: link.sourceApi,
        competitorDomain: link.competitorDomain || null,
      },
      update: {
        sourceDomainId: domain.id,
        anchorText: link.anchorText,
        authority: link.authority,
        relevance: link.relevance,
        spam: link.spam,
        risk: link.risk,
        score,
        toxicScore: link.risk,
        classification,
        sourceApi: link.sourceApi,
        competitorDomain: link.competitorDomain || null,
        lastSeenAt: new Date(),
        lostAt: null,
      },
    });
    upserted += 1;
  }

  const owned = await prisma.backlink.findMany({
    where: { siteId, competitorDomain: null },
  });

  // Alerts
  const alerts = await evaluateAlerts(siteId, config, owned, previousCount);

  // Auto-queue toxic for disavow
  let disavowQueued = 0;
  if (config.enableDisavow) {
    const toxic = owned.filter((b) => b.classification === "TOXIC");
    for (const t of toxic) {
      const domain = hostnameOf(t.sourceUrl);
      try {
        await prisma.disavowEntry.upsert({
          where: {
            siteId_domain_url: { siteId, domain, url: t.sourceUrl },
          },
          create: {
            siteId,
            domain,
            url: t.sourceUrl,
            reason: `toxic · spam=${t.spam} risk=${t.risk}`,
            source: "engine",
            status: "pending",
          },
          update: {
            reason: `toxic · spam=${t.spam} risk=${t.risk}`,
            status: "pending",
          },
        });
        disavowQueued += 1;
      } catch {
        // unique edge cases with null url/domain — skip
      }
    }
  }

  const next = new Date(Date.now() + config.refreshIntervalHours * 60 * 60 * 1000);
  await prisma.backlinkEngineConfig.update({
    where: { siteId },
    data: { lastRefreshAt: new Date(), nextRefreshAt: next },
  });

  await enqueueJob({
    queue: JOB_QUEUES.BACKLINK_REFRESH,
    name: "backlink-refresh",
    payload: { siteId, upserted, alerts: alerts.length },
  });

  return summarizeBacklinks(siteId, {
    upserted,
    alerts,
    disavowQueued,
    providers: fetched.providers,
    providerResults: fetched.results.map((r) => ({
      provider: r.provider,
      mode: r.mode,
      links: r.links.length,
      error: r.error || null,
      metrics: r.metrics || null,
    })),
  });
}

async function evaluateAlerts(
  siteId: string,
  config: {
    alertVelocitySpikePct: number;
    alertAnchorRepeatPct: number;
  },
  links: Array<{ anchorText: string | null }>,
  previousCount: number,
) {
  const created: Array<{ rule: string; message: string; metric: number; threshold: number }> = [];
  const current = links.length;
  if (previousCount > 0) {
    const spikePct = ((current - previousCount) / previousCount) * 100;
    if (spikePct > config.alertVelocitySpikePct) {
      created.push({
        rule: "velocity_spike",
        message: `Backlink velocity spike ${spikePct.toFixed(1)}% (threshold ${config.alertVelocitySpikePct}%)`,
        metric: spikePct,
        threshold: config.alertVelocitySpikePct,
      });
    }
  } else if (current >= 10) {
    // first run with a large batch still flags aggressive acquisition
    created.push({
      rule: "velocity_spike",
      message: `Initial external crawl indexed ${current} links — monitor velocity`,
      metric: 100,
      threshold: config.alertVelocitySpikePct,
    });
  }

  const anchors = links.map((l) => (l.anchorText || "").toLowerCase().trim()).filter(Boolean);
  if (anchors.length) {
    const counts = new Map<string, number>();
    for (const a of anchors) counts.set(a, (counts.get(a) || 0) + 1);
    const [topAnchor, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const repeatPct = (topCount / anchors.length) * 100;
    if (repeatPct > config.alertAnchorRepeatPct) {
      created.push({
        rule: "anchor_repeat",
        message: `Anchor “${topAnchor}” repeats ${repeatPct.toFixed(1)}% (threshold ${config.alertAnchorRepeatPct}%)`,
        metric: repeatPct,
        threshold: config.alertAnchorRepeatPct,
      });
    }
  }

  const rows = [];
  for (const a of created) {
    rows.push(
      await prisma.backlinkAlert.create({
        data: {
          siteId,
          rule: a.rule,
          severity: a.rule === "velocity_spike" ? "critical" : "warning",
          message: a.message,
          metric: a.metric,
          threshold: a.threshold,
          metadata: { engine: "seo.backlinks" } as Prisma.InputJsonValue,
        },
      }),
    );
  }
  return rows;
}

export async function summarizeBacklinks(
  siteId: string,
  extra: Record<string, unknown> = {},
) {
  const [total, toxic, highValue, normal, competitor, alerts, disavow, config, sample] =
    await Promise.all([
      prisma.backlink.count({ where: { siteId, competitorDomain: null } }),
      prisma.backlink.count({ where: { siteId, classification: "TOXIC" } }),
      prisma.backlink.count({ where: { siteId, classification: "HIGH_VALUE" } }),
      prisma.backlink.count({ where: { siteId, classification: "NORMAL" } }),
      prisma.backlink.count({ where: { siteId, competitorDomain: { not: null } } }),
      prisma.backlinkAlert.findMany({
        where: { siteId, resolved: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.disavowEntry.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.backlinkEngineConfig.findUnique({ where: { siteId } }),
      prisma.backlink.findMany({
        where: { siteId },
        orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
        take: 40,
        include: { sourceDomain: true },
      }),
    ]);

  return {
    summary: {
      total,
      toxic,
      highValue,
      normal,
      competitorMonitored: competitor,
      openAlerts: alerts.length,
      disavowPending: disavow.filter((d) => d.status === "pending").length,
    },
    config,
    alerts,
    disavow,
    pages: sample.map((b) => ({
      name: b.sourceUrl,
      status: b.classification.toLowerCase(),
      score: b.score != null ? Math.round(b.score * 10) / 10 : null,
      metric: b.authority,
      note: `${b.sourceApi || "?"} · spam=${b.spam} risk=${b.risk} · ${b.anchorText || "—"}`,
      competitorDomain: b.competitorDomain,
    })),
    ...extra,
  };
}

export async function exportDisavowFile(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  const entries = await prisma.disavowEntry.findMany({
    where: { siteId, status: { in: ["pending", "exported"] } },
    orderBy: { createdAt: "asc" },
  });
  const lines = [
    "# Taxotools disavow file — generated by seo.backlinks engine",
    `# ${new Date().toISOString()}`,
  ];
  const domains = new Set<string>();
  for (const e of entries) {
    if (e.domain) {
      if (!domains.has(e.domain)) {
        lines.push(`domain:${e.domain}`);
        domains.add(e.domain);
      }
    } else if (e.url) {
      lines.push(e.url);
    }
  }
  await prisma.disavowEntry.updateMany({
    where: { siteId, status: "pending" },
    data: { status: "exported", exportedAt: new Date() },
  });
  return {
    filename: `disavow-${siteId.slice(0, 8)}.txt`,
    content: lines.join("\n"),
    entries: entries.length,
  };
}

export async function listCompetitorBacklinks(userId: string, siteId: string) {
  await getSiteForUser(userId, siteId);
  const rows = await prisma.backlink.findMany({
    where: { siteId, competitorDomain: { not: null } },
    orderBy: { score: "desc" },
    take: 50,
  });
  return {
    summary: `${rows.length} competitor backlinks monitored`,
    pages: rows.map((b) => ({
      name: b.sourceUrl,
      status: b.competitorDomain || "competitor",
      score: b.score,
      metric: b.authority,
      note: b.anchorText || "",
    })),
  };
}
