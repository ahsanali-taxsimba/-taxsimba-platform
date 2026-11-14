/**
 * HMRC / GOV.UK knowledge monitor.
 *
 * Detects official-page changes, quarantines ambiguous/high-impact diffs for
 * accountant approval, and only then publishes versioned overlays customers see.
 * Baseline corpus remains historical source of truth until overlay publishes.
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
import { fetchWatchPage } from "./fetcher.js";
import type {
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
  published_version?: string | null;
  scheduler?: { enabled: boolean; interval_ms: number; runs: number };
};

function loadState(): HmrcState {
  return readJson<HmrcState>(runtimePaths.hmrcState(), {
    snapshot_hashes: {},
    scheduler: { enabled: false, interval_ms: 0, runs: 0 },
  });
}

function saveState(state: HmrcState): void {
  writeJson(runtimePaths.hmrcState(), state);
}

export function loadPublishedFacts(): KnowledgeFact[] {
  ensureRuntimeDirs();
  const dir = runtimePaths.hmrcPublished();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (!files.length) return [];
  const latest = files[files.length - 1]!;
  const overlay = readJson<PublishedOverlay>(path.join(dir, latest), {
    version: "",
    published_at: "",
    facts: [],
  });
  return overlay.facts || [];
}

export function listQuarantine(status?: string): QuarantineItem[] {
  ensureRuntimeDirs();
  const dir = runtimePaths.hmrcQuarantine();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<QuarantineItem>(path.join(dir, f), null as unknown as QuarantineItem))
    .filter(Boolean)
    .filter((q) => (status ? q.status === status : true))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function alert(level: "info" | "warn" | "critical", code: string, message: string, details?: Record<string, unknown>) {
  return writeAlert(runtimePaths.hmrcAlerts(), {
    system: "hmrc",
    level,
    code,
    message,
    details,
  });
}

export async function runHmrcMonitorCycle(opts?: {
  fetchPage?: FetchPageFn;
  forceQuarantineWatchId?: string;
}): Promise<HmrcMonitorCycleResult> {
  ensureRuntimeDirs();
  const started_at = new Date().toISOString();
  const watchlist = loadWatchlist();
  const state = loadState();
  const snapshots: PageSnapshot[] = [];
  const quarantine_ids: string[] = [];
  const alerts: HmrcMonitorCycleResult["alerts"] = [];
  let unchanged = 0;
  let quarantined = 0;
  let authenticity_failures = 0;
  let errors = 0;

  for (const entry of watchlist.entries) {
    const snap = await fetchWatchPage(
      entry,
      watchlist.allowed_host_suffixes,
      opts?.fetchPage,
    );
    snapshots.push(snap);
    writeJson(
      path.join(runtimePaths.hmrcSnapshots(), `${entry.id}.json`),
      snap,
    );

    if (!snap.ok) {
      authenticity_failures += 1;
      errors += 1;
      const a = alert(
        "critical",
        "hmrc_authenticity_or_fetch_failed",
        `Monitor failed for ${entry.id}: ${snap.error || "unknown"}`,
        { watch_id: entry.id, url: entry.url },
      );
      alerts.push({ level: a.level, code: a.code, message: a.message });
      continue;
    }

    const prevHash = state.snapshot_hashes[entry.id];
    const changed =
      !prevHash ||
      prevHash !== snap.content_hash ||
      opts?.forceQuarantineWatchId === entry.id;

    if (!changed) {
      unchanged += 1;
      // bump last_verified on published overlay copies only when hash unchanged — no content change
      continue;
    }

    // Any content change that could affect customer answers is quarantined.
    const reasonParts = [
      prevHash
        ? `Content hash changed (${prevHash.slice(0, 8)} → ${snap.content_hash.slice(0, 8)})`
        : "First snapshot captured — baseline recorded; awaiting accountant review before overlay publish",
    ];
    if (!snap.authenticity.expected_phrases_ok) {
      reasonParts.push(
        `Missing expected phrases: ${snap.authenticity.missing_phrases.join(", ")}`,
      );
    }
    if (entry.impact === "high") {
      reasonParts.push("High-impact tax guidance — accountant approval required");
    }
    if (!snap.effective_dates_found.length) {
      reasonParts.push("No clear effective dates extracted — ambiguous");
    }

    const item: QuarantineItem = {
      id: `q-${entry.id}-${Date.now()}`,
      created_at: new Date().toISOString(),
      watch_id: entry.id,
      url: entry.url,
      impact: entry.impact,
      reason: reasonParts.join(". "),
      previous_hash: prevHash || null,
      new_snapshot: snap,
      linked_fact_ids: [...entry.linked_fact_ids],
      status: "quarantined",
    };
    writeJson(path.join(runtimePaths.hmrcQuarantine(), `${item.id}.json`), item);
    quarantine_ids.push(item.id);
    quarantined += 1;

    // Store hash so we do not repeatedly re-open identical diffs, but
    // customers still see baseline/previous published overlay until approval.
    state.snapshot_hashes[entry.id] = snap.content_hash;

    const a = alert(
      entry.impact === "high" ? "critical" : "warn",
      "hmrc_change_quarantined",
      `Quarantined GOV.UK change for ${entry.id}; not published to customers`,
      {
        quarantine_id: item.id,
        linked_fact_ids: item.linked_fact_ids,
        impact: entry.impact,
      },
    );
    alerts.push({ level: a.level, code: a.code, message: a.message });
  }

  const finished_at = new Date().toISOString();
  const summary = {
    checked: watchlist.entries.length,
    unchanged,
    quarantined,
    authenticity_failures,
    errors,
  };
  state.last_cycle_at = finished_at;
  state.last_cycle_summary = summary;
  saveState(state);

  return {
    started_at,
    finished_at,
    checked: watchlist.entries.length,
    unchanged,
    quarantined,
    authenticity_failures,
    errors,
    snapshots,
    quarantine_ids,
    alerts,
  };
}

/**
 * Accountant approval publishes a versioned overlay of linked facts with
 * refreshed last_verified / knowledge_version. Historical baseline corpus
 * files are never deleted.
 */
