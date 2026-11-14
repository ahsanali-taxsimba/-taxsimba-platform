/** Append-only alert log for dynamic systems. */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";

export type AlertLevel = "info" | "warn" | "critical";

export type AlertEvent = {
  at: string;
  system: "hmrc" | "catalog";
  level: AlertLevel;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export function writeAlert(
  dir: string,
  event: Omit<AlertEvent, "at"> & { at?: string },
): AlertEvent {
  mkdirSync(dir, { recursive: true });
  const full: AlertEvent = {
    at: event.at || new Date().toISOString(),
    system: event.system,
    level: event.level,
    code: event.code,
    message: event.message,
    details: event.details || {},
  };
  const day = full.at.slice(0, 10);
  const file = path.join(dir, `alerts-${day}.jsonl`);
  appendFileSync(file, JSON.stringify(full) + "\n", "utf-8");
  return full;
}

export function readRecentAlerts(dir: string, limit = 50): AlertEvent[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("alerts-") && f.endsWith(".jsonl"))
    .sort()
    .reverse();
  const out: AlertEvent[] = [];
  for (const f of files) {
    const lines = readFileSync(path.join(dir, f), "utf-8")
      .split("\n")
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        out.push(JSON.parse(lines[i]!) as AlertEvent);
      } catch {
        /* skip */
      }
      if (out.length >= limit) return out;
    }
  }
  return out;
}
