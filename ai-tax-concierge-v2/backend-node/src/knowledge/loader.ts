/** Load curated knowledge corpus from disk + accountant-approved overlays. */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { CORPUS_DIR } from "../paths.js";
import type { KnowledgeFact } from "../models/schemas.js";
import { runtimePaths } from "../ops/runtime_paths.js";

let cache: KnowledgeFact[] | null = null;

function loadBaselineFacts(): KnowledgeFact[] {
  const facts: KnowledgeFact[] = [];
  const files = readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  for (const file of files) {
    const raw = JSON.parse(
      readFileSync(path.join(CORPUS_DIR, file), "utf-8"),
    ) as KnowledgeFact[];
    for (const item of raw) {
      facts.push(item);
    }
  }
  return facts;
}

function loadLatestPublishedOverlayFacts(): KnowledgeFact[] {
  const dir = runtimePaths.hmrcPublished();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (!files.length) return [];
  try {
    const overlay = JSON.parse(
      readFileSync(path.join(dir, files[files.length - 1]!), "utf-8"),
    ) as { facts?: KnowledgeFact[] };
    return overlay.facts || [];
  } catch {
    return [];
  }
}

/**
 * Customer-facing facts = baseline historical corpus merged with the latest
 * accountant-approved published overlay. Quarantined changes are never merged.
 */
export function loadFacts(opts?: {
  includePublishedOverlay?: boolean;
}): KnowledgeFact[] {
  const includeOverlay = opts?.includePublishedOverlay !== false;
  if (includeOverlay && cache) return cache;

  const byId = new Map<string, KnowledgeFact>();
  for (const f of loadBaselineFacts()) byId.set(f.id, f);
  if (includeOverlay) {
    for (const f of loadLatestPublishedOverlayFacts()) {
      // Overlay may refresh verification metadata / effective dates, but never
      // invents a fact id that was not already in the curated baseline.
      if (!byId.has(f.id)) continue;
      byId.set(f.id, { ...byId.get(f.id)!, ...f, id: f.id });
    }
  }
  const facts = [...byId.values()];
  if (includeOverlay) cache = facts;
  return facts;
}

export function reloadFacts(): KnowledgeFact[] {
  cache = null;
  return loadFacts();
}
