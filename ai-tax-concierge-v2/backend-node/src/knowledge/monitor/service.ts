/**
 * HMRC / GOV.UK knowledge monitor — risk-based automatic publication.
 *
 * Verified official changes auto-publish into SIMBA customer answers (runtime
 * overlays, no redeploy). Ambiguous/conflicting/withdrawn updates quarantine
 * only affected facts; unaffected verified knowledge remains available.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../../paths.js";
import { writeAlert, readRecentAlerts } from "../../ops/alerts.js";
import {
  ensureRuntimeDirs,
  runtimePaths,
} from "../../ops/runtime_paths.js";
import { loadFacts, reloadFacts } from "../loader.js";
import type { KnowledgeFact } from "../../models/schemas.js";
import { fetchOfficialContent } from "./content_api.js";
import { decidePublication, detectInternalConflicts } from "./decision.js";
import { extractFactUpdates } from "./extract.js";
import type {
  ExtractedFactUpdate,
  FetchContentApiFn,
  FetchPageFn,
  HmrcMonitorCycleResult,
  PageSnapshot,
  PublishedOverlay,
  QuarantineItem,
  WatchlistConfig,
} from "./types.js";

function loadWatchlist(): WatchlistConfig {
  const p = path.join(DATA_DIR, "config", "hmrc_watchlist.json");
  return JSON.parse(readFileSync(p, "utf-8")) as WatchlistConfig;
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf-8")) as T;
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

type HmrcState = {
  last_cycle_at?: string | null;
  last_cycle_summary?: Record<string, unknown> | null;
  snapshot_hashes: Record<string, string>;
  snapshot_version_tokens: Record<string, string>;
  published_version?: string | null;
  blocked_fact_ids: string[];
  scheduler?: { enabled: boolean; interval_ms: number; runs: number };
  publication_policy?: string;
};

function loadState(): HmrcState {
  return readJson<HmrcState>(runtimePaths.hmrcState(), {
    snapshot_hashes: {},
    snapshot_version_tokens: {},
    blocked_fact_ids: [],
    publication_policy:
      "automatic_verified_official_changes; quarantine only ambiguous/conflicting/withdrawn",
  });
}

function saveState(state: HmrcState): void {
  writeJson(runtimePaths.hmrcState(), state);
}

function alert(
  level: "info" | "warn" | "critical",
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return writeAlert(runtimePaths.hmrcAlerts(), {
    system: "hmrc",
    level,
    code,
    message,
    details,
  });
}

export function getBlockedFactIds(): string[] {
  return [...(loadState().blocked_fact_ids || [])];
}

export function listQuarantine(status?: string): QuarantineItem[] {
  ensureRuntimeDirs();
  const dir = runtimePaths.hmrcQuarantine();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) =>
      readJson<QuarantineItem>(path.join(dir, f), null as unknown as QuarantineItem),
    )
    .filter(Boolean)
    .filter((q) => (status ? q.status === status : true))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function persistQuarantine(item: QuarantineItem): void {
  writeJson(path.join(runtimePaths.hmrcQuarantine(), `${item.id}.json`), item);
}

function blockFacts(state: HmrcState, ids: string[]): void {
  const set = new Set([...(state.blocked_fact_ids || []), ...ids]);
  state.blocked_fact_ids = [...set];
}

function unblockFacts(state: HmrcState, ids: string[]): void {
  const remove = new Set(ids);
  state.blocked_fact_ids = (state.blocked_fact_ids || []).filter((id) => !remove.has(id));
}

function updatesToFacts(
  updates: ExtractedFactUpdate[],
  baseline: KnowledgeFact[],
  mode: PublishedOverlay["publication_mode"],
): KnowledgeFact[] {
  const byId = new Map(baseline.map((f) => [f.id, f]));
  const out: KnowledgeFact[] = [];
  for (const u of updates) {
    const prev = byId.get(u.fact_id);
    if (!prev) continue; // never invent new fact ids
    out.push({
      ...prev,
      title: u.title || prev.title,
      summary: u.summary,
      tax_years: u.tax_years.length ? u.tax_years : prev.tax_years,
      source_url: u.source_url || prev.source_url,
      publisher: prev.publisher,
      effective_date: u.effective_date ?? prev.effective_date,
      last_verified: new Date().toISOString().slice(0, 10),
      knowledge_version: `${mode}-${Date.now()}`,
      review_status:
        mode === "automatic_verified"
          ? "auto_published_verified_official"
          : "accountant_approved_overlay",
      // Extended structured metadata (optional fields tolerated by TS structural typing)
      ...( {
        publication_date: u.publication_date,
        applicable_conditions: u.applicable_conditions,
        superseded_summary: u.superseded_summary,
      } as Partial<KnowledgeFact>),
    });
  }
  return out;
}

function writePublishedOverlay(overlay: PublishedOverlay): void {
  const pubDir = runtimePaths.hmrcPublished();
  if (existsSync(pubDir)) {
    for (const f of readdirSync(pubDir).filter((x) => x.endsWith(".json"))) {
      writeJson(
        path.join(runtimePaths.hmrcHistory(), `hist-${f}`),
        readJson(path.join(pubDir, f), {}),
      );
    }
  }
  // Merge with previous published facts so unrelated watches stay published
  const prevFacts = loadPublishedFactsRaw();
  const byId = new Map(prevFacts.map((f) => [f.id, f]));
  for (const f of overlay.facts) byId.set(f.id, f);
  const merged: PublishedOverlay = {
    ...overlay,
    facts: [...byId.values()],
  };
  writeJson(path.join(pubDir, `${overlay.version}.json`), merged);
}

function loadPublishedFactsRaw(): KnowledgeFact[] {
  ensureRuntimeDirs();
  const dir = runtimePaths.hmrcPublished();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) return [];
  const overlay = readJson<PublishedOverlay>(path.join(dir, files[files.length - 1]!), {
    version: "",
    published_at: "",
    publication_mode: "automatic_verified",
    facts: [],
  });
  return overlay.facts || [];
}

export function loadPublishedFacts(): KnowledgeFact[] {
  return loadPublishedFactsRaw();
}

function autoPublish(
  state: HmrcState,
  entryId: string,
  updates: ExtractedFactUpdate[],
  note: string,
  audit?: Record<string, unknown>,
): string {
  const baseline = loadFacts({ includePublishedOverlay: false });
  const facts = updatesToFacts(updates, baseline, "automatic_verified");
  const overlay: PublishedOverlay = {
    version: `auto-${Date.now()}`,
    published_at: new Date().toISOString(),
    publication_mode: "automatic_verified",
    watch_id: entryId,
    facts,
    note,
    audit,
  };
  writePublishedOverlay(overlay);
  unblockFacts(
    state,
    updates.map((u) => u.fact_id),
  );
  state.published_version = overlay.version;
  reloadFacts();
  alert("info", "hmrc_auto_published", `Auto-published ${facts.length} facts from ${entryId}`, {
    version: overlay.version,
    fact_ids: facts.map((f) => f.id),
  });
  return overlay.version;
}

export async function runHmrcMonitorCycle(opts?: {
  fetchPage?: FetchPageFn;
  fetchContentApi?: FetchContentApiFn;
  /** Injected extra snapshots/text for conflict tests */
  conflictUpdates?: ExtractedFactUpdate[];
}): Promise<HmrcMonitorCycleResult> {
  ensureRuntimeDirs();
  const started_at = new Date().toISOString();
  const watchlist = loadWatchlist();
  const state = loadState();
  const snapshots: PageSnapshot[] = [];
  const quarantine_ids: string[] = [];
  const published_versions: string[] = [];
  const alerts: HmrcMonitorCycleResult["alerts"] = [];
  let unchanged = 0;
  let auto_published = 0;
  let quarantined = 0;
  let authenticity_failures = 0;
  let errors = 0;

  const baseline = loadFacts({ includePublishedOverlay: false });

  for (const entry of watchlist.entries) {
    const snap = await fetchOfficialContent(entry, watchlist.allowed_host_suffixes, {
      fetchContentApi: opts?.fetchContentApi,
      fetchPage: opts?.fetchPage,
    });
    // Persist snapshot without huge full_text
    const stored = { ...snap };
    delete (stored as { full_text?: string }).full_text;
    snapshots.push(stored);
    writeJson(path.join(runtimePaths.hmrcSnapshots(), `${entry.id}.json`), stored);

    if (!snap.ok && snap.source_mode === "error") {
      authenticity_failures += 1;
      errors += 1;
      const a = alert(
        "critical",
        "hmrc_source_outage_or_auth_failed",
        `Monitor failed for ${entry.id}: ${snap.error}`,
        { watch_id: entry.id, url: entry.url },
      );
      alerts.push({ level: a.level, code: a.code, message: a.message });
      // Keep previous published knowledge; do not wipe.
      continue;
    }

    const { updates, errors: extractErrors } = extractFactUpdates(
      entry,
      snap,
      baseline,
    );
    // Conflict fixtures only attach to watches that own the conflicting fact IDs —
    // never publish injected contradictions via an unrelated watch's auto-publish path.
    const relevantConflicts = (opts?.conflictUpdates || []).filter((c) =>
      entry.linked_fact_ids.includes(c.fact_id),
    );
    const allUpdates =
      relevantConflicts.length > 0 ? [...updates, ...relevantConflicts] : updates;
    const conflicts = detectInternalConflicts(allUpdates);
    const decision = decidePublication({
      entry,
      snap,
      previousHash: relevantConflicts.length
        ? null
        : state.snapshot_hashes[entry.id],
      previousVersionToken: relevantConflicts.length
        ? null
        : state.snapshot_version_tokens[entry.id],
      updates: allUpdates,
      extractionErrors: extractErrors,
      conflictingFactIds: conflicts,
    });

    if (decision.action === "unchanged") {
      unchanged += 1;
      continue;
    }

    // Record latest hash/token even when quarantining so identical noise does not loop forever
    if (snap.content_hash) {
      state.snapshot_hashes[entry.id] = snap.content_hash;
      state.snapshot_version_tokens[entry.id] = snap.version_token;
    }

    if (decision.action === "auto_publish") {
      // Partial failures: quarantine only failed linked facts mentioned in reason
      const failedMatch = decision.reason.match(/failed: ([^)]+)\)/);
      if (failedMatch) {
        const failedIds = failedMatch[1]!.split(",").map((s) => s.trim()).filter(Boolean);
        if (failedIds.length) {
          const q: QuarantineItem = {
            id: `q-${entry.id}-partial-${Date.now()}`,
            created_at: new Date().toISOString(),
            watch_id: entry.id,
            url: entry.url,
            impact: entry.impact,
            reason: `Partial extraction failure for ${failedIds.join(", ")}`,
            previous_hash: state.snapshot_hashes[entry.id] || null,
            new_snapshot: stored,
            linked_fact_ids: [...entry.linked_fact_ids],
            affected_fact_ids: failedIds,
            status: "quarantined",
            requires_accountant_review: entry.impact === "high",
          };
          persistQuarantine(q);
          quarantine_ids.push(q.id);
          blockFacts(state, failedIds);
          quarantined += 1;
        }
      }
      const version = autoPublish(state, entry.id, decision.updates, decision.reason, {
        source_mode: snap.source_mode,
        version_token: snap.version_token,
        public_updated_at: snap.content_api?.public_updated_at || null,
      });
      published_versions.push(version);
      auto_published += 1;
      continue;
    }

    if (decision.action === "quarantine" || decision.action === "error") {
      const affected =
        decision.affected_fact_ids?.length
          ? decision.affected_fact_ids
          : [...entry.linked_fact_ids];
      const q: QuarantineItem = {
        id: `q-${entry.id}-${Date.now()}`,
        created_at: new Date().toISOString(),
        watch_id: entry.id,
        url: entry.url,
        impact: entry.impact,
        reason: decision.reason,
        previous_hash: state.snapshot_hashes[entry.id] || null,
        new_snapshot: stored,
        linked_fact_ids: [...entry.linked_fact_ids],
        affected_fact_ids: affected,
        status: "quarantined",
        requires_accountant_review:
          decision.action === "quarantine"
            ? Boolean(decision.requires_accountant_review)
            : true,
      };
      persistQuarantine(q);
      quarantine_ids.push(q.id);
      blockFacts(state, affected);
      quarantined += 1;
      if (decision.action === "error") {
        authenticity_failures += 1;
        errors += 1;
      }
      const a = alert(
        decision.action === "error" ? "critical" : "warn",
        decision.action === "error" ? "hmrc_monitor_error" : "hmrc_fact_quarantined",
        `Quarantined affected facts for ${entry.id}: ${affected.join(", ")}`,
        { quarantine_id: q.id, affected },
      );
      alerts.push({ level: a.level, code: a.code, message: a.message });
      reloadFacts();
      continue;
    }
  }

  const finished_at = new Date().toISOString();
  state.last_cycle_at = finished_at;
  state.last_cycle_summary = {
    checked: watchlist.entries.length,
    unchanged,
    auto_published,
    quarantined,
    authenticity_failures,
    errors,
    blocked_fact_ids: state.blocked_fact_ids,
  };
  saveState(state);

  return {
    started_at,
    finished_at,
    checked: watchlist.entries.length,
    unchanged,
    auto_published,
    quarantined,
    authenticity_failures,
    errors,
    snapshots,
    quarantine_ids,
    published_versions,
    blocked_fact_ids: [...state.blocked_fact_ids],
    alerts,
  };
}

