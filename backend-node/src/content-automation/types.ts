/** TaxSimba HMRC content-automation pipeline types. */

export type PipelineStage =
  | "detected"
  | "researched"
  | "mapped"
  | "drafted"
  | "validated"
  | "published"
  | "public_verified"
  | "blocked"
  | "skipped"
  | "rolled_back";

export type JobKind =
  | "source_change"
  | "new_topic"
  | "calendar_rollover"
  | "withdrawn_source"
  | "source_correction"
  | "manual_demo";

export type EvidenceConflict = {
  code: string;
  message: string;
  urls?: string[];
};

export type SourceSnapshot = {
  url: string;
  title?: string;
  basePath?: string;
  contentId?: string;
  publicUpdatedAt?: string | null;
  withdrawn?: boolean;
  hash: string;
  excerpt?: string;
  fetchedAt: string;
};

export type ArticleDraft = {
  slug: string;
  title: string;
  excerpt: string;
  content: htmlString;
  metaTitle: string;
  metaDescription: string;
  category: string;
  audience: string;
  tags: string[];
  ctaType: "SA" | "MTD" | "CHECK" | "BOTH";
  relatedSlugs: string[];
  relatedPages: string[];
  sources: { label: string; url: string }[];
  featuredImage: string;
  featuredImageAlt: string;
  authorName: string;
  reviewerName: string;
  /** Preserve original first-publication date on updates. */
  publishedAt: string;
  contentUpdatedAt: string;
  readingMinutes?: number;
  iconKey?: string;
  contentType?: string;
  curatedBaseSlug?: string | null;
  changeSummary: string;
  isUpdate: boolean;
};

type htmlString = string;

export type ValidationIssue = {
  severity: "error" | "warn";
  code: string;
  message: string;
};

export type AutomationJob = {
  id: string;
  kind: JobKind;
  stage: PipelineStage;
  createdAt: string;
  updatedAt: string;
  runId: string;
  claimToken?: string | null;
  claimedAt?: string | null;
  attempts: number;
  maxAttempts: number;
  pauseHonoured?: boolean;
  sourceUrls: string[];
  sourceSnapshots: SourceSnapshot[];
  mappedSlug?: string | null;
  duplicateOfJobId?: string | null;
  draft?: ArticleDraft | null;
  validationIssues?: ValidationIssue[];
  evidenceConflicts?: EvidenceConflict[];
  publishedRevisionId?: string | null;
  previousRevisionId?: string | null;
  publicVerifiedAt?: string | null;
  publicVerifyUrl?: string | null;
  error?: string | null;
  skipReason?: string | null;
  metadata?: Record<string, unknown>;
};

export type ArticleRevision = {
  id: string;
  slug: string;
  revision: number;
  status: "draft" | "published" | "rolled_back" | "superseded";
  article: ArticleDraft;
  jobId: string;
  createdAt: string;
  publishedAt?: string | null;
  rolledBackAt?: string | null;
  contentHash: string;
};

export type LiveArticleOverlay = {
  slug: string;
  revisionId: string;
  article: ArticleDraft;
  publishedAt: string;
  firstPublishedAt: string;
  updatedAt: string;
  jobId: string;
  curated: boolean;
};

export type AutomationRun = {
  id: string;
  startedAt: string;
  finishedAt?: string | null;
  status: "running" | "completed" | "failed" | "paused" | "partial";
  jobsCreated: number;
  jobsCompleted: number;
  jobsBlocked: number;
  jobsSkipped: number;
  error?: string | null;
  londonDate: string;
};

export type AutomationAlert = {
  id: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  acknowledgedAt?: string | null;
  runId?: string | null;
  jobId?: string | null;
};
