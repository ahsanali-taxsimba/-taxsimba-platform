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
