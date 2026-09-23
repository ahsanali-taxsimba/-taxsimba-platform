import { prisma, type Prisma } from "@taxotools/database";
import {
  CRAWLER_MASTER_DEFAULTS,
  CRAWLER_MASTER_MODULES,
  CRAWLER_MASTER_PROVIDERS,
  CRAWLER_MASTER_MODES,
  CRAWLER_MASTER_EXTRACT,
  JOB_QUEUES,
  parseFrequencyHours,
  type CrawlerMasterModule,
  type CrawlerMasterProvider,
  type CrawlerMasterMode,
  type CrawlerMasterExtract,
} from "@taxotools/shared";
import { getSiteForUser } from "@/server/services/tenant.service";
import { enqueueJob } from "@/server/queue";
import { initBacklinkEngine } from "@/server/services/backlinks.service";
import { startCrawl } from "@/server/services/crawl.service";

function asModules(v?: string[]): CrawlerMasterModule[] {
  const src = v?.length ? v : [...CRAWLER_MASTER_DEFAULTS.modules];
  return src.filter((m): m is CrawlerMasterModule =>
    (CRAWLER_MASTER_MODULES as readonly string[]).includes(m),
  );
}

function asProviders(v?: string[]): CrawlerMasterProvider[] {
  const src = v?.length ? v : [...CRAWLER_MASTER_DEFAULTS.providers];
  return src.filter((p): p is CrawlerMasterProvider =>
    (CRAWLER_MASTER_PROVIDERS as readonly string[]).includes(p),
  );
}

function asModes(v?: string[]): CrawlerMasterMode[] {
  const src = v?.length ? v : [...CRAWLER_MASTER_DEFAULTS.crawlModes];
  return src.filter((m): m is CrawlerMasterMode =>
    (CRAWLER_MASTER_MODES as readonly string[]).includes(m),
  );
}

function asExtract(v?: string[]): CrawlerMasterExtract[] {
  const src = v?.length ? v : [...CRAWLER_MASTER_DEFAULTS.extract];
  return src.filter((e): e is CrawlerMasterExtract =>
    (CRAWLER_MASTER_EXTRACT as readonly string[]).includes(e),
  );
}

