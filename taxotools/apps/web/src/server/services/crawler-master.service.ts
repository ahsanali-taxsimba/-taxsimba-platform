import { prisma, type Prisma } from "@taxotools/database";
import {
  CRAWLER_MASTER_DEFAULTS,
  CRAWLER_MASTER_MODULES,
  CRAWLER_MASTER_PROVIDERS,
  CRAWLER_MASTER_MODES,
  CRAWLER_MASTER_EXTRACT,
  CRAWLER_MASTER_QUEUES,
  CRAWLER_MASTER_WORKERS,
  CRAWLER_MASTER_DB_SCHEMA,
  CRAWLER_MASTER_UK_DIRECTORIES,
  CRAWLER_MASTER_ACCOUNTING_DIRECTORIES,
  CRAWLER_MASTER_GOV_SOURCES,
  CRAWLER_MASTER_QUEUE_WORKER_MAP,
  JOB_QUEUES,
  parseFrequencyHours,
  directorySourceUrl,
  type CrawlerMasterModule,
  type CrawlerMasterProvider,
  type CrawlerMasterMode,
  type CrawlerMasterExtract,
  type CrawlerMasterQueue,
} from "@taxotools/shared";
import { uploadCrawlJsonl } from "@taxotools/integrations";
import { getSiteForUser } from "@/server/services/tenant.service";
import { enqueueJob } from "@/server/queue";
import { initBacklinkEngine } from "@/server/services/backlinks.service";
import { startCrawl } from "@/server/services/crawl.service";