/** Accountant approval for quarantined / ambiguous facts only. */
export function approveQuarantine(
  quarantineId: string,
  opts?: { accountant_note?: string; fact_patches?: Partial<KnowledgeFact>[] },
): PublishedOverlay {
  ensureRuntimeDirs();
  const qPath = path.join(runtimePaths.hmrcQuarantine(), `${quarantineId}.json`);
  if (!existsSync(qPath)) throw new Error(`Quarantine item not found: ${quarantineId}`);
  const item = readJson<QuarantineItem>(qPath, null as unknown as QuarantineItem);
  if (item.status !== "quarantined") {
    throw new Error(`Quarantine item is ${item.status}, not quarantined`);
  }
  const baseline = loadFacts({ includePublishedOverlay: false });
  const byId = new Map(baseline.map((f) => [f.id, f]));
  const patches = new Map((opts?.fact_patches || []).map((p) => [String(p.id), p]));
  const facts: KnowledgeFact[] = [];
  for (const id of item.affected_fact_ids.length
    ? item.affected_fact_ids
    : item.linked_fact_ids) {
    const base = byId.get(id);
    if (!base) continue;
    const patch = patches.get(id) || {};
    facts.push({
      ...base,
      ...patch,
      id: base.id,
      source_url: base.source_url,
      publisher: base.publisher,
      last_verified: new Date().toISOString().slice(0, 10),
      knowledge_version: `accountant-${Date.now()}`,
      review_status: "accountant_approved_overlay",
    });
  }
  const overlay: PublishedOverlay = {
    version: `acct-${Date.now()}`,
    published_at: new Date().toISOString(),
    publication_mode: "accountant_approved",
    quarantine_id: quarantineId,
    facts,
    note: opts?.accountant_note || "Accountant approved quarantined facts",
  };
  writePublishedOverlay(overlay);
  item.status = "approved";
  item.decided_at = new Date().toISOString();
  item.accountant_note = opts?.accountant_note || null;
  persistQuarantine(item);
  const state = loadState();
  unblockFacts(
    state,
    facts.map((f) => f.id),
  );
  state.published_version = overlay.version;
  saveState(state);
  reloadFacts();
  alert("info", "hmrc_accountant_published", `Accountant published ${overlay.version}`, {
    quarantine_id: quarantineId,
  });
  return overlay;
}

