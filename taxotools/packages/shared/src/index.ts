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
      { id: "link-building", name: "Link Building Tool", path: "link-building" },
      { id: "site-audit", name: "Site Audit", path: "site-audit" },
      { id: "on-page-checker", name: "On-Page SEO Checker", path: "on-page-checker" },
      { id: "seo-content-template", name: "SEO Content Template", path: "seo-content-template" },
      { id: "seo-writing-assistant", name: "SEO Writing Assistant", path: "seo-writing-assistant" },
      { id: "log-file-analyzer", name: "Log File Analyzer", path: "log-file-analyzer" },
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
