import type { KnowledgeFact } from "../../models/schemas.js";

export type ImpactLevel = "high" | "medium" | "low";

export type WatchlistEntry = {
  id: string;
  url: string;
  /** GOV.UK Content API base path (preferred). */
  base_path?: string;
  title_markers: string[];
  linked_fact_ids: string[];
  impact: ImpactLevel;
  expected_phrases?: string[];
  /** Named extractor used for structured fact parsing. */
  extractor?:
    | "mtd_thresholds"
    | "mtd_qualifying_income"
    | "vat_threshold"
    | "sa_deadlines"
    | "personal_allowance"
    | "generic_phrases";
};

export type WatchlistConfig = {
  version: string;
  description?: string;
  allowed_host_suffixes: string[];
  content_api_base?: string;
  entries: WatchlistEntry[];
};

export type ContentApiMeta = {
  content_id?: string | null;
  base_path?: string | null;
  document_type?: string | null;
  schema_name?: string | null;
  public_updated_at?: string | null;
  first_published_at?: string | null;
  updated_at?: string | null;
  withdrawn: boolean;
  withdrawn_at?: string | null;
  withdrawn_explanation?: string | null;
  publishing_app?: string | null;
};

export type PageSnapshot = {
  watch_id: string;
  url: string;
  fetched_at: string;
  http_status: number;
  source_mode: "content_api" | "html_fallback" | "fixture" | "error";
  content_hash: string;
  version_token: string;
  title: string;
  text_excerpt: string;
  /** Full plain text used for extraction (not always persisted in alerts). */
  full_text?: string;
  text_length: number;
  content_api?: ContentApiMeta;
  authenticity: {
    host_ok: boolean;
    publisher_markers_ok: boolean;
    title_markers_ok: boolean;
    expected_phrases_ok: boolean;
    missing_phrases: string[];
  };
  effective_dates_found: string[];
  ok: boolean;
  error?: string;
};

export type ExtractedFactUpdate = {
  fact_id: string;
  source_url: string;
  tax_years: string[];
  effective_date: string | null;
  publication_date: string | null;
  applicable_conditions: string | null;
  summary: string;
  title?: string;
  superseded_summary?: string | null;
  confidence: "high" | "medium" | "low";
  validation_notes: string[];
};

export type PublicationDecision =
  | {
      action: "auto_publish";
      reason: string;
      updates: ExtractedFactUpdate[];
    }
  | {
      action: "quarantine";
      reason: string;
      affected_fact_ids: string[];
      updates?: ExtractedFactUpdate[];
      requires_accountant_review: boolean;
    }
  | {
      action: "unchanged";
      reason: string;
    }
  | {
      action: "error";
      reason: string;
      affected_fact_ids: string[];
    };

export type QuarantineItem = {
  id: string;
  created_at: string;
  watch_id: string;
  url: string;
  impact: ImpactLevel;
  reason: string;
  previous_hash?: string | null;
  new_snapshot: PageSnapshot;
  linked_fact_ids: string[];
  affected_fact_ids: string[];
  status: "quarantined" | "approved" | "rejected" | "rolled_back" | "auto_resolved";
  accountant_note?: string | null;
  decided_at?: string | null;
  requires_accountant_review: boolean;
};

export type PublishedOverlay = {
  version: string;
  published_at: string;
  publication_mode: "automatic_verified" | "accountant_approved" | "rollback_restore";
  quarantine_id?: string | null;
  watch_id?: string | null;
  facts: KnowledgeFact[];
  note?: string;
  audit?: Record<string, unknown>;
};

export type HmrcMonitorCycleResult = {
  started_at: string;
  finished_at: string;
  checked: number;
  unchanged: number;
  auto_published: number;
  quarantined: number;
  authenticity_failures: number;
  errors: number;
  snapshots: PageSnapshot[];
  quarantine_ids: string[];
  published_versions: string[];
  blocked_fact_ids: string[];
  alerts: Array<{ level: string; code: string; message: string }>;
};

export type FetchPageFn = (url: string) => Promise<{
  status: number;
  html: string;
  finalUrl: string;
}>;

export type FetchContentApiFn = (basePath: string) => Promise<{
  status: number;
  json: Record<string, unknown> | null;
  finalPath: string;
}>;