export function rejectQuarantine(quarantineId: string, note?: string): QuarantineItem {
  const qPath = path.join(runtimePaths.hmrcQuarantine(), `${quarantineId}.json`);
  if (!existsSync(qPath)) throw new Error(`Quarantine item not found: ${quarantineId}`);
  const item = readJson<QuarantineItem>(qPath, null as unknown as QuarantineItem);
  item.status = "rejected";
  item.decided_at = new Date().toISOString();
  item.accountant_note = note || null;
  persistQuarantine(item);
  // Keep affected facts blocked so SIMBA does not invent answers
  const state = loadState();
  blockFacts(state, item.affected_fact_ids);
  saveState(state);
  reloadFacts();
  alert("warn", "hmrc_quarantine_rejected", `Rejected quarantine ${quarantineId}`, { note });
  return item;
}

export function rollbackPublishedOverlay(): {
  rolled_back: boolean;
  restored_version: string | null;
} {
  ensureRuntimeDirs();
  const pubDir = runtimePaths.hmrcPublished();
  const histDir = runtimePaths.hmrcHistory();
  const published = existsSync(pubDir)
    ? readdirSync(pubDir).filter((f) => f.endsWith(".json")).sort()
    : [];
  if (!published.length) return { rolled_back: false, restored_version: null };
  const current = published[published.length - 1]!;
  writeJson(
    path.join(histDir, `rollback-from-${current}`),
    readJson(path.join(pubDir, current), {}),
  );
  unlinkSync(path.join(pubDir, current));
  const remaining = readdirSync(pubDir).filter((f) => f.endsWith(".json")).sort();
  const restored = remaining.length ? remaining[remaining.length - 1]! : null;
  const state = loadState();
  state.published_version = restored ? restored.replace(/\.json$/, "") : null;
  saveState(state);
  reloadFacts();
  alert("warn", "hmrc_overlay_rollback", `Rolled back published overlay ${current}`, {
    restored_version: restored,
  });
  return {
    rolled_back: true,
    restored_version: restored ? restored.replace(/\.json$/, "") : null,
  };
}

