import type { PlatformId } from "./config";

/**
 * Internal stages. Public workflow labels:
 * Draft → Review → Approved → Scheduled → Published | Failed
 */
export type PublishStage =
  | "ai_draft"
  | "content_qa"
  | "approval"
  | "scheduled"
  | "platform_publishing"
  | "confirmed_published"
  | "failed"
  | "paused";

export const WORKFLOW_LABELS: Record<PublishStage, string> = {
  ai_draft: "Draft",
  content_qa: "Review",
  approval: "Approved",
  scheduled: "Scheduled",
  platform_publishing: "Publishing",
  confirmed_published: "Published",
  failed: "Failed",
  paused: "Paused",
};

export type TemplateStatus = "draft" | "pending_artwork" | "approved" | "retired";

export type CampaignFocus = "SELF_ASSESSMENT" | "MTD" | "GENERAL";

export interface MarketingTemplate {
  id: string;
  batch: number;
  batchLabel: string;
  title: string;
  focus: CampaignFocus;
  channelHints: string[];
  captionSeed: string;
  ctaHint: string;
  thumbnailStatus: "placeholder" | "approved_asset";
  artworkStatus: "missing" | "pending_review" | "approved";
  status: TemplateStatus;
  version: number;
  versionHistory: Array<{ version: number; note: string; at: string }>;
  nationAware: boolean;
  metadata: {
    hooks: string[];
    aspectRatios: string[];
    proposedPriceRef: "sa_119" | "mtd_29_99" | "none";
  };
}

export interface MarketingDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  stage: PublishStage;
  focus: CampaignFocus;
  title: string;
  caption: string;
  copyLong: string;
  googleAdsDraft?: string;
  landingCta?: string;
  videoScript?: string;
  templateId?: string;
  /** Linked high-res asset slot TS-001…TS-120 when present */
  assetId?: string;
  sources: Array<{ label: string; url: string }>;
  nation: "UK" | "England" | "Scotland" | "Wales" | "Northern Ireland";
  fixtureMode: boolean;
  /** Human-readable workflow label aligned to Draft → Review → Approved → Scheduled → Published/Failed */
  workflowLabel?: string;
  approvedBy?: string;
  approvedAt?: string;
  scheduledFor?: string;
  publishIdempotencyKey?: string;
  retryCount?: number;
  platformResults?: Array<{
    platform: PlatformId;
    status: "pending" | "published" | "failed" | "skipped";
    externalId?: string;
    error?: string;
    confirmedAt?: string;
  }>;
  artworkApproved: boolean;
  audit: Array<{ at: string; actor: string; action: string; detail?: string }>;
}

export interface PlatformConnection {
  platform: PlatformId;
  status: "not_connected" | "connected" | "expired" | "error" | "manual_only";
  displayName?: string;
  lastSyncAt?: string;
  lastError?: string;
  scopes?: string[];
  /** Encrypted/ref token stored separately — never returned to clients. */
  hasCredentials: boolean;
}

export interface DashboardMetric {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  state: "ok" | "no_data" | "not_connected";
  note?: string;
}

export interface SeoRecommendation {
  id: string;
  priority: "P1" | "P2" | "P3";
  slug: string;
  title: string;
  action: string;
  rationale: string;
  preserveUrl: true;
  requiresHumanReview: true;
}
