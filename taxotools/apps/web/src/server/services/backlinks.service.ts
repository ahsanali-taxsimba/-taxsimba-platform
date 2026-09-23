import { prisma, type BacklinkClassification, type Prisma } from "@taxotools/database";
import {
  BACKLINK_ENGINE_DEFAULTS,
  BACKLINK_SOURCE_APIS,
  computeBacklinkScore,
  classifyBacklink,
  JOB_QUEUES,
  type BacklinkSourceApi,
} from "@taxotools/shared";
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
  sourceApi: BacklinkSourceApi;
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

function hash(s: string) {
  return [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
}

function toPrismaClass(c: ReturnType<typeof classifyBacklink>): BacklinkClassification {
  if (c === "toxic") return "TOXIC";
  if (c === "high_value") return "HIGH_VALUE";
  if (c === "lost") return "LOST";
  return "NORMAL";
}

/** Stub providers — replace with Ahrefs / Semrush / Majestic SDKs */
function fetchFromProvider(
  api: BacklinkSourceApi,
  siteDomain: string,
  siteUrl: string,
  competitors: string[],
): RawLink[] {
  const seeds = [
    { host: "forbes.com", auth: 92, spam: 2, rel: 0.82 },
    { host: "hubspot.com", auth: 91, spam: 5, rel: 0.78 },
    { host: "searchenginejournal.com", auth: 88, spam: 8, rel: 0.91 },
    { host: "moz.com", auth: 91, spam: 6, rel: 0.85 },
    { host: "techcrunch.com", auth: 89, spam: 4, rel: 0.55 },
    { host: "medium.com", auth: 94, spam: 18, rel: 0.42 },
    { host: "spam-directory.biz", auth: 12, spam: 88, rel: 0.05 },
    { host: "cheap-pbn.network", auth: 8, spam: 95, rel: 0.02 },
    { host: "guestpost-farm.ru", auth: 15, spam: 76, rel: 0.12 },
    { host: "niche-blog.io", auth: 46, spam: 14, rel: 0.74 },
    { host: "local-chamber.org", auth: 38, spam: 9, rel: 0.68 },
    { host: "industry-wiki.net", auth: 52, spam: 11, rel: 0.8 },
  ];

  const offset = hash(api + siteDomain) % 5;
  const picks = seeds.slice(offset).concat(seeds.slice(0, offset)).slice(0, 8);

  const links: RawLink[] = picks.map((p, i) => {
    const risk = Math.min(1, p.spam / 100 + (p.rel < 0.2 ? 0.35 : 0.05) + (api === "majestic" ? 0.02 : 0));
    return {
      sourceUrl: `https://${p.host}/article/${api}-${siteDomain.replace(/\./g, "-")}-${i}`,
      targetUrl: i % 3 === 0 ? siteUrl : `${siteUrl}/blog`,
      anchorText:
        i % 4 === 0
          ? siteDomain
          : i % 4 === 1
            ? "click here"
            : i % 4 === 2
              ? "seo tools"
              : "best platform",
      authority: p.auth + (hash(api) % 3),
      relevance: p.rel,
      spam: p.spam,
      risk: Math.round(risk * 100) / 100,
      sourceApi: api,
      relNofollow: p.spam > 50,
    };
  });

  // Competitor monitoring samples
  for (const comp of competitors.slice(0, 2)) {
    links.push({
      sourceUrl: `https://outreach-mag.com/mentions/${comp}`,
      targetUrl: `https://${comp}/`,
      anchorText: comp.split(".")[0],
      authority: 55 + (hash(comp) % 30),
      relevance: 0.6 + (hash(comp) % 30) / 100,
      spam: 10 + (hash(comp + api) % 20),
      risk: 0.15,
      sourceApi: api,
      competitorDomain: comp,
    });
  }

  return links;
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

  const raw: RawLink[] = [];
  for (const api of apis) {
    raw.push(...fetchFromProvider(api, site.domain, site.url, competitors));
  }

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

  return summarizeBacklinks(siteId, { upserted, alerts, disavowQueued });
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