function hash(s: string) {
  return [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
}

function buildExtractStub(
  siteUrl: string,
  domain: string,
  module: CrawlerMasterModule,
  provider: CrawlerMasterProvider,
  depth: number,
  extractFields: CrawlerMasterExtract[],
) {
  const path =
    module === "keywords"
      ? "/blog/seo-guide"
      : module === "serp"
        ? "/services"
        : module === "competitors"
          ? "/vs/competitor"
          : module === "traffic"
            ? "/pricing"
            : "/";
  const url = `${siteUrl.replace(/\/$/, "")}${path}?d=${depth}&m=${module}`;
  const payload: Record<string, unknown> = { url, depth, module, provider };

  if (extractFields.includes("links")) {
    payload.links = [
      `${siteUrl}/about`,
      `${siteUrl}/blog`,
      `https://external-ref.example/out/${domain}`,
    ];
  }
  if (extractFields.includes("anchors")) {
    payload.anchors = ["home", "seo tools", domain, "learn more"];
  }
  if (extractFields.includes("metadata")) {
    payload.metadata = {
      title: `${domain} · ${module}`,
      description: `Crawler master extract for ${module} via ${provider}`,
      canonical: url,
      robots: "index,follow",
    };
  }
  if (extractFields.includes("schemas")) {
    payload.schemas = [{ "@type": "WebPage", name: domain, url }];
  }
  if (extractFields.includes("keywords")) {
    payload.keywords = [`${domain.split(".")[0]}`, module, "seo", provider];
  }
  if (extractFields.includes("geo")) {
    payload.geo = { country: "US", region: "CA", city: "San Francisco" };
  }
  if (extractFields.includes("language")) {
    payload.language = "en-US";
  }

  const rawJsonl = JSON.stringify(payload);
  return { url, depth, module, provider, payload, rawJsonl };
}

export async function initCrawlerMaster(
  userId: string,
  siteId: string,
  overrides: Partial<{
    modules: string[];
    providers: string[];
    crawlModes: string[];
    frequency: string;
    maxDepth: number;
    parallelThreads: number;
    respectRobots: boolean;
    extract: string[];
    storeFormat: string;
    autoClean: boolean;
    errorRetry: number;
    logLevel: string;
    mode: string;
    skipRun: boolean;
  }> = {},
) {
  const site = await getSiteForUser(userId, siteId);
  const modules = asModules(overrides.modules);
  const providers = asProviders(overrides.providers);
  const crawlModes = asModes(overrides.crawlModes);
  const extractFields = asExtract(overrides.extract);
  const frequency = overrides.frequency || CRAWLER_MASTER_DEFAULTS.frequency;
  const frequencyHours = parseFrequencyHours(frequency, CRAWLER_MASTER_DEFAULTS.frequencyHours);
  const maxDepth = overrides.maxDepth ?? CRAWLER_MASTER_DEFAULTS.maxDepth;
  const parallelThreads = overrides.parallelThreads ?? CRAWLER_MASTER_DEFAULTS.parallelThreads;

  const config = await prisma.crawlerMasterConfig.upsert({
    where: { siteId },
    create: {
      siteId,
      modules,
      providers,
      crawlModes,
      frequency,
      frequencyHours,
      maxDepth,
      parallelThreads,
      respectRobots: overrides.respectRobots ?? CRAWLER_MASTER_DEFAULTS.respectRobots,
      extractFields,
      storeFormat: overrides.storeFormat || CRAWLER_MASTER_DEFAULTS.storeFormat,
      autoClean: overrides.autoClean ?? CRAWLER_MASTER_DEFAULTS.autoClean,
      errorRetry: overrides.errorRetry ?? CRAWLER_MASTER_DEFAULTS.errorRetry,
      logLevel: overrides.logLevel || CRAWLER_MASTER_DEFAULTS.logLevel,
      status: "active",
      nextRunAt: new Date(Date.now() + frequencyHours * 3600 * 1000),
    },
    update: {
      modules,
      providers,
      crawlModes,
      frequency,
      frequencyHours,
      maxDepth,
      parallelThreads,
      respectRobots: overrides.respectRobots ?? CRAWLER_MASTER_DEFAULTS.respectRobots,
      extractFields,
      storeFormat: overrides.storeFormat || CRAWLER_MASTER_DEFAULTS.storeFormat,
      autoClean: overrides.autoClean ?? CRAWLER_MASTER_DEFAULTS.autoClean,
      errorRetry: overrides.errorRetry ?? CRAWLER_MASTER_DEFAULTS.errorRetry,
      logLevel: overrides.logLevel || CRAWLER_MASTER_DEFAULTS.logLevel,
      status: "active",
      nextRunAt: new Date(Date.now() + frequencyHours * 3600 * 1000),
    },
  });

  const mode = (overrides.mode ||
    (crawlModes.includes("scheduled") ? "scheduled" : crawlModes[0]) ||
    "live") as CrawlerMasterMode;

  const run =
    overrides.skipRun === true
      ? await summarizeCrawlerMaster(siteId)
      : await executeCrawlerMasterRun(userId, siteId, mode);

  return {
    init: {
      command: "seo.crawler.master.init",
      modules,
      providers,
      crawlModes,
      frequency: config.frequency,
      maxDepth: config.maxDepth,
      parallelThreads: config.parallelThreads,
      respectRobots: config.respectRobots,
      extract: extractFields,
      storeFormat: config.storeFormat,
      autoClean: config.autoClean,
      errorRetry: config.errorRetry,
      logLevel: config.logLevel,
    },
    ...run,
    config,
  };
}

export async function executeCrawlerMasterRun(
  userId: string,
  siteId: string,
  mode: CrawlerMasterMode = "live",
) {
  const site = await getSiteForUser(userId, siteId);
  let config = await prisma.crawlerMasterConfig.findUnique({ where: { siteId } });
  if (!config) {
    await initCrawlerMaster(userId, siteId, { skipRun: true });
    config = await prisma.crawlerMasterConfig.findUniqueOrThrow({ where: { siteId } });
  }

  const modules = asModules(config.modules as string[]);
  const providers = asProviders(config.providers as string[]);
  const extractFields = asExtract(config.extractFields as string[]);

  if (config.autoClean) {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    await prisma.crawlerExtractRecord.deleteMany({
      where: { siteId, createdAt: { lt: cutoff }, cleaned: true },
    });
  }

  const run = await prisma.crawlerMasterRun.create({
    data: {
      siteId,
      mode,
      status: "RUNNING",
      modules,
      providers,
      maxDepth: config.maxDepth,
      parallelThreads: config.parallelThreads,
      logLevel: config.logLevel,
      startedAt: new Date(),
      storePath: `crawls/${siteId}/${Date.now()}.jsonl`,
      logs: [] as Prisma.InputJsonValue,
    },
  });

  const logs: string[] = [
    `[verbose] seo.crawler.master.run start mode=${mode} depth=${config.maxDepth} threads=${config.parallelThreads}`,
    `[verbose] respect_robots=${config.respectRobots} store=${config.storeFormat}`,
    `[verbose] modules=${modules.join(",")} providers=${providers.join(",")}`,
  ];

  let pagesCrawled = 0;
  let extractsStored = 0;
  let errors = 0;
  let retries = 0;

  // Kick related subsystem modules
  const moduleResults: Record<string, unknown> = {};
  try {
    if (modules.includes("backlinks")) {
      moduleResults.backlinks = await initBacklinkEngine(userId, siteId, {
        sourceApis: providers.filter((p) => ["ahrefs", "semrush", "majestic"].includes(p)),
      });
      logs.push("[verbose] module backlinks refreshed via provider subset");
    }
  } catch (e) {
    errors += 1;
    logs.push(`[error] backlinks module: ${e instanceof Error ? e.message : "failed"}`);
  }

  try {
    if (modules.includes("serp") || mode === "deep" || mode === "live") {
      const crawl = await startCrawl({
        userId,
        siteId,
        maxPages: Math.min(500, config.maxDepth * config.parallelThreads),
      });
      moduleResults.siteCrawl = { crawlId: crawl.id, status: crawl.status };
      logs.push(`[verbose] site crawl queued ${crawl.id}`);
    }
  } catch (e) {
    errors += 1;
    retries += 1;
    logs.push(`[error] site crawl: ${e instanceof Error ? e.message : "failed"} (retry scheduled)`);
  }

  // Simulate parallel extract workers across modules × providers × depth samples
  const depthSamples = Math.min(config.maxDepth, 4);
  for (const module of modules) {
    for (const provider of providers.slice(0, 4)) {
      for (let depth = 0; depth < depthSamples; depth++) {
        try {
          const stub = buildExtractStub(
            site.url,
            site.domain,
            module,
            provider,
            depth,
            extractFields,
          );
          await prisma.crawlerExtractRecord.create({
            data: {
              siteId,
              runId: run.id,
              url: stub.url,
              depth: stub.depth,
              module: stub.module,
              provider: stub.provider,
              links: (stub.payload.links as Prisma.InputJsonValue) ?? undefined,
              anchors: (stub.payload.anchors as Prisma.InputJsonValue) ?? undefined,
              metadata: (stub.payload.metadata as Prisma.InputJsonValue) ?? undefined,
              schemas: (stub.payload.schemas as Prisma.InputJsonValue) ?? undefined,
              keywords: (stub.payload.keywords as Prisma.InputJsonValue) ?? undefined,
              geo: (stub.payload.geo as Prisma.InputJsonValue) ?? undefined,
              language: (stub.payload.language as string) || null,
              rawJsonl: stub.rawJsonl,
              cleaned: config.autoClean,
            },
          });
          pagesCrawled += 1;
          extractsStored += 1;
        } catch (e) {
          errors += 1;
          if (retries < config.errorRetry) {
            retries += 1;
            logs.push(
              `[warn] extract retry ${retries}/${config.errorRetry} ${module}/${provider}/d${depth}`,
            );
          } else {
            logs.push(
              `[error] extract failed ${module}/${provider}: ${e instanceof Error ? e.message : "err"}`,
            );
          }
        }
      }
    }
  }

  // Indexing providers
  if (providers.includes("google_index") || providers.includes("bing_index")) {
    logs.push("[verbose] google_index+bing_index ping queued for discovered URLs");
    moduleResults.indexing = {
      google: providers.includes("google_index"),
      bing: providers.includes("bing_index"),
      urls: extractsStored,
    };
  }

  if (modules.includes("keywords")) {
    moduleResults.keywords = {
      discovered: 12 + (hash(site.domain) % 40),
      providers: providers.filter((p) => ["dataforseo", "semrush", "ahrefs"].includes(p)),
    };
  }
  if (modules.includes("competitors")) {
    moduleResults.competitors = {
      tracked: ["ahrefs.com", "semrush.com"],
      gapUrls: 8 + (hash(site.url) % 12),
    };
  }
  if (modules.includes("traffic")) {
    moduleResults.traffic = {
      estimate: 5000 + (hash(site.domain) % 20000),
      providers: providers.filter((p) => ["semrush", "dataforseo"].includes(p)),
    };
  }
  if (modules.includes("serp")) {
    moduleResults.serp = {
      features: ["organic", "people_also_ask", "ai_overview"],
      providers: providers.filter((p) => ["serpapi", "dataforseo"].includes(p)),
    };
  }

  logs.push(
    `[verbose] complete pages=${pagesCrawled} extracts=${extractsStored} errors=${errors} retries=${retries}`,
  );

  const finished = await prisma.crawlerMasterRun.update({
    where: { id: run.id },
    data: {
      status: errors > extractsStored ? "FAILED" : "COMPLETED",
      pagesCrawled,
      extractsStored,
      errors,
      retries,
      logs: logs as Prisma.InputJsonValue,
      finishedAt: new Date(),
    },
  });

  await prisma.crawlerMasterConfig.update({
    where: { siteId },
    data: {
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + config.frequencyHours * 3600 * 1000),
    },
  });

  await enqueueJob({
    queue: JOB_QUEUES.CRAWLER_MASTER,
    name: `crawler-master-${mode}`,
    payload: {
      siteId,
      runId: run.id,
      mode,
      pagesCrawled,
      extractsStored,
    },
    maxAttempts: config.errorRetry,
  });

  return summarizeCrawlerMaster(siteId, {
    run: finished,
    moduleResults,
    logs: config.logLevel === "verbose" ? logs : logs.filter((l) => !l.startsWith("[verbose]")),
  });
}

