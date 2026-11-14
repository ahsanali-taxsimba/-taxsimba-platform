import type { KnowledgeFact } from "../../models/schemas.js";

export type WatchlistEntry = {
  id: string;
  url: string;
  title_markers: string[];
  linked_fact_ids: string[];
  impact: "high" | "medium" | "low";
  expected_phrases?: string[];
};

export type WatchlistConfig = {
  version: string;
  description?: string;
  allowed_host_suffixes: string[];
  entries: WatchlistEntry[];
};

export type PageSnapshot = {
  watch_id: string;
  url: string;
  fetched_at: string;
  http_status: number;
  content_hash: string;
  title: string;
  text_excerpt: string;
  text_length: number;
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

export type QuarantineItem = {
  id: string;
  created_at: string;
  watch_id: string;
  url: string;
  impact: "high" | "medium" | "low";
  reason: string;
  previous_hash?: string | null;
  new_snapshot: PageSnapshot;
  linked_fact_ids: string[];
  status: "quarantined" | "approved" | "rejected" | "rolled_back";
  accountant_note?: string | null;
  decided_at?: string | null;
};

export type PublishedOverlay = {
  version: string;
  published_at: string;
  quarantine_id?: string | null;
  facts: KnowledgeFact[];
  note?: string;
};

export type HmrcMonitorCycleResult = {
  started_at: string;
  finished_at: string;
  checked: number;
  unchanged: number;
  quarantined: number;
  authenticity_failures: number;
  errors: number;
  snapshots: PageSnapshot[];
  quarantine_ids: string[];
  alerts: Array<{ level: string; code: string; message: string }>;
};

export type FetchPageFn = (url: string) => Promise<{
  status: number;
  html: string;
  finalUrl: string;
}>;
