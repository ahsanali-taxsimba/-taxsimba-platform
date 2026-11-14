/**
 * Automatic TaxSimba package catalogue synchronisation.
 *
 * Pulls the approved live (or staging) subscription-plans APIs, maps onto stable
 * SIMBA package IDs, strips unpublished / removed claims, and writes a runtime
 * overlay that packagesCatalog() loads without redeploy.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { CATALOG_DIR } from "../../paths.js";
import { writeAlert, readRecentAlerts } from "../../ops/alerts.js";
import {
  ensureRuntimeDirs,
  runtimePaths,
} from "../../ops/runtime_paths.js";
import { packagesCatalog } from "../service.js";
import {
  STABLE_MTD_CODES,
  STABLE_SA_CODES,
  billingFromUpstream,
  isPublishedPlan,
  mapApiCodeToStable,
  stripRemovedClaims,
  vatNoteFromUpstream,
} from "./mapper.js";
import type {
  CatalogueSyncResult,
  FetchCatalogueFn,
  UpstreamCataloguePayload,
  UpstreamPlan,
} from "./types.js";

export const defaultFetchCatalogue: FetchCatalogueFn = async (url) => {
  const resp = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TaxSimba-SIMBA-Catalogue-Sync/1.0",
    },
  });
  if (!resp.ok) {
    throw new Error(`Catalogue fetch failed ${resp.status} for ${url}`);
  }
  return (await resp.json()) as UpstreamCataloguePayload;
};

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf-8")) as T;
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

type CatalogState = {
  last_sync_at?: string | null;
  last_sync_summary?: Record<string, unknown> | null;
  overlay_version?: string | null;
  scheduler?: { enabled: boolean; interval_ms: number; runs: number };
  source_sa?: string;
  source_mtd?: string;
};

function loadState(): CatalogState {
  return readJson<CatalogState>(runtimePaths.catalogState(), {
    scheduler: { enabled: false, interval_ms: 0, runs: 0 },
  });
}

function saveState(state: CatalogState): void {
  writeJson(runtimePaths.catalogState(), state);
}

function baselineCatalog(): Record<string, any> {
  return JSON.parse(
    readFileSync(path.join(CATALOG_DIR, "packages.json"), "utf-8"),
  ) as Record<string, any>;
}

function alert(
  level: "info" | "warn" | "critical",
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return writeAlert(runtimePaths.catalogAlerts(), {
    system: "catalog",
    level,
    code,
    message,
    details,
  });
}

function indexPlans(plans: UpstreamPlan[]): Map<string, UpstreamPlan> {
  const map = new Map<string, UpstreamPlan>();
  for (const p of plans) {
    const stable = mapApiCodeToStable(p.code);
    if (stable) map.set(stable, p);
  }
  return map;
}

function applyOwnerCommercialOverlay(cat: Record<string, any>): void {
  // Owner-approved commercial rules always win over raw website bullets.
  cat.owner_decisions = {
    ...(cat.owner_decisions || {}),
    bookkeeping_numerical_limits_approved: true,
    bookkeeping_transaction_limits: "NO_FIXED_MONTHLY_TRANSACTION_CAPS",
    bookkeeping_no_fixed_monthly_caps_note:
      "Owner approved: no fixed monthly transaction caps on Simbian Comply/Growth/Elite. This does not mean unlimited out-of-scope work.",
    recorded_at: cat.owner_decisions?.recorded_at || "2026-11-13",
    correction_2026_11_14_no_fixed_caps: true,
  };

  const facts = (cat.approved_customer_facts || []) as Array<Record<string, any>>;
  const bk = facts.find((f) => f.id === "bookkeeping_tier_limits");
  if (bk) {
    bk.status = "approved_no_fixed_monthly_transaction_caps";
    bk.text =
      "TaxSimba maintains clients’ digital bookkeeping records. The owner has approved that there are no fixed monthly transaction caps on Simbian Comply, Growth and Elite. This does not authorise unlimited out-of-scope work outside the agreed service.";
  }

  for (const p of cat.mtd || []) {
    p.inclusions = (p.inclusions || []).map((line: string) =>
      line.includes("transaction caps UNDECIDED")
        ? line.replace(
            /within .+ package limits \(transaction caps UNDECIDED\)/,
            "with no fixed monthly transaction caps (not unlimited out-of-scope work)",
          )
        : line,
    );
    if (p.inclusion_item_statuses) {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(p.inclusion_item_statuses)) {
        const nk = k.includes("transaction caps UNDECIDED")
          ? k.replace(
              /within .+ package limits \(transaction caps UNDECIDED\)/,
              "with no fixed monthly transaction caps (not unlimited out-of-scope work)",
            )
          : k;
        next[nk] =
          String(v) === "approved_limits_undecided"
            ? "approved_no_fixed_monthly_transaction_caps"
            : String(v);
      }
      p.inclusion_item_statuses = next;
    }
  }

  if (typeof cat.disclaimer === "string") {
    cat.disclaimer = cat.disclaimer.replace(
      /bookkeeping within package limits \(transaction caps UNDECIDED\)/gi,
      "bookkeeping with no fixed monthly transaction caps (not unlimited out-of-scope work)",
    );
  }
}

export function catalogueUrls(settings?: {
  websiteBaseUrl?: string;
  saUrl?: string;
  mtdUrl?: string;
}): { sa: string; mtd: string } {
  if (settings?.saUrl && settings?.mtdUrl) {
    return { sa: settings.saUrl, mtd: settings.mtdUrl };
  }
  const envSa = process.env.TAXSIMBA_CATALOGUE_SA_URL?.trim();
  const envMtd = process.env.TAXSIMBA_CATALOGUE_MTD_URL?.trim();
  if (envSa && envMtd) return { sa: envSa, mtd: envMtd };

  const base = (
    process.env.TAXSIMBA_CATALOGUE_API_BASE ||
    settings?.websiteBaseUrl ||
    process.env.WEBSITE_BASE_URL ||
    "https://taxsimba.co.uk"
  ).replace(/\/$/, "");
  // Public approved catalogue endpoints (authoritative for published prices/names).
  return {
    sa: `${base}/api/compat/subscription-plans?category=taxSimba`,
    mtd: `${base}/api/compat/subscription-plans?category=mtd`,
  };
}

export async function syncCatalogueFromUpstream(opts?: {
  fetchCatalogue?: FetchCatalogueFn;
  saUrl?: string;
  mtdUrl?: string;
  websiteBaseUrl?: string;
}): Promise<CatalogueSyncResult> {
  ensureRuntimeDirs();
  const started_at = new Date().toISOString();
  const urls = catalogueUrls({
    websiteBaseUrl: opts?.websiteBaseUrl,
    saUrl: opts?.saUrl,
    mtdUrl: opts?.mtdUrl,
  });
  const fetchCatalogue = opts?.fetchCatalogue || defaultFetchCatalogue;

  const saPayload = await fetchCatalogue(urls.sa);
  const mtdPayload = await fetchCatalogue(urls.mtd);

  const saPlans = saPayload.data || [];
  const mtdPlans = mtdPayload.data || [];
  if (saPayload.success === false || mtdPayload.success === false) {
    alert("critical", "catalog_upstream_unsuccessful", "Upstream catalogue returned success=false");
    return {
      started_at,
      finished_at: new Date().toISOString(),
      source_sa: urls.sa,
      source_mtd: urls.mtd,
      applied: false,
      reason: "Upstream success=false",
      stable_codes_preserved: [...STABLE_SA_CODES, ...STABLE_MTD_CODES],
      price_changes: [],
      name_changes: [],
      skipped_unpublished: [],
      removed_claims_stripped: [],
    };
  }

  const saMap = indexPlans(saPlans);
  const mtdMap = indexPlans(mtdPlans);
  const base = baselineCatalog();
  // Start from current effective catalogue (baseline or previous overlay) so
  // consultation + owner metadata persist across syncs.
  const current = JSON.parse(JSON.stringify(packagesCatalog())) as Record<string, any>;
  // Always re-base stable SKU lists from committed baseline shape
  current.self_assessment = JSON.parse(JSON.stringify(base.self_assessment));
  current.mtd = JSON.parse(JSON.stringify(base.mtd));
  current.consultation = current.consultation || base.consultation;

  const price_changes: CatalogueSyncResult["price_changes"] = [];
  const name_changes: CatalogueSyncResult["name_changes"] = [];
  const skipped_unpublished: string[] = [];
  const removed_claims_stripped: string[] = [];
  const stable_codes_preserved = [...STABLE_SA_CODES, ...STABLE_MTD_CODES];

  const applyFamily = (
    items: Record<string, any>[],
    upstream: Map<string, UpstreamPlan>,
    family: "sa" | "mtd",
  ) => {
    for (const item of items) {
      const code = String(item.code);
      const plan = upstream.get(code);
      if (!plan) {
        skipped_unpublished.push(`${code}:missing_upstream`);
        continue;
      }
      if (!isPublishedPlan(plan)) {
        skipped_unpublished.push(`${code}:unpublished`);
        continue;
      }
      const prevPrice = Number(item.price_gbp);
      const prevName = String(item.name);
      if (prevPrice !== Number(plan.price)) {
        price_changes.push({ code, from: prevPrice, to: Number(plan.price) });
      }
      if (prevName !== plan.name && family === "mtd") {
        // Prefer upstream customer-facing Simbian names
        name_changes.push({ code, from: prevName, to: plan.name });
        item.name = plan.name;
        item.public_api_name = plan.name;
      } else if (family === "sa") {
        // Keep SIMBA friendly SA names; sync price/description from upstream
      }
      item.price_gbp = Number(plan.price);
      item.price_status = "synced_from_approved_live_catalogue";
      item.name_status = "synced_from_approved_live_catalogue";
      item.billing = billingFromUpstream(plan, family);
      item.vat_note = vatNoteFromUpstream(plan, family);
      if (plan.description) {
        // Strip removed claim phrases from descriptions
        let desc = plan.description;
        for (const re of [
          /reviews your business each quarter\.?/gi,
          /proactive tax planning[^.]*\.?/gi,
        ]) {
          desc = desc.replace(re, "").replace(/\s+/g, " ").trim();
        }
        item.description = desc || item.description;
        item.description_status = "synced_from_approved_live_catalogue";
      }
      const { kept, stripped } = stripRemovedClaims(plan.features);
      removed_claims_stripped.push(...stripped.map((s) => `${code}:${s}`));
      // Merge synced feature bullets that are not already represented / not removed
      // without wiping owner-approved structured inclusions.
      item.synced_public_features = kept;
      item.source_public_api_code = plan.code;
      item.upstream_plan_id = plan.id || null;
      item.stripe_price_id = plan.stripePriceId ?? null;
      item.last_synced_at = new Date().toISOString();
    }
  };

  applyFamily(current.self_assessment, saMap, "sa");
  applyFamily(current.mtd, mtdMap, "mtd");

  // For SA, keep SIMBA display names but ensure prices match upstream
  for (const item of current.self_assessment) {
    const plan = saMap.get(String(item.code));
    if (plan && isPublishedPlan(plan)) {
      item.price_gbp = Number(plan.price);
    }
  }

  applyOwnerCommercialOverlay(current);
  current.version = `live-sync-${Date.now()}`;
  current.catalogue_sync = {
    synced_at: new Date().toISOString(),
    source_sa: urls.sa,
    source_mtd: urls.mtd,
    stable_codes_preserved,
    note: "Runtime overlay from approved TaxSimba catalogue — no redeploy required",
  };
  current.detailed_recommendations_status =
    "website_reconciled_owner_decisions_applied";

  // History: archive previous live overlay
  if (existsSync(runtimePaths.catalogLive())) {
    const stamp = Date.now();
    copyFileSync(
      runtimePaths.catalogLive(),
      path.join(runtimePaths.catalogHistory(), `packages.live.${stamp}.json`),
    );
  }

  const overlay_version = current.version;
  writeJson(runtimePaths.catalogLive(), current);
  packagesCatalog.clearCache?.();

  const finished_at = new Date().toISOString();
  const state = loadState();
  state.last_sync_at = finished_at;
  state.overlay_version = overlay_version;
  state.source_sa = urls.sa;
  state.source_mtd = urls.mtd;
  state.last_sync_summary = {
    price_changes,
    name_changes,
    skipped_unpublished,
    removed_claims_stripped_count: removed_claims_stripped.length,
  };
  saveState(state);

  alert("info", "catalog_sync_applied", `Catalogue overlay ${overlay_version} applied`, {
    price_changes,
    name_changes,
  });

  return {
    started_at,
    finished_at,
    source_sa: urls.sa,
    source_mtd: urls.mtd,
    applied: true,
    overlay_version,
    stable_codes_preserved,
    price_changes,
    name_changes,
    skipped_unpublished,
    removed_claims_stripped,
  };
}

export function rollbackCatalogueOverlay(): {
  rolled_back: boolean;
  restored_from: string | null;
} {
  ensureRuntimeDirs();
  const live = runtimePaths.catalogLive();
  const histDir = runtimePaths.catalogHistory();
  if (!existsSync(live)) {
    packagesCatalog.clearCache?.();
    return { rolled_back: false, restored_from: null };
  }
  // archive current
  copyFileSync(
    live,
    path.join(histDir, `rollback-from-${Date.now()}.json`),
  );
  const history = existsSync(histDir)
    ? readdirSync(histDir)
        .filter((f) => f.startsWith("packages.live.") && f.endsWith(".json"))
        .sort()
    : [];
  if (!history.length) {
    // revert to baseline by deleting live overlay
    unlinkSync(live);
    packagesCatalog.clearCache?.();
    const state = loadState();
    state.overlay_version = null;
    saveState(state);
    alert("warn", "catalog_rollback_to_baseline", "Removed live overlay; baseline packages.json active");
    return { rolled_back: true, restored_from: "baseline" };
  }
  const prev = history[history.length - 1]!;
  copyFileSync(path.join(histDir, prev), live);
  packagesCatalog.clearCache?.();
  const state = loadState();
  state.overlay_version = readJson<Record<string, any>>(live, {}).version || prev;
  saveState(state);
  alert("warn", "catalog_overlay_rollback", `Restored catalogue overlay from ${prev}`);
  return { rolled_back: true, restored_from: prev };
}

export function catalogSyncStatus(): Record<string, unknown> {
  ensureRuntimeDirs();
  const state = loadState();
  const liveExists = existsSync(runtimePaths.catalogLive());
  const cat = packagesCatalog();
  return {
    system: "taxsimba_catalogue_sync",
    live_overlay_present: liveExists,
    overlay_version: state.overlay_version || null,
    last_sync_at: state.last_sync_at || null,
    last_sync_summary: state.last_sync_summary || null,
    source_sa: state.source_sa || null,
    source_mtd: state.source_mtd || null,
    scheduler: state.scheduler || null,
    effective_prices: {
      sa: (cat.self_assessment || []).map((p: any) => ({
        code: p.code,
        name: p.name,
        price_gbp: p.price_gbp,
      })),
      mtd: (cat.mtd || []).map((p: any) => ({
        code: p.code,
        name: p.name,
        price_gbp: p.price_gbp,
      })),
    },
    recent_alerts: readRecentAlerts(runtimePaths.catalogAlerts(), 10),
  };
}

let timer: NodeJS.Timeout | null = null;

export function startCatalogueScheduler(opts?: {
  intervalMs?: number;
  fetchCatalogue?: FetchCatalogueFn;
}): { enabled: boolean; interval_ms: number } {
  const enabled =
    String(process.env.CONCIERGE_CATALOGUE_SYNC_ENABLED || "")
      .trim()
      .toLowerCase() === "true";
  const interval_ms =
    opts?.intervalMs ||
    Number(process.env.CONCIERGE_CATALOGUE_SYNC_INTERVAL_MS || 15 * 60 * 1000);
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
      await syncCatalogueFromUpstream({ fetchCatalogue: opts?.fetchCatalogue });
      const s = loadState();
      s.scheduler = {
        enabled: true,
        interval_ms,
        runs: (s.scheduler?.runs || 0) + 1,
      };
      saveState(s);
    } catch (err) {
      alert("critical", "catalog_scheduler_error", (err as Error).message);
    }
  };
  setTimeout(() => void tick(), 3_000);
  timer = setInterval(() => void tick(), interval_ms);
  if (typeof timer.unref === "function") timer.unref();
  alert(
    "info",
    "catalog_scheduler_started",
    `Catalogue sync scheduler every ${interval_ms}ms`,
  );
  return { enabled: true, interval_ms };
}

export function stopCatalogueScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
