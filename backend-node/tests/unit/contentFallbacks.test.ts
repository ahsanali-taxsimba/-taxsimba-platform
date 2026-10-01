import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import { CONTENT_DEFAULTS } from "../../src/domain/content";

const FRONTEND_SRC = join(__dirname, "..", "..", "..", "frontend", "src");
const CALL = /\bt\(\s*"([A-Za-z0-9_.]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.jsx?$/.test(name) ? [path] : [];
  });
}

function adoptedKeys(): { key: string; fallback: string; file: string }[] {
  const out: { key: string; fallback: string; file: string }[] = [];
  for (const file of sources(FRONTEND_SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(CALL)) {
      out.push({ key: m[1], fallback: m[2].replace(/\\"/g, '"'), file });
    }
  }
  return out;
}

describe("frontend content fallbacks", () => {
  const adopted = adoptedKeys();

  it("finds the adopted content keys", () => {
    expect(adopted.length).toBeGreaterThan(20);
  });

  it("only uses allow-listed keys", () => {
    const unknown = adopted.filter((a) => !(a.key in CONTENT_DEFAULTS));
    expect(unknown.map((u) => `${u.key} (${u.file})`)).toEqual([]);
  });

  it("keeps the code default identical to the hard-coded wording, so the UI is unchanged", () => {
    const drifted = adopted
      .filter((a) => CONTENT_DEFAULTS[a.key] && CONTENT_DEFAULTS[a.key].value !== a.fallback)
      .map((a) => `${a.key}: default "${CONTENT_DEFAULTS[a.key].value}" vs frontend "${a.fallback}"`);
    expect(drifted).toEqual([]);
  });
});
