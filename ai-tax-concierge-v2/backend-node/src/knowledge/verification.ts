/** Source verification — only emit references that pass policy checks. */

import { factExcerpt } from "./grounding.js";
import type { RankedFact } from "./retrieval.js";
import type { SourceReference } from "../models/schemas.js";

const ALLOWED_HOSTS = new Set(["www.gov.uk", "gov.uk", "www.gov.uk."]);
const ALLOWED_PUBLISHER_MARKERS = [
  "hmrc",
  "gov.uk",
  "government digital service",
];

function hostAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host) return false;
    return ALLOWED_HOSTS.has(host) || host.endsWith(".gov.uk");
  } catch {
    return false;
  }
}

function publisherAllowed(publisher: string): boolean {
  const p = (publisher || "").toLowerCase();
  return ALLOWED_PUBLISHER_MARKERS.some((m) => p.includes(m));
}

export function verifyRanked(ranked: RankedFact[]): SourceReference[] {
  const out: SourceReference[] = [];
  for (const item of ranked) {
    const fact = item.fact;
    const ok =
      Boolean(fact.source_url) &&
      hostAllowed(fact.source_url) &&
      publisherAllowed(fact.publisher) &&
      Boolean(fact.tax_years?.length);
    if (!ok) continue;
    out.push({
      id: fact.id,
      title: fact.title,
      publisher: fact.publisher,
      url: fact.source_url,
      tax_years: [...fact.tax_years],
      verified: true,
      excerpt: factExcerpt(fact.summary),
    });
  }
  return out;
}

export function confidenceFromSources(
  sources: SourceReference[],
  yearMatches: number,
): "high" | "medium" | "low" {
  if (!sources.length) return "low";
  if (sources.length >= 2 && yearMatches >= 1) return "high";
  if (yearMatches >= 1) return "medium";
  return "low";
}
