/** Grounding helpers — keep verified official figures ahead of model memory. */

import type { SourceReference } from "../models/schemas.js";

export const MAX_FACT_EXCERPT_CHARS = 1200;

export function factExcerpt(
  summary: string,
  limit = MAX_FACT_EXCERPT_CHARS,
): string {
  const text = (summary || "").trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).replace(/\s+$/, "") + "…";
}

function joinedSources(sources: SourceReference[]): string {
  return sources.map((s) => `${s.title} ${s.excerpt || ""}`).join(" ");
}

export function applyGroundingGuard(
  reply: string,
  message: string,
  sources: SourceReference[],
): [string, string[]] {
  if (!reply || !sources.length) return [reply, []];

  const flags: string[] = [];
  let out = reply;
  const corpus = joinedSources(sources);
  const corpusCompact = corpus.toLowerCase().replace(/,/g, "");
  const msgCompact = message.toLowerCase().replace(/,/g, "");

  // VAT: verified £90,000 must beat stale £85,000 model memory.
  if (corpusCompact.includes("90000") || corpusCompact.includes("£90000")) {
    const hasStale = /£?\s*85[\s,]*000/i.test(out);
    const has90 = /£?\s*90[\s,]*000/i.test(out);
    if (hasStale && !has90) {
      out = out.replace(/£?\s*85[\s,]*000/gi, "£90,000");
      flags.push("corrected_stale_vat_threshold_85000");
    } else if (hasStale && has90) {
      out = out.replace(/£?\s*85[\s,]*000/gi, "£90,000");
      flags.push("removed_stale_vat_threshold_85000");
    }
  }

  // MTD £30k band: verified start is 6 April 2027, not April 2026.
  const asks30k =
    /(?:£?\s*30[\s,]*000|30000)/i.test(message) ||
    msgCompact.includes("30000");
  const corpusHas30k2027 =
    (corpusCompact.includes("30000") || corpusCompact.includes("£30000")) &&
    corpusCompact.includes("2027");

  if (asks30k && corpusHas30k2027) {
    const has2026 = /\b(?:6\s+)?april\s+2026\b/i.test(out);
    const has2027 = /\b(?:6\s+)?april\s+2027\b/i.test(out);
    if (has2026 && !has2027) {
      out = out.replace(/\b(?:6\s+)?april\s+2026\b/i, "6 April 2027");
      flags.push("corrected_mtd_30k_start_to_april_2027");
      if (!out.includes("April 2026 applies only")) {
        out =
          out.replace(/\s+$/, "") +
          "\n\nNote: for qualifying income over £30,000 in 2025-26, " +
          "Making Tax Digital for Income Tax starts from 6 April 2027. " +
          "6 April 2026 applies to the £50,000 (2024-25) band.";
        flags.push("added_mtd_band_clarification");
      }
    }
  }

  return [out, flags];
}
