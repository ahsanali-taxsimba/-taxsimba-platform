/** Plan codes — Search Atlas–competitive ladder + Enterprise */
export const PLAN_CODES = ["STARTER", "GROWTH", "PRO", "AGENCY", "ENTERPRISE"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/** Default usage limits per plan (overridable in DB) */
export const PLAN_LIMITS: Record<
  PlanCode,
  {
    sites: number;
    keywords: number;
    crawlsPerMonth: number;
    aiCreditsPerMonth: number;
    aeoScansPerMonth: number;
    teamSeats: number;
    /** Autopilot SEO projects (Taxo Agent / Auto SEO) */
    ottoProjects: number;
    llmVisibilityPlatforms: number;
    whiteLabel: boolean;
    apiAccess: boolean;
    outreachCrm: boolean;
    smartAds: boolean;
    cmsPublish: boolean;
  }
> = {
  STARTER: {
    sites: 1,
    keywords: 2000,
    crawlsPerMonth: 20,
    aiCreditsPerMonth: 500,
    aeoScansPerMonth: 0,
    teamSeats: 1,
    ottoProjects: 1,
    llmVisibilityPlatforms: 0,
    whiteLabel: false,
    apiAccess: false,
    outreachCrm: false,
    smartAds: false,
    cmsPublish: true,
  },
  GROWTH: {
    sites: 2,
    keywords: 3500,
    crawlsPerMonth: 50,
    aiCreditsPerMonth: 1000,
    aeoScansPerMonth: 50,
    teamSeats: 3,
    ottoProjects: 2,
    llmVisibilityPlatforms: 3,
    whiteLabel: false,
    apiAccess: false,
    outreachCrm: true,
    smartAds: true,
    cmsPublish: true,
  },
  PRO: {
    sites: 4,
    keywords: 6000,
    crawlsPerMonth: 200,
    aiCreditsPerMonth: 2500,
    aeoScansPerMonth: 200,
    teamSeats: 5,
    ottoProjects: 4,
    llmVisibilityPlatforms: 5,
    whiteLabel: true,
    apiAccess: false,
    outreachCrm: true,
    smartAds: true,
    cmsPublish: true,
  },
  AGENCY: {
    sites: 10,
    keywords: 50000,
    crawlsPerMonth: 1000,
    aiCreditsPerMonth: 10000,
    aeoScansPerMonth: 2000,
    teamSeats: 10,
    ottoProjects: 10,
    llmVisibilityPlatforms: 5,
    whiteLabel: true,
    apiAccess: true,
    outreachCrm: true,
    smartAds: true,
    cmsPublish: true,
  },
  ENTERPRISE: {
    sites: -1,
    keywords: -1,
    crawlsPerMonth: -1,
    aiCreditsPerMonth: -1,
    aeoScansPerMonth: -1,
    teamSeats: -1,
    ottoProjects: -1,
    llmVisibilityPlatforms: -1,
    whiteLabel: true,
    apiAccess: true,
    outreachCrm: true,
    smartAds: true,
    cmsPublish: true,
  },
};

/** List prices in cents — aligned with Search Atlas try-now tiers */
export const PLAN_PRICES_CENTS: Record<PlanCode, number> = {
  STARTER: 9900,
  GROWTH: 19900,
  PRO: 39900,
  AGENCY: 99900,
  ENTERPRISE: 0,
};

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const SEARCH_INTENTS = [
  "INFORMATIONAL",
  "COMMERCIAL",
  "TRANSACTIONAL",
  "NAVIGATIONAL",
] as const;
export type SearchIntent = (typeof SEARCH_INTENTS)[number];

export const JOB_QUEUES = {
  CRAWL: "taxotools-crawl",
  RANK: "taxotools-rank",
  AI_CONTENT: "taxotools-ai-content",
  AEO_SCAN: "taxotools-aeo-scan",
  REPORT: "taxotools-report",
  BACKLINK: "taxotools-backlink",
  LOG_ANALYZE: "taxotools-log-analyze",
  PPC_RESEARCH: "taxotools-ppc-research",
  AUTO_SEO: "taxotools-auto-seo",
  CMS_PUBLISH: "taxotools-cms-publish",
  SMART_ADS: "taxotools-smart-ads",
  WILDFIRE: "taxotools-wildfire",
  HYPERDRIVE: "taxotools-hyperdrive",
  QUEST: "taxotools-quest",
  INSTANT_INDEX: "taxotools-instant-index",
  ALERTS: "taxotools-alerts",
  BACKLINK_REFRESH: "taxotools-backlink-refresh",
  CRAWLER_MASTER: "taxotools-crawler-master",
  CRAWL_URLS: "crawl.urls",
  CRAWL_API_BACKLINKS: "crawl.api.backlinks",
  CRAWL_API_SERP: "crawl.api.serp",
  CRAWL_API_INDEX: "crawl.api.index",
  PROCESS_RAW: "process.raw",
  ALERTS_EVENTS: "alerts.events",
} as const;

export type JobQueueName = (typeof JOB_QUEUES)[keyof typeof JOB_QUEUES];

export const USAGE_METRICS = [
  "sites",
  "keywords",
  "crawls",
  "ai_credits",
  "aeo_scans",
  "team_seats",
] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

type ToolkitTool = { id: string; name: string; path: string };
type ToolkitGroup = {
  id: string;
  name: string;
  description: string;
  tools: ToolkitTool[];
};

/**
 * Semrush + Search Atlas competitive toolkit catalog.
 * Automation toolkit mirrors OTTO / Atlas Agent / Content Genius / Smart Ads.
 */
export const TOOLKIT_GROUPS: ToolkitGroup[] = [
  {
    id: "automation",
    name: "Automation (Taxo Agent)",
    description: "Autopilot SEO, pixel deploy, CMS publish, Content Genius, Smart Ads",
    tools: [
      { id: "taxo-agent", name: "Taxo Agent", path: "taxo-agent" },
      { id: "auto-seo", name: "Auto SEO", path: "auto-seo" },
      { id: "taxo-pixel", name: "Taxo Pixel", path: "taxo-pixel" },
      { id: "cms-publishing", name: "Universal CMS Publishing", path: "cms-publishing" },
      { id: "website-studio", name: "Website Studio", path: "website-studio" },
      { id: "content-genius", name: "Content Genius", path: "content-genius" },
      { id: "smart-ads", name: "Smart Ads", path: "smart-ads" },
      { id: "overnight-repair", name: "Overnight Repair", path: "overnight-repair" },
      { id: "approval-mode", name: "Approval Mode", path: "approval-mode" },
      { id: "gbp-galactic", name: "GBP Galactic", path: "gbp-galactic" },
      { id: "deep-freeze", name: "Deep Freeze", path: "deep-freeze" },
      { id: "instant-indexing", name: "Instant Indexing Engine", path: "instant-indexing" },
      { id: "agent-chat", name: "Taxo Agent Chat", path: "agent-chat" },
      { id: "orders-tasks", name: "Orders & Tasks", path: "orders-tasks" },
    ],
  },
  {
    id: "authority",
    name: "Authority & QUEST",
    description: "Domain Power, WILDFIRE, HyperDrive, QUEST citations, press & cloud stacks",
    tools: [
      { id: "quest", name: "QUEST Citation Research", path: "quest" },
      { id: "domain-power", name: "Domain Power", path: "domain-power" },
      { id: "site-explorer", name: "Site Explorer", path: "site-explorer" },
      { id: "topical-dominance", name: "Topical Dominance", path: "topical-dominance" },
      { id: "wildfire", name: "WILDFIRE Link Exchange", path: "wildfire" },
      { id: "hyperdrive", name: "HyperDrive Authority", path: "hyperdrive" },
      { id: "press-releases", name: "Press Release Engine", path: "press-releases" },
      { id: "cloud-stacks", name: "Cloud Stacks", path: "cloud-stacks" },
      { id: "bulk-url-analyzer", name: "Bulk URL Analyzer", path: "bulk-url-analyzer" },
    ],
  },
  {
    id: "seo",
    name: "SEO Toolkit",
    description: "Keywords, ranks, technical SEO, and backlinks",
    tools: [
      { id: "domain-overview", name: "Domain Overview", path: "domain-overview" },
      { id: "keyword-research", name: "Keyword Research", path: "keyword-research" },
      { id: "keyword-magic", name: "Keyword Magic Tool", path: "keyword-magic" },
      { id: "keyword-strategy-builder", name: "Keyword Strategy Builder", path: "keyword-strategy-builder" },
      { id: "keyword-gap", name: "Keyword Gap", path: "keyword-gap" },
      { id: "organic-research", name: "Organic Research", path: "organic-research" },
      { id: "organic-rankings", name: "Organic Rankings", path: "organic-rankings" },
      { id: "position-tracking", name: "Position Tracking", path: "position-tracking" },
      { id: "serp-features", name: "SERP Features Tracking", path: "serp-features" },
      { id: "backlink-analytics", name: "Backlink Analytics", path: "backlink-analytics" },
      { id: "backlink-gap", name: "Backlink Gap", path: "backlink-gap" },
      { id: "backlink-audit", name: "Backlink Audit", path: "backlink-audit" },
      { id: "backlink-engine", name: "Backlink Engine", path: "backlink-engine" },
      { id: "disavow-manager", name: "Disavow Manager", path: "disavow-manager" },
      { id: "competitor-backlinks", name: "Competitor Backlink Monitor", path: "competitor-backlinks" },
      { id: "link-building", name: "Link Building Tool", path: "link-building" },
      { id: "site-audit", name: "Site Audit", path: "site-audit" },
      { id: "crawler-master", name: "Crawler Master", path: "crawler-master" },
      { id: "deep-crawl", name: "Deep Crawl", path: "deep-crawl" },
      { id: "live-crawl", name: "Live Crawl", path: "live-crawl" },
      { id: "on-page-checker", name: "On-Page SEO Checker", path: "on-page-checker" },
      { id: "seo-content-template", name: "SEO Content Template", path: "seo-content-template" },
      { id: "seo-writing-assistant", name: "SEO Writing Assistant", path: "seo-writing-assistant" },
      { id: "log-file-analyzer", name: "Log File Analyzer", path: "log-file-analyzer" },
      { id: "crawl-monitoring", name: "Crawl Monitoring (Bots & LLMs)", path: "crawl-monitoring" },
      { id: "schema-generator", name: "Schema Markup Generator", path: "schema-generator" },
      { id: "health-scoreboard", name: "Health Scoreboard", path: "health-scoreboard" },
      { id: "gsc-insights", name: "GSC Insights", path: "gsc-insights" },
      { id: "ga4-insights", name: "GA4 Insights", path: "ga4-insights" },
    ],
  },
  {
    id: "aeo",
    name: "AI Visibility Toolkit",
    description: "AEO/GEO — AI search presence, citations, and share of voice",
    tools: [
      { id: "ai-visibility", name: "AI Visibility Scanner", path: "ai-visibility" },
      { id: "ai-citations", name: "AI Citation Tracking", path: "ai-citations" },
      { id: "geo-overviews", name: "Google AI Overviews (GEO)", path: "geo-overviews" },
      { id: "ai-sentiment", name: "AI Brand Sentiment", path: "ai-sentiment" },
      { id: "ai-competitors", name: "AI Competitor Mentions", path: "ai-competitors" },
      { id: "programmatic-seo", name: "Programmatic SEO", path: "programmatic-seo" },
      { id: "bulk-ai-content", name: "Bulk AI Content Generation", path: "bulk-ai-content" },
      { id: "knowledge-base", name: "Domain Knowledge Base", path: "knowledge-base" },
    ],
  },
  {
    id: "traffic-market",
    name: "Traffic & Market Toolkit",
    description: "Traffic analytics, market trends, and audience insights",
    tools: [
      { id: "traffic-analytics", name: "Traffic Analytics", path: "traffic-analytics" },
      { id: "market-overview", name: "Market Overview", path: "market-overview" },
      { id: "audience-insights", name: "Audience Insights", path: "audience-insights" },
      { id: "top-pages", name: "Top Pages", path: "top-pages" },
      { id: "eyeon", name: "EyeOn / Trends Watch", path: "eyeon" },
      { id: "competitive-research", name: "Competitive Research", path: "competitive-research" },
    ],
  },
  {
    id: "content",
    name: "Content Toolkit",
    description: "Topics, audits, briefs, calendar, and AI writing",
    tools: [
      { id: "topic-research", name: "Topic Research", path: "topic-research" },
      { id: "topic-finder", name: "Topic Finder", path: "topic-finder" },
      { id: "seo-brief-generator", name: "SEO Brief Generator", path: "seo-brief-generator" },
      { id: "ai-article-generator", name: "AI Article Generator", path: "ai-article-generator" },
      { id: "content-audit", name: "Content Audit", path: "content-audit" },
      { id: "topical-map", name: "Topical Map Generator", path: "topical-map" },
      { id: "scholar-research", name: "Scholar Research", path: "scholar-research" },
      { id: "content-planner", name: "Content Planner", path: "content-planner" },
      { id: "meta-generator", name: "Meta Generator", path: "meta-generator" },
      { id: "content-rewriter", name: "Content Rewriter", path: "content-rewriter" },
      { id: "marketing-calendar", name: "Marketing Calendar", path: "marketing-calendar" },
      { id: "post-tracking", name: "Post Tracking", path: "post-tracking" },
      { id: "ai-writing-assistant", name: "AI Writing Assistant", path: "ai-writing-assistant" },
      { id: "content-templates", name: "Content Templates", path: "content-templates" },
    ],
  },
  {
    id: "local",
    name: "Local Toolkit",
    description: "GBP, maps, listings, reviews, and local ranks",
    tools: [
      { id: "gbp-optimization", name: "GBP Optimization", path: "gbp-optimization" },
      { id: "listing-management", name: "Listing Management", path: "listing-management" },
      { id: "review-management", name: "Review Management", path: "review-management" },
      { id: "map-rank-tracker", name: "Map Rank Tracker", path: "map-rank-tracker" },
      { id: "local-heatmaps", name: "Local Heatmaps", path: "local-heatmaps" },
      { id: "nap-consistency", name: "NAP Consistency", path: "nap-consistency" },
      { id: "citation-builder", name: "Local Citation Builder", path: "citation-builder" },
    ],
  },
  {
    id: "social",
    name: "Social Toolkit",
    description: "Scheduling, tracking, listening, and influencers",
    tools: [
      { id: "social-poster", name: "Social Poster", path: "social-poster" },
      { id: "social-tracker", name: "Social Tracker", path: "social-tracker" },
      { id: "social-analytics", name: "Social Analytics", path: "social-analytics" },
      { id: "social-content-ai", name: "Social Content AI", path: "social-content-ai" },
      { id: "influencer-analytics", name: "Influencer Analytics", path: "influencer-analytics" },
      { id: "social-listening", name: "Social Listening", path: "social-listening" },
    ],
  },
  {
    id: "advertising",
    name: "Advertising Toolkit",
    description: "PPC research, PLA, display ads, and launch assistant",
    tools: [
      { id: "advertising-research", name: "Advertising Research", path: "advertising-research" },
      { id: "keyword-cpc", name: "Keyword CPC & Competition", path: "keyword-cpc" },
      { id: "pla-research", name: "PLA Research", path: "pla-research" },
      { id: "adclarity", name: "AdClarity (Display/Video/Social)", path: "adclarity" },
      { id: "ads-launch-assistant", name: "Ads Launch Assistant", path: "ads-launch-assistant" },
      { id: "ad-builder", name: "Ad Builder", path: "ad-builder" },
      { id: "google-ad-studio", name: "Google Ad Studio", path: "google-ad-studio" },
      { id: "meta-ad-studio", name: "Meta Ad Studio", path: "meta-ad-studio" },
    ],
  },
  {
    id: "ai-pr",
    name: "AI PR Toolkit",
    description: "Media database, monitoring, and AI-cited coverage",
    tools: [
      { id: "media-database", name: "Media Database", path: "media-database" },
      { id: "media-monitoring", name: "Media Monitoring", path: "media-monitoring" },
      { id: "ai-cited-media", name: "AI-Cited Media", path: "ai-cited-media" },
      { id: "pr-outreach", name: "PR Outreach", path: "pr-outreach" },
    ],
  },
  {
    id: "reports",
    name: "Reports & Agency",
    description: "White-label reports, schedules, and client access",
    tools: [
      { id: "my-reports", name: "My Reports", path: "my-reports" },
      { id: "white-label-reports", name: "White-label Reports", path: "white-label-reports" },
      { id: "scheduled-reports", name: "Scheduled Reports", path: "scheduled-reports" },
      { id: "client-portal", name: "Client Portal", path: "client-portal" },
      { id: "ai-report-summary", name: "AI Report Summary", path: "ai-report-summary" },
      { id: "email-alerts", name: "Universal Email Alerts", path: "email-alerts" },
      { id: "slack-webhooks", name: "Slack / Teams / ClickUp Alerts", path: "slack-webhooks" },
    ],
  },
];

export type ToolkitId = (typeof TOOLKIT_GROUPS)[number]["id"];
export type ToolId = (typeof TOOLKIT_GROUPS)[number]["tools"][number]["id"];

export function findTool(toolId: string) {
  for (const group of TOOLKIT_GROUPS) {
    const tool = group.tools.find((t) => t.id === toolId || t.path === toolId);
    if (tool) return { group, tool };
  }
  return null;
}

export const ALL_TOOL_IDS = TOOLKIT_GROUPS.flatMap((g) => g.tools.map((t) => t.id));

/** seo.backlinks.init defaults — multi-source external crawl engine */
export const BACKLINK_SOURCE_APIS = [
  "crawlgraph",
  "openpagerank",
  "ahrefs",
  "semrush",
  "majestic",
] as const;
export type BacklinkSourceApi = (typeof BACKLINK_SOURCE_APIS)[number];

/** Free / freemium providers preferred when keys are present */
export const BACKLINK_LIVE_PROVIDERS = ["crawlgraph", "openpagerank"] as const;

export const BACKLINK_ENGINE_DEFAULTS = {
  sourceApis: [...BACKLINK_LIVE_PROVIDERS] as BacklinkSourceApi[],
  crawlMode: "external" as const,
  refreshInterval: "24h",
  refreshIntervalHours: 24,
  /** (authority * relevance) - (spam * risk) */
  scoreFormula: "(authority*relevance)-(spam*risk)",
  toxic: {
    spamGt: 70,
    riskGt: 0.6,
  },
  highValue: {
    authorityGt: 40,
    relevanceGt: 0.7,
  },
  alerts: {
    velocitySpikePct: 30,
    anchorRepeatPct: 20,
  },
  enableDisavow: true,
  enableCompetitorMonitoring: true,
} as const;

export type BacklinkClassification = "toxic" | "high_value" | "normal" | "lost";

export function computeBacklinkScore(input: {
  authority: number;
  relevance: number;
  spam: number;
  risk: number;
}): number {
  const authority = clamp(input.authority, 0, 100);
  const relevance = clamp(input.relevance, 0, 1);
  const spam = clamp(input.spam, 0, 100);
  const risk = clamp(input.risk, 0, 1);
  // Normalize spam to 0–1 for formula balance with risk
  return authority * relevance - (spam / 100) * risk * 100;
}

export function classifyBacklink(
  input: { authority: number; relevance: number; spam: number; risk: number },
  cfg = BACKLINK_ENGINE_DEFAULTS,
): BacklinkClassification {
  if (input.spam > cfg.toxic.spamGt || input.risk > cfg.toxic.riskGt) return "toxic";
  if (input.authority > cfg.highValue.authorityGt && input.relevance > cfg.highValue.relevanceGt) {
    return "high_value";
  }
  return "normal";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** seo.crawler.master.init defaults */
export const CRAWLER_MASTER_MODULES = [
  "backlinks",
  "keywords",
  "serp",
  "competitors",
  "traffic",
] as const;
export type CrawlerMasterModule = (typeof CRAWLER_MASTER_MODULES)[number];

/** Alias for --enable=… */
export const CRAWLER_MASTER_ENABLE = CRAWLER_MASTER_MODULES;

export const CRAWLER_MASTER_PROVIDERS = [
  "ahrefs",
  "semrush",
  "majestic",
  "dataforseo",
  "serpapi",
  "google_index",
  "bing_index",
] as const;
export type CrawlerMasterProvider = (typeof CRAWLER_MASTER_PROVIDERS)[number];

export const CRAWLER_MASTER_MODES = ["live", "scheduled", "deep", "external"] as const;
export type CrawlerMasterMode = (typeof CRAWLER_MASTER_MODES)[number];

export const CRAWLER_MASTER_EXTRACT = [
  "links",
  "anchors",
  "metadata",
  "schemas",
  "keywords",
  "geo",
  "language",
] as const;
export type CrawlerMasterExtract = (typeof CRAWLER_MASTER_EXTRACT)[number];

export const CRAWLER_MASTER_QUEUES = [
  "crawl.urls",
  "crawl.api.backlinks",
  "crawl.api.serp",
  "crawl.api.index",
  "process.raw",
  "alerts.events",
] as const;
export type CrawlerMasterQueue = (typeof CRAWLER_MASTER_QUEUES)[number];

export const CRAWLER_MASTER_WORKERS = [
  "url_crawler",
  "backlink_api",
  "serp_api",
  "index_api",
  "processor",
  "alerts",
] as const;
export type CrawlerMasterWorker = (typeof CRAWLER_MASTER_WORKERS)[number];

export const CRAWLER_MASTER_DB_SCHEMA = [
  "projects",
  "crawler_configs",
  "crawl_jobs",
  "backlinks",
  "serp_snapshots",
  "raw_documents",
  "crawler_logs",
] as const;
export type CrawlerMasterDbTable = (typeof CRAWLER_MASTER_DB_SCHEMA)[number];

export const CRAWLER_MASTER_QUEUE_WORKER_MAP: Record<
  CrawlerMasterQueue,
  CrawlerMasterWorker
> = {
  "crawl.urls": "url_crawler",
  "crawl.api.backlinks": "backlink_api",
  "crawl.api.serp": "serp_api",
  "crawl.api.index": "index_api",
  "process.raw": "processor",
  "alerts.events": "alerts",
};

/** --uk-directories=… */
export const CRAWLER_MASTER_UK_DIRECTORIES = [
  "yell.com",
  "192.com",
  "thomsonlocal.com",
  "checkatrade.com",
  "ukbusinessforums.co.uk",
  "freeindex.co.uk",
  "hotfrog.co.uk",
  "businessmagnet.co.uk",
  "applegate.co.uk",
  "approvedbusiness.co.uk",
] as const;
export type CrawlerMasterUkDirectory = (typeof CRAWLER_MASTER_UK_DIRECTORIES)[number];

/** --accounting-directories=… */
export const CRAWLER_MASTER_ACCOUNTING_DIRECTORIES = [
  "icaew.com/find-a-chartered-accountant",
  "accaglobal.com/uk/en/member/find-an-accountant",
  "aat.org.uk/aat-directory",
  "ifa.org.uk/find-a-member",
  "gorillaaccounting.com",
  "crunch.co.uk/accountants-directory",
] as const;
export type CrawlerMasterAccountingDirectory =
  (typeof CRAWLER_MASTER_ACCOUNTING_DIRECTORIES)[number];

/** --gov-sources=… */
export const CRAWLER_MASTER_GOV_SOURCES = [
  "gov.uk",
  "companieshouse.gov.uk",
  "hmrc.gov.uk",
] as const;
export type CrawlerMasterGovSource = (typeof CRAWLER_MASTER_GOV_SOURCES)[number];

export const CRAWLER_MASTER_DEFAULTS = {
  enable: [...CRAWLER_MASTER_ENABLE] as CrawlerMasterModule[],
  /** @deprecated use enable — kept for back-compat */
  modules: [...CRAWLER_MASTER_MODULES] as CrawlerMasterModule[],
  providers: [...CRAWLER_MASTER_PROVIDERS] as CrawlerMasterProvider[],
  ukDirectories: [...CRAWLER_MASTER_UK_DIRECTORIES] as CrawlerMasterUkDirectory[],
  accountingDirectories: [
    ...CRAWLER_MASTER_ACCOUNTING_DIRECTORIES,
  ] as CrawlerMasterAccountingDirectory[],
  govSources: [...CRAWLER_MASTER_GOV_SOURCES] as CrawlerMasterGovSource[],
  queues: [...CRAWLER_MASTER_QUEUES] as CrawlerMasterQueue[],
  workers: [...CRAWLER_MASTER_WORKERS] as CrawlerMasterWorker[],
  dbSchema: [...CRAWLER_MASTER_DB_SCHEMA] as CrawlerMasterDbTable[],
  crawlModes: [...CRAWLER_MASTER_MODES] as CrawlerMasterMode[],
  frequency: "6h",
  frequencyHours: 6,
  maxDepth: 12,
  parallelThreads: 32,
  respectRobots: true,
  extract: [...CRAWLER_MASTER_EXTRACT] as CrawlerMasterExtract[],
  storeFormat: "jsonl" as const,
  autoClean: true,
  errorRetry: 3,
  logLevel: "verbose" as const,
} as const;

/** Normalize a directory path/host into an absolute https URL. */
export function directorySourceUrl(entry: string): string {
  const trimmed = entry.trim().replace(/^https?:\/\//i, "");
  return `https://${trimmed}`;
}

export function parseFrequencyHours(freq: string, fallback = 6): number {
  const m = /^(\d+)\s*h$/i.exec(freq.trim());
  return m ? Number(m[1]) : fallback;
}
