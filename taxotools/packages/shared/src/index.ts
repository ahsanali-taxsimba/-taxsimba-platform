/** Plan codes — extend without migrating app logic */
export const PLAN_CODES = ["STARTER", "PRO", "AGENCY", "ENTERPRISE"] as const;
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
    whiteLabel: boolean;
    apiAccess: boolean;
    outreachCrm: boolean;
  }
> = {
  STARTER: {
    sites: 1,
    keywords: 100,
    crawlsPerMonth: 5,
    aiCreditsPerMonth: 20,
    aeoScansPerMonth: 10,
    teamSeats: 2,
    whiteLabel: false,
    apiAccess: false,
    outreachCrm: false,
  },
  PRO: {
    sites: 5,
    keywords: 2000,
    crawlsPerMonth: 50,
    aiCreditsPerMonth: 200,
    aeoScansPerMonth: 100,
    teamSeats: 5,
    whiteLabel: false,
    apiAccess: false,
    outreachCrm: true,
  },
  AGENCY: {
    sites: 50,
    keywords: 15000,
    crawlsPerMonth: 500,
    aiCreditsPerMonth: 2000,
    aeoScansPerMonth: 1000,
    teamSeats: 25,
    whiteLabel: true,
    apiAccess: true,
    outreachCrm: true,
  },
  ENTERPRISE: {
    sites: -1,
    keywords: -1,
    crawlsPerMonth: -1,
    aiCreditsPerMonth: -1,
    aeoScansPerMonth: -1,
    teamSeats: -1,
    whiteLabel: true,
    apiAccess: true,
    outreachCrm: true,
  },
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

/** Semrush-parity + Taxotools differentiators */
export const TOOLKIT_GROUPS = [
  {
    id: "seo",
    name: "SEO Toolkit",
    description: "Keyword, rank, technical, backlink, and on-page SEO",
    tools: [
      { id: "keyword-research", name: "Keyword Research", path: "keyword-research" },
      { id: "keyword-magic", name: "Keyword Magic Tool", path: "keyword-magic" },
      { id: "keyword-gap", name: "Keyword Gap", path: "keyword-gap" },
      { id: "organic-research", name: "Organic Research", path: "organic-research" },
      { id: "position-tracking", name: "Position Tracking", path: "position-tracking" },
      { id: "serp-features", name: "SERP Features Tracking", path: "serp-features" },
      { id: "backlink-analytics", name: "Backlink Analytics", path: "backlink-analytics" },
      { id: "backlink-audit", name: "Backlink Audit", path: "backlink-audit" },
      { id: "link-building", name: "Link Building Tool", path: "link-building" },
      { id: "site-audit", name: "Site Audit", path: "site-audit" },
      { id: "on-page-checker", name: "On-Page SEO Checker", path: "on-page-checker" },
      { id: "seo-content-template", name: "SEO Content Template", path: "seo-content-template" },
      { id: "seo-writing-assistant", name: "SEO Writing Assistant", path: "seo-writing-assistant" },
      { id: "log-file-analyzer", name: "Log File Analyzer", path: "log-file-analyzer" },
    ],
  },
  {
    id: "content",
    name: "Content Marketing Toolkit",
    description: "Topics, audits, calendar, and AI writing",
    tools: [
      { id: "topic-research", name: "Topic Research", path: "topic-research" },
      { id: "content-audit", name: "Content Audit", path: "content-audit" },
      { id: "marketing-calendar", name: "Marketing Calendar", path: "marketing-calendar" },
      { id: "post-tracking", name: "Post Tracking", path: "post-tracking" },
      { id: "ai-writing-assistant", name: "AI Writing Assistant", path: "ai-writing-assistant" },
      { id: "content-templates", name: "Content Templates", path: "content-templates" },
    ],
  },
  {
    id: "advertising",
    name: "Advertising Toolkit",
    description: "PPC research, CPC intelligence, PLA / Shopping ads",
    tools: [
      { id: "advertising-research", name: "Advertising Research", path: "advertising-research" },
      { id: "keyword-cpc", name: "Keyword CPC & Competition", path: "keyword-cpc" },
      { id: "pla-research", name: "PLA Research", path: "pla-research" },
      { id: "adclarity", name: "AdClarity (Display/Video/Social)", path: "adclarity" },
      { id: "ads-launch-assistant", name: "Ads Launch Assistant", path: "ads-launch-assistant" },
    ],
  },
  {
    id: "aeo",
    name: "AEO / GEO Toolkit",
    description: "AI search visibility, citations, share of voice",
    tools: [
      { id: "ai-visibility", name: "AI Visibility Scanner", path: "ai-visibility" },
      { id: "ai-citations", name: "AI Citation Tracking", path: "ai-citations" },
      { id: "geo-overviews", name: "Google AI Overviews (GEO)", path: "geo-overviews" },
      { id: "programmatic-seo", name: "Programmatic SEO", path: "programmatic-seo" },
      { id: "bulk-ai-content", name: "Bulk AI Content Generation", path: "bulk-ai-content" },
    ],
  },
] as const;

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
