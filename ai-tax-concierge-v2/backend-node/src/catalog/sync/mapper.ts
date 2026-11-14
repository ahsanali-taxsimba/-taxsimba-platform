/**
 * Map TaxSimba public/approved catalogue API codes onto stable SIMBA package IDs
 * used by checkout / portal (SA_* / MTD_STARTER|GROWTH|COMPLETE).
 */

import type { UpstreamPlan } from "./types.js";

/** Stable SIMBA / portal codes — never rename these identifiers. */
export const STABLE_SA_CODES = ["SA_SIMPLE", "SA_SMART", "SA_ELITE"] as const;
export const STABLE_MTD_CODES = [
  "MTD_STARTER",
  "MTD_GROWTH",
  "MTD_COMPLETE",
] as const;

export const API_TO_STABLE: Record<string, string> = {
  SIMPLE: "SA_SIMPLE",
  SMART: "SA_SMART",
  ELITE: "SA_ELITE",
  SA_SIMPLE: "SA_SIMPLE",
  SA_SMART: "SA_SMART",
  SA_ELITE: "SA_ELITE",
  MTD_COMPLY: "MTD_STARTER",
  MTD_GROWTH: "MTD_GROWTH",
  MTD_ELITE: "MTD_COMPLETE",
  MTD_STARTER: "MTD_STARTER",
  MTD_COMPLETE: "MTD_COMPLETE",
};

export const REMOVED_CLAIM_PATTERNS = [
  /priority\s+(accountant\s+)?messaging/i,
  /priority\s+turnaround/i,
  /priority\s+email/i,
  /priority\s+support/i,
  /quarterly\s+business\s+reviews/i,
  /reviews your business each quarter/i,
  /proactive\s+tax\s+planning/i,
  /tax\s+planning\s+conversation/i,
  /tax\s+planning\s+advice/i,
  /telephone\s+onboarding/i,
  /24\/7/i,
  /phone\s+helpline/i,
];

export function mapApiCodeToStable(code: string): string | null {
  return API_TO_STABLE[code] || null;
}

export function isPublishedPlan(plan: UpstreamPlan): boolean {
  if (plan.priceAvailable === false) return false;
  if (typeof plan.price !== "number" || Number.isNaN(plan.price)) return false;
  if (!plan.name || !plan.code) return false;
  return true;
}

export function stripRemovedClaims(features: string[] | undefined): {
  kept: string[];
  stripped: string[];
} {
  const kept: string[] = [];
  const stripped: string[] = [];
  for (const f of features || []) {
    if (REMOVED_CLAIM_PATTERNS.some((re) => re.test(f))) stripped.push(f);
    else kept.push(f);
  }
  return { kept, stripped };
}

export function billingFromUpstream(plan: UpstreamPlan, family: "sa" | "mtd"): string {
  const raw = (plan.billingFrequency || "").toLowerCase();
  if (family === "mtd") return "per month";
  if (raw.includes("month")) return "per month";
  return "per tax year";
}

export function vatNoteFromUpstream(plan: UpstreamPlan, family: "sa" | "mtd"): string {
  const t = (plan.vatTreatment || "").toUpperCase();
  if (family === "mtd" || t === "INCLUSIVE") return "VAT included";
  return "Confirm VAT treatment on checkout";
}