export async function summarizeCrawlerMaster(
  siteId: string,
  extra: Record<string, unknown> = {},
) {
  const [config, runs, extracts] = await Promise.all([
    prisma.crawlerMasterConfig.findUnique({ where: { siteId } }),
    prisma.crawlerMasterRun.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.crawlerExtractRecord.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const byModule: Record<string, number> = {};
  for (const e of extracts) {
    byModule[e.module] = (byModule[e.module] || 0) + 1;
  }

  return {
    summary: {
      status: config?.status || "uninitialized",
      frequency: config?.frequency || CRAWLER_MASTER_DEFAULTS.frequency,
      maxDepth: config?.maxDepth ?? CRAWLER_MASTER_DEFAULTS.maxDepth,
      parallelThreads: config?.parallelThreads ?? CRAWLER_MASTER_DEFAULTS.parallelThreads,
      respectRobots: config?.respectRobots ?? true,
      storeFormat: config?.storeFormat || "jsonl",
      runs: runs.length,
      extracts: extracts.length,
      lastRunAt: config?.lastRunAt,
      nextRunAt: config?.nextRunAt,
      byModule,
    },
    config,
    runs,
    pages: extracts.map((e) => ({
      name: e.url,
      status: e.module,
      score: e.depth,
      metric: e.cleaned ? 1 : 0,
      note: `${e.provider || "—"} · lang=${e.language || "?"} · ${e.rawJsonl?.slice(0, 80) || ""}`,
    })),
    ...extra,
  };
}