export function approveQuarantine(
  quarantineId: string,
  opts?: { accountant_note?: string; fact_patches?: Partial<KnowledgeFact>[] },
): PublishedOverlay {
  ensureRuntimeDirs();
  const qPath = path.join(runtimePaths.hmrcQuarantine(), `${quarantineId}.json`);
  if (!existsSync(qPath)) {
    throw new Error(`Quarantine item not found: ${quarantineId}`);
  }
  const item = readJson<QuarantineItem>(qPath, null as unknown as QuarantineItem);
  if (item.status !== "quarantined") {
    throw new Error(`Quarantine item is ${item.status}, not quarantined`);
  }

  // Load baseline facts for linked ids (without overlays — see loader baseline mode)
  const baseline = loadFacts({ includePublishedOverlay: false });
  const byId = new Map(baseline.map((f) => [f.id, f]));
  const patches = new Map(
    (opts?.fact_patches || []).map((p) => [String(p.id), p]),
  );

  const facts: KnowledgeFact[] = [];
  for (const id of item.linked_fact_ids) {
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
      knowledge_version: `overlay-${Date.now()}`,
      review_status: "accountant_approved_overlay",
      effective_date:
        patch.effective_date ??
        item.new_snapshot.effective_dates_found[0] ??
        base.effective_date,
    });
  }

  const overlay: PublishedOverlay = {
    version: `pub-${Date.now()}`,
    published_at: new Date().toISOString(),
    quarantine_id: quarantineId,
    facts,
    note: opts?.accountant_note || "Accountant approved quarantine publication",
  };

  // Preserve prior published as history
  const pubDir = runtimePaths.hmrcPublished();
  if (existsSync(pubDir)) {
    for (const f of readdirSync(pubDir).filter((x) => x.endsWith(".json"))) {
      const src = path.join(pubDir, f);
      writeJson(
        path.join(runtimePaths.hmrcHistory(), `hist-${f}`),
        readJson(src, {}),
      );
    }
  }
  writeJson(path.join(pubDir, `${overlay.version}.json`), overlay);

  item.status = "approved";
  item.decided_at = new Date().toISOString();
  item.accountant_note = opts?.accountant_note || null;
  writeJson(qPath, item);

  const state = loadState();
  state.published_version = overlay.version;
  saveState(state);

  alert("info", "hmrc_overlay_published", `Published knowledge overlay ${overlay.version}`, {
    quarantine_id: quarantineId,
    fact_ids: facts.map((f) => f.id),
  });

  reloadFacts();
  return overlay;
}

export function rejectQuarantine(quarantineId: string, note?: string): QuarantineItem {
  const qPath = path.join(runtimePaths.hmrcQuarantine(), `${quarantineId}.json`);
  if (!existsSync(qPath)) throw new Error(`Quarantine item not found: ${quarantineId}`);
  const item = readJson<QuarantineItem>(qPath, null as unknown as QuarantineItem);
  item.status = "rejected";
  item.decided_at = new Date().toISOString();
  item.accountant_note = note || null;
  writeJson(qPath, item);
  alert("warn", "hmrc_quarantine_rejected", `Rejected quarantine ${quarantineId}`, {
    note,
  });
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
  if (!published.length) {
    return { rolled_back: false, restored_version: null };
  }
  const current = published[published.length - 1]!;
  // archive current
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
    last_cycle_at: state.last_cycle_at || null,
    last_cycle_summary: state.last_cycle_summary || null,
    published_version: state.published_version || null,
    quarantined_open: listQuarantine("quarantined").length,
    scheduler: state.scheduler || null,
    recent_alerts: readRecentAlerts(runtimePaths.hmrcAlerts(), 10),
    customer_facing_rule:
      "Only baseline corpus + accountant-approved published overlays are served. Quarantined changes never reach customers.",
  };
}

let timer: NodeJS.Timeout | null = null;

export function startHmrcScheduler(opts?: {
  intervalMs?: number;
  fetchPage?: FetchPageFn;
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
      await runHmrcMonitorCycle({ fetchPage: opts?.fetchPage });
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
  // Run once shortly after start, then on interval
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