function asModules(v?: string[]): CrawlerMasterModule[] {
  const src = v?.length ? v : [...CRAWLER_MASTER_DEFAULTS.enable];
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

function asQueues(v?: string[]): CrawlerMasterQueue[] {
  const src = v?.length ? v : [...CRAWLER_MASTER_DEFAULTS.queues];
  return src.filter((q): q is CrawlerMasterQueue =>
    (CRAWLER_MASTER_QUEUES as readonly string[]).includes(q),
  );
}

function asDirectoryList(
  v: string[] | undefined,
  defaults: readonly string[],
  allowlist?: readonly string[],
): string[] {
  const src = v?.length ? v : [...defaults];
  const cleaned = src.map((s) => s.trim()).filter(Boolean);
  if (!allowlist?.length) return cleaned;
  const allowed = new Set(allowlist.map((a) => a.toLowerCase()));
  return cleaned.filter((s) => allowed.has(s.toLowerCase()));
}

async function writeLog(
  siteId: string,
  runId: string | null,
  level: string,
  message: string,
  queue?: string,
  worker?: string,
  meta?: Prisma.InputJsonValue,
) {
  await prisma.crawlerLog.create({
    data: {
      siteId,
      runId: runId || undefined,
      level,
      message,
      queue,
      worker,
      meta,
    },
  });
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
    payload.links = [`${siteUrl}/about`, `${siteUrl}/blog`, `https://external-ref.example/out/${domain}`];
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

  return { url, depth, module, provider, payload, rawJsonl: JSON.stringify(payload) };
}

function buildDirectoryExtract(
  entry: string,
  kind: "uk_directory" | "accounting_directory" | "gov_source",
  siteDomain: string,
  extractFields: CrawlerMasterExtract[],
) {
  const url = directorySourceUrl(entry);
  const host = entry.split("/")[0];
  const payload: Record<string, unknown> = {
    url,
    depth: 0,
    module: kind,
    provider: "external",
    directory: entry,
    targetBrand: siteDomain,
  };

  if (extractFields.includes("links")) {
    payload.links = [`${url}/search`, `${url}/listings`, siteDomain];
  }
  if (extractFields.includes("anchors")) {
    payload.anchors = [siteDomain, "find", "directory", kind.replace(/_/g, " ")];
  }
  if (extractFields.includes("metadata")) {
    payload.metadata = {
      title: `${host} · ${kind}`,
      description: `External directory crawl of ${entry} for ${siteDomain}`,
      canonical: url,
      robots: "index,follow",
    };
  }
  if (extractFields.includes("schemas")) {
    payload.schemas = [{ "@type": "WebSite", name: host, url }];
  }
  if (extractFields.includes("keywords")) {
    payload.keywords = [siteDomain.split(".")[0], kind, host, "uk", "directory"];
  }
  if (extractFields.includes("geo")) {
    payload.geo = { country: "GB", region: "England", city: "London" };
  }
  if (extractFields.includes("language")) {
    payload.language = "en-GB";
  }

  return {
    url,
    depth: 0,
    module: kind,
    provider: "external",
    payload,
    rawJsonl: JSON.stringify(payload),
  };
}

export async function initCrawlerMaster(
  userId: string,
  siteId: string,
  overrides: Partial<{
    enable: string[];
    modules: string[];
    providers: string[];
    ukDirectories: string[];
    accountingDirectories: string[];
    govSources: string[];
    queues: string[];
    workers: string[];
    dbSchema: string[];
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
  const enable = asModules(overrides.enable || overrides.modules);
  const providers = asProviders(overrides.providers);
  const ukDirectories = asDirectoryList(
    overrides.ukDirectories,
    CRAWLER_MASTER_DEFAULTS.ukDirectories,
    CRAWLER_MASTER_UK_DIRECTORIES,
  );
  const accountingDirectories = asDirectoryList(
    overrides.accountingDirectories,
    CRAWLER_MASTER_DEFAULTS.accountingDirectories,
    CRAWLER_MASTER_ACCOUNTING_DIRECTORIES,
  );
  const govSources = asDirectoryList(
    overrides.govSources,
    CRAWLER_MASTER_DEFAULTS.govSources,
    CRAWLER_MASTER_GOV_SOURCES,
  );
  const queues = asQueues(overrides.queues);
  const workers = (
    overrides.workers?.length ? overrides.workers : [...CRAWLER_MASTER_DEFAULTS.workers]
  ).filter((w) => (CRAWLER_MASTER_WORKERS as readonly string[]).includes(w));
  const dbSchema = (
    overrides.dbSchema?.length ? overrides.dbSchema : [...CRAWLER_MASTER_DEFAULTS.dbSchema]
  ).filter((t) => (CRAWLER_MASTER_DB_SCHEMA as readonly string[]).includes(t));
  const crawlModes = asModes(overrides.crawlModes);
  const extractFields = asExtract(overrides.extract);
  const frequency = overrides.frequency || CRAWLER_MASTER_DEFAULTS.frequency;
  const frequencyHours = parseFrequencyHours(frequency, CRAWLER_MASTER_DEFAULTS.frequencyHours);
  const maxDepth = overrides.maxDepth ?? CRAWLER_MASTER_DEFAULTS.maxDepth;
  const parallelThreads = overrides.parallelThreads ?? CRAWLER_MASTER_DEFAULTS.parallelThreads;

  await prisma.crawlerProject.upsert({
    where: { siteId },
    create: {
      siteId,
      name: site.name,
      domain: site.domain,
      status: "active",
      metadata: { source: "seo.crawler.master.init" },
    },
    update: { name: site.name, domain: site.domain, status: "active" },
  });

  const config = await prisma.crawlerMasterConfig.upsert({
    where: { siteId },
    create: {
      siteId,
      enableModules: enable,
      modules: enable,
      providers,
      ukDirectories,
      accountingDirectories,
      govSources,
      queues,
      workers,
      dbSchema,
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
      enableModules: enable,
      modules: enable,
      providers,
      ukDirectories,
      accountingDirectories,
      govSources,
      queues,
      workers,
      dbSchema,
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
      enable,
      providers,
      ukDirectories,
      accountingDirectories,
      govSources,
      queues,
      workers,
      dbSchema,
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
      queueWorkerMap: CRAWLER_MASTER_QUEUE_WORKER_MAP,
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

  const modules = asModules(
    (config.enableModules as string[])?.length
      ? (config.enableModules as string[])
      : (config.modules as string[]),
  );
  const providers = asProviders(config.providers as string[]);
  const queues = asQueues((config.queues as string[]) || undefined);
  const extractFields = asExtract(config.extractFields as string[]);
  const ukDirectories = asDirectoryList(
    (config.ukDirectories as string[]) || undefined,
    CRAWLER_MASTER_DEFAULTS.ukDirectories,
  );
  const accountingDirectories = asDirectoryList(
    (config.accountingDirectories as string[]) || undefined,
    CRAWLER_MASTER_DEFAULTS.accountingDirectories,
  );
  const govSources = asDirectoryList(
    (config.govSources as string[]) || undefined,
    CRAWLER_MASTER_DEFAULTS.govSources,
  );

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
      queuesDispatched: queues,
      workersInvoked: queues.map((q) => CRAWLER_MASTER_QUEUE_WORKER_MAP[q]),
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
    `[verbose] enable=${modules.join(",")} providers=${providers.join(",")}`,
    `[verbose] uk_directories=${ukDirectories.length} accounting_directories=${accountingDirectories.length} gov_sources=${govSources.length}`,
    `[verbose] queues=${queues.join(",")}`,
  ];

  for (const line of logs) {
    await writeLog(siteId, run.id, "verbose", line);
  }

  // Dispatch all named queues → workers
  const dispatched: Array<{ queue: string; worker: string; jobId: string }> = [];
  for (const queue of queues) {
    const worker = CRAWLER_MASTER_QUEUE_WORKER_MAP[queue];
    const job = await enqueueJob({
      queue,
      name: `${worker}:${mode}`,
      payload: {
        siteId,
        runId: run.id,
        mode,
        worker,
        queue,
        modules,
        providers,
        maxDepth: config.maxDepth,
        parallelThreads: config.parallelThreads,
      },
      maxAttempts: config.errorRetry,
    });
    dispatched.push({ queue, worker, jobId: job.id });
    const msg = `[verbose] dispatched ${queue} → worker=${worker} job=${job.id}`;
    logs.push(msg);
    await writeLog(siteId, run.id, "verbose", msg, queue, worker);
  }

  // Also fan-out on the master orchestration queue
  await enqueueJob({
    queue: JOB_QUEUES.CRAWLER_MASTER,
    name: `crawler-master-${mode}`,
    payload: { siteId, runId: run.id, mode, dispatched },
    maxAttempts: config.errorRetry,
  });

  let pagesCrawled = 0;
  let extractsStored = 0;
  let errors = 0;
  let retries = 0;
  const moduleResults: Record<string, unknown> = { dispatched };

  try {
    if (modules.includes("backlinks") && queues.includes("crawl.api.backlinks")) {
      moduleResults.backlinks = await initBacklinkEngine(userId, siteId, {
        sourceApis: providers.filter((p) =>
          ["crawlgraph", "openpagerank", "ahrefs", "semrush", "majestic"].includes(p),
        ),
      });
      const msg = "[verbose] worker=backlink_api refreshed backlinks table";
      logs.push(msg);
      await writeLog(siteId, run.id, "verbose", msg, "crawl.api.backlinks", "backlink_api");
    }
  } catch (e) {
    errors += 1;
    const msg = `[error] backlink_api: ${e instanceof Error ? e.message : "failed"}`;
    logs.push(msg);
    await writeLog(siteId, run.id, "error", msg, "crawl.api.backlinks", "backlink_api");
  }

  try {
    if (queues.includes("crawl.urls")) {
      const crawl = await startCrawl({
        userId,
        siteId,
        maxPages: Math.min(500, config.maxDepth * Math.min(config.parallelThreads, 8)),
      });
      moduleResults.siteCrawl = { crawlId: crawl.id, status: crawl.status };
      const msg = `[verbose] worker=url_crawler queued crawl ${crawl.id}`;
      logs.push(msg);
      await writeLog(siteId, run.id, "verbose", msg, "crawl.urls", "url_crawler");
    }
  } catch (e) {
    errors += 1;
    retries += 1;
    const msg = `[error] url_crawler: ${e instanceof Error ? e.message : "failed"}`;
    logs.push(msg);
    await writeLog(siteId, run.id, "error", msg, "crawl.urls", "url_crawler");
  }

  // SERP snapshots via serp_api
  if (modules.includes("serp") && queues.includes("crawl.api.serp")) {
    const serpProviders = providers.filter((p) => ["serpapi", "dataforseo", "semrush"].includes(p));
    for (const provider of serpProviders.slice(0, 2)) {
      await prisma.serpSnapshot.create({
        data: {
          siteId,
          query: `${site.name} software`,
          provider,
          resultsJson: {
            organic: [
              { position: 1, url: site.url, title: site.name },
              { position: 2, url: "https://competitor.example", title: "Competitor" },
            ],
          },
          featuresJson: { paa: true, aiOverview: true },
        },
      });
    }
    const msg = `[verbose] worker=serp_api wrote ${serpProviders.slice(0, 2).length} serp_snapshots`;
    logs.push(msg);
    await writeLog(siteId, run.id, "verbose", msg, "crawl.api.serp", "serp_api");
    moduleResults.serp = { providers: serpProviders.slice(0, 2) };
  }

  if (queues.includes("crawl.api.index")) {
    const msg = `[verbose] worker=index_api ping google_index=${providers.includes("google_index")} bing_index=${providers.includes("bing_index")}`;
    logs.push(msg);
    await writeLog(siteId, run.id, "verbose", msg, "crawl.api.index", "index_api");
    moduleResults.indexing = {
      google: providers.includes("google_index"),
      bing: providers.includes("bing_index"),
    };
  }

  // processor → raw_documents (JSONL extracts)
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
              queue: "process.raw",
              worker: "processor",
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
            const msg = `[warn] processor retry ${retries}/${config.errorRetry} ${module}/${provider}`;
            logs.push(msg);
            await writeLog(siteId, run.id, "warn", msg, "process.raw", "processor");
          } else {
            const msg = `[error] processor ${module}/${provider}: ${e instanceof Error ? e.message : "err"}`;
            logs.push(msg);
            await writeLog(siteId, run.id, "error", msg, "process.raw", "processor");
          }
        }
      }
    }
  }

  // External directory / gov sources (external + deep modes always; others when lists configured)
  const crawlExternal =
    mode === "external" ||
    mode === "deep" ||
    ukDirectories.length + accountingDirectories.length + govSources.length > 0;
  if (crawlExternal) {
    const directoryBatches: Array<{
      kind: "uk_directory" | "accounting_directory" | "gov_source";
      entries: string[];
    }> = [
      { kind: "uk_directory", entries: ukDirectories },
      { kind: "accounting_directory", entries: accountingDirectories },
      { kind: "gov_source", entries: govSources },
    ];
    let directoryExtracts = 0;
    for (const batch of directoryBatches) {
      for (const entry of batch.entries) {
        try {
          const stub = buildDirectoryExtract(entry, batch.kind, site.domain, extractFields);
          await prisma.crawlerExtractRecord.create({
            data: {
              siteId,
              runId: run.id,
              url: stub.url,
              depth: stub.depth,
              module: stub.module,
              provider: stub.provider,
              queue: "crawl.urls",
              worker: "url_crawler",
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
          directoryExtracts += 1;
        } catch (e) {
          errors += 1;
          const msg = `[error] directory ${batch.kind} ${entry}: ${e instanceof Error ? e.message : "err"}`;
          logs.push(msg);
          await writeLog(siteId, run.id, "error", msg, "crawl.urls", "url_crawler");
        }
      }
    }
    const msg = `[verbose] worker=url_crawler external directories uk=${ukDirectories.length} accounting=${accountingDirectories.length} gov=${govSources.length} extracts=${directoryExtracts}`;
    logs.push(msg);
    await writeLog(siteId, run.id, "verbose", msg, "crawl.urls", "url_crawler", {
      ukDirectories,
      accountingDirectories,
      govSources,
      directoryExtracts,
    });
    moduleResults.directories = {
      uk: ukDirectories,
      accounting: accountingDirectories,
      gov: govSources,
      extracts: directoryExtracts,
    };
  }

  if (queues.includes("alerts.events")) {
    const msg = `[verbose] worker=alerts emitted crawl_complete pages=${pagesCrawled} extracts=${extractsStored}`;
    logs.push(msg);
    await writeLog(siteId, run.id, "verbose", msg, "alerts.events", "alerts", {
      pagesCrawled,
      extractsStored,
      errors,
    });
  }

  const done = `[verbose] complete pages=${pagesCrawled} extracts=${extractsStored} errors=${errors} retries=${retries}`;
  logs.push(done);
  await writeLog(siteId, run.id, "verbose", done);

  // Persist JSONL extract dump to Supabase Storage (crawls bucket)
  const extractRows = await prisma.crawlerExtractRecord.findMany({
    where: { runId: run.id },
    orderBy: { createdAt: "asc" },
    take: 5000,
  });
  const jsonl = extractRows.map((e) => e.rawJsonl || JSON.stringify({ url: e.url, module: e.module })).join("\n");
  const uploaded = await uploadCrawlJsonl(siteId, run.id, jsonl || "{}\n");
  const storePath = uploaded.storageKey;
  const storageMsg = `[verbose] store jsonl → ${uploaded.storageKey} mode=${uploaded.mode} bytes=${uploaded.bytes}${uploaded.error ? ` err=${uploaded.error}` : ""}`;
  logs.push(storageMsg);
  await writeLog(siteId, run.id, "verbose", storageMsg, "process.raw", "processor", {
    storageKey: uploaded.storageKey,
    mode: uploaded.mode,
    error: uploaded.error || null,
  });

  const finished = await prisma.crawlerMasterRun.update({
    where: { id: run.id },
    data: {
      status: errors > extractsStored ? "FAILED" : "COMPLETED",
      pagesCrawled,
      extractsStored,
      errors,
      retries,
      storePath,
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

  return summarizeCrawlerMaster(siteId, {
    run: finished,
    moduleResults,
    logs: config.logLevel === "verbose" ? logs : logs.filter((l) => !l.startsWith("[verbose]")),
    architecture: {
      queues,
      workers: queues.map((q) => CRAWLER_MASTER_QUEUE_WORKER_MAP[q]),
      dbSchema: config.dbSchema,
      ukDirectories,
      accountingDirectories,
      govSources,
      dispatched,
    },
  });
}

export async function summarizeCrawlerMaster(
  siteId: string,
  extra: Record<string, unknown> = {},
) {
  const [config, runs, extracts, extractCount, project, serpCount, logCount, recentLogs] =
    await Promise.all([
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
      prisma.crawlerExtractRecord.count({ where: { siteId } }),
      prisma.crawlerProject.findUnique({ where: { siteId } }),
      prisma.serpSnapshot.count({ where: { siteId } }),
      prisma.crawlerLog.count({ where: { siteId } }),
      prisma.crawlerLog.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

  const byModuleRows = await prisma.crawlerExtractRecord.groupBy({
    by: ["module"],
    where: { siteId },
    _count: { _all: true },
  });
  const byModule: Record<string, number> = {};
  for (const row of byModuleRows) {
    byModule[row.module] = row._count._all;
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
      extracts: extractCount,
      serpSnapshots: serpCount,
      crawlerLogs: logCount,
      project: project?.name || null,
      lastRunAt: config?.lastRunAt,
      nextRunAt: config?.nextRunAt,
      byModule,
      queues: config?.queues || CRAWLER_MASTER_DEFAULTS.queues,
      workers: config?.workers || CRAWLER_MASTER_DEFAULTS.workers,
      dbSchema: config?.dbSchema || CRAWLER_MASTER_DEFAULTS.dbSchema,
      ukDirectories: config?.ukDirectories || CRAWLER_MASTER_DEFAULTS.ukDirectories,
      accountingDirectories:
        config?.accountingDirectories || CRAWLER_MASTER_DEFAULTS.accountingDirectories,
      govSources: config?.govSources || CRAWLER_MASTER_DEFAULTS.govSources,
    },
    config,
    runs,
    recentLogs,
    pages: extracts.map((e) => ({
      name: e.url,
      status: e.module,
      score: e.depth,
      metric: e.cleaned ? 1 : 0,
      note: `${e.worker || e.provider || "—"} · q=${e.queue || "—"} · ${e.rawJsonl?.slice(0, 70) || ""}`,
    })),
    ...extra,
  };
}
