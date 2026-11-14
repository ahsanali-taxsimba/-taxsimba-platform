/** Writable runtime overlay paths (no redeploy required). */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths.js";

export function runtimeRoot(): string {
  const override = process.env.CONCIERGE_RUNTIME_DIR?.trim();
  return override || path.join(DATA_DIR, "runtime");
}

export function ensureRuntimeDirs(): void {
  const root = runtimeRoot();
  for (const rel of [
    "hmrc/snapshots",
    "hmrc/quarantine",
    "hmrc/published",
    "hmrc/history",
    "hmrc/alerts",
    "catalog/overlays",
    "catalog/history",
    "catalog/alerts",
  ]) {
    mkdirSync(path.join(root, rel), { recursive: true });
  }
}

export const runtimePaths = {
  hmrcSnapshots: () => path.join(runtimeRoot(), "hmrc/snapshots"),
  hmrcQuarantine: () => path.join(runtimeRoot(), "hmrc/quarantine"),
  hmrcPublished: () => path.join(runtimeRoot(), "hmrc/published"),
  hmrcHistory: () => path.join(runtimeRoot(), "hmrc/history"),
  hmrcAlerts: () => path.join(runtimeRoot(), "hmrc/alerts"),
  hmrcState: () => path.join(runtimeRoot(), "hmrc/state.json"),
  catalogOverlays: () => path.join(runtimeRoot(), "catalog/overlays"),
  catalogHistory: () => path.join(runtimeRoot(), "catalog/history"),
  catalogAlerts: () => path.join(runtimeRoot(), "catalog/alerts"),
  catalogLive: () => path.join(runtimeRoot(), "catalog/overlays/packages.live.json"),
  catalogState: () => path.join(runtimeRoot(), "catalog/state.json"),
};
