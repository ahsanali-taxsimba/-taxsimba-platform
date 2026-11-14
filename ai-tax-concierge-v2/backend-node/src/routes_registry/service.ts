/** Configurable website route registry — never invent live URLs. */

import { readFileSync } from "node:fs";
import { ROUTES_JSON } from "../paths.js";

let cache: Record<string, any> | null = null;

function raw(): Record<string, any> {
  if (!cache) {
    cache = JSON.parse(readFileSync(ROUTES_JSON, "utf-8"));
  }
  return cache!;
}

export function clearRoutesCache(): void {
  cache = null;
}

export function listRoutes(): Record<string, any> {
  return raw();
}

export function matchRoutes(
  message: string,
  limit = 3,
  websiteBase = "https://www.taxsimba.co.uk",
): Record<string, any>[] {
  const text = message.toLowerCase();
  const scored: Array<[number, Record<string, any>]> = [];
  for (const route of raw().routes as Record<string, any>[]) {
    const topics = (route.topics || []) as string[];
    const score = topics.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
    if (score) scored.push([score, route]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const out: Record<string, any>[] = [];
  for (const [, route] of scored.slice(0, limit)) {
    const item = { ...route };
    const status = route.status || "stub";
    const path = route.path || "";
    if (status === "live_verified") {
      item.url = `${websiteBase.replace(/\/$/, "")}${path}`;
      item.note =
        route.note ||
        "Public page title verified on taxsimba.co.uk";
    } else if (status === "soft_or_generic") {
      item.url = `${websiteBase.replace(/\/$/, "")}${path}`;
      item.note =
        route.note ||
        "HTTP reachable but destination not fully confirmed — verify before production handoff";
    } else {
      item.url = null;
      item.note =
        route.note ||
        "Route configured but not confirmed against live website";
    }
    out.push(item);
  }
  return out;
}

export function calculatorCount(): number {
  return (raw().routes as Record<string, any>[]).filter(
    (r) => r.kind === "calculator",
  ).length;
}
