/** Load curated knowledge corpus from disk. */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CORPUS_DIR } from "../paths.js";
import type { KnowledgeFact } from "../models/schemas.js";

let cache: KnowledgeFact[] | null = null;

export function loadFacts(): KnowledgeFact[] {
  if (cache) return cache;
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
  cache = facts;
  return facts;
}

export function reloadFacts(): KnowledgeFact[] {
  cache = null;
  return loadFacts();
}