export function hmrcStatus(): Record<string, unknown> {
  ensureRuntimeDirs();
  const state = loadState();
  return {
    system: "hmrc_knowledge_monitor",
    publication_policy:
      state.publication_policy ||
      "automatic_verified_official_changes; quarantine only ambiguous/conflicting/withdrawn",
    last_cycle_at: state.last_cycle_at || null,
    last_cycle_summary: state.last_cycle_summary || null,
    published_version: state.published_version || null,
    quarantined_open: listQuarantine("quarantined").length,
    blocked_fact_ids: state.blocked_fact_ids || [],
    scheduler: state.scheduler || null,
    recent_alerts: readRecentAlerts(runtimePaths.hmrcAlerts(), 10),
    customer_facing_rule:
      "Verified official updates auto-publish. Quarantined/blocked fact IDs are omitted from retrieval; unaffected verified knowledge remains available. SIMBA does not perform client MTD reviews, bookkeeping corrections, tax-return preparation or HMRC submissions.",
  };
}

let timer: NodeJS.Timeout | null = null;

export function startHmrcScheduler(opts?: {
  intervalMs?: number;
  fetchPage?: FetchPageFn;
  fetchContentApi?: FetchContentApiFn;
}): { enabled: boolean; interval_ms: number } {
  const enabled =
    String(process.env.CONCIERGE_HMRC_MONITOR_ENABLED || "")
      .trim()
      .toLowerCase() === "true";
  const interval_ms =
    opts?.intervalMs ||
    Number(process.env.CONCIERGE_HMRC_MONITOR_INTERVAL_MS || 6 * 60 * 60 * 1000);
  const state = loadState();
  state.scheduler = {
    enabled,
    interval_ms,
    runs: state.scheduler?.runs || 0,
  };
  saveState(state);
  if (!enabled) return { enabled: false, interval_ms };
  if (timer) clearInterval(timer);
  const tick = async () => {
    try {
      await runHmrcMonitorCycle({
        fetchPage: opts?.fetchPage,
        fetchContentApi: opts?.fetchContentApi,
      });
      const s = loadState();
      s.scheduler = {
        enabled: true,
        interval_ms,
        runs: (s.scheduler?.runs || 0) + 1,
      };
      saveState(s);
    } catch (err) {
      alert("critical", "hmrc_scheduler_error", (err as Error).message);
    }
  };
  setTimeout(() => void tick(), 2_000);
  timer = setInterval(() => void tick(), interval_ms);
  if (typeof timer.unref === "function") timer.unref();
  alert("info", "hmrc_scheduler_started", `HMRC monitor scheduler every ${interval_ms}ms`);
  return { enabled: true, interval_ms };
}

export function stopHmrcScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
