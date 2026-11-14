/**
 * Risk-based publication decisioning.
 *
 * Owner policy: verified official HMRC/GOV.UK changes auto-publish into customer
 * answers when authenticity + structured extraction + validation pass.
 * Quarantine only affected facts when ambiguous, conflicting, withdrawn, or
 * requiring uncertain legal interpretation.
 */

import type {
  ExtractedFactUpdate,
  ImpactLevel,
  PageSnapshot,
  PublicationDecision,
  WatchlistEntry,
} from "./types.js";

const LEGAL_INTERPRETATION_MARKERS = [
  /it depends/i,
  /seek (professional )?advice/i,
  /complex (cases|situations)/i,
  /may (or may not|differ)/i,
  /discretionary/i,
];

export function decidePublication(args: {
  entry: WatchlistEntry;
  snap: PageSnapshot;
  previousHash?: string | null;
  previousVersionToken?: string | null;
  updates: ExtractedFactUpdate[];
  extractionErrors: string[];
  conflictingFactIds?: string[];
}): PublicationDecision {
  const {
    entry,
    snap,
    previousHash,
    previousVersionToken,
    updates,
    extractionErrors,
    conflictingFactIds = [],
  } = args;

  if (!snap.ok) {
    const withdrawn = snap.content_api?.withdrawn;
    return {
      action: withdrawn ? "quarantine" : "error",
      reason: snap.error || "Official source fetch/authenticity failed",
      affected_fact_ids: [...entry.linked_fact_ids],
      requires_accountant_review: Boolean(withdrawn),
    };
  }

  const unchanged =
    previousHash &&
    previousHash === snap.content_hash &&
    previousVersionToken &&
    previousVersionToken === snap.version_token;

  if (unchanged) {
    return { action: "unchanged", reason: "Content hash and version token unchanged" };
  }

  // First snapshot or change — attempt verified auto-publish.
  if (!snap.authenticity.host_ok || !snap.authenticity.publisher_markers_ok) {
    return {
      action: "quarantine",
      reason: "Official source authenticity checks failed",
      affected_fact_ids: [...entry.linked_fact_ids],
      requires_accountant_review: true,
    };
  }

  if (conflictingFactIds.length) {
    return {
      action: "quarantine",
      reason: `Unresolved authoritative contradiction for: ${conflictingFactIds.join(", ")}`,
      affected_fact_ids: [...new Set(conflictingFactIds)],
      updates,
      requires_accountant_review: true,
    };
  }

  if (extractionErrors.length && updates.length === 0) {
    return {
      action: "quarantine",
      reason: `Could not extract structured facts reliably: ${extractionErrors.join("; ")}`,
      affected_fact_ids: [...entry.linked_fact_ids],
      requires_accountant_review: entry.impact === "high",
    };
  }

  // Partial extraction: quarantine only failed linked facts; publish successful ones.
  const failedIds = extractionErrors
    .map((e) => {
      const m = e.match(/(mtd-threshold-[^\s]+|vat-[^\s]+|sa-[^\s]+|personal-[^\s]+|mtd-[^\s]+)/);
      return m?.[1];
    })
    .filter(Boolean) as string[];

  const uncertain = updates.filter(
    (u) =>
      u.confidence === "low" ||
      LEGAL_INTERPRETATION_MARKERS.some((re) => re.test(u.summary)),
  );
  if (uncertain.length) {
    return {
      action: "quarantine",
      reason:
        "Update appears to require uncertain legal interpretation or low-confidence extraction",
      affected_fact_ids: uncertain.map((u) => u.fact_id),
      updates,
      requires_accountant_review: true,
    };
  }

  const publishable = updates.filter((u) => u.confidence !== "low");
  if (!publishable.length) {
    return {
      action: "quarantine",
      reason: "No high/medium confidence structured updates available",
      affected_fact_ids: [...entry.linked_fact_ids],
      requires_accountant_review: true,
    };
  }

  // Strict validation for high-impact: require expected phrases + effective dates on numeric bands.
  if (entry.impact === "high") {
    if (!snap.authenticity.expected_phrases_ok) {
      return {
        action: "quarantine",
        reason: `High-impact validation failed — missing phrases: ${snap.authenticity.missing_phrases.join(", ")}`,
        affected_fact_ids: failedIds.length ? failedIds : [...entry.linked_fact_ids],
        updates: publishable,
        requires_accountant_review: true,
      };
    }
    const missingDates = publishable.filter(
      (u) =>
        (u.fact_id.includes("threshold") || u.fact_id.includes("deadline") || u.fact_id.includes("allowance")) &&
        !u.effective_date,
    );
    if (missingDates.length) {
      return {
        action: "quarantine",
        reason: `High-impact facts missing effective dates: ${missingDates.map((u) => u.fact_id).join(", ")}`,
        affected_fact_ids: missingDates.map((u) => u.fact_id),
        updates: publishable,
        requires_accountant_review: true,
      };
    }
  }

  // If some linked facts failed extraction, quarantine only those; still auto-publish the rest.
  if (failedIds.length) {
    // Caller should both auto-publish publishable and quarantine failedIds.
    // Represent as auto_publish with reason noting partial, and include failed in a synthetic way:
    // The service handles partial by publishing publishable then quarantining failedIds.
  }

  const impactLabel: ImpactLevel = entry.impact;
  return {
    action: "auto_publish",
    reason:
      `${impactLabel}-impact official change passed authenticity, structured extraction and validation` +
      (failedIds.length ? ` (partial; failed: ${failedIds.join(", ")})` : ""),
    updates: publishable,
  };
}

export function detectInternalConflicts(updates: ExtractedFactUpdate[]): string[] {
  const byId = new Map<string, ExtractedFactUpdate[]>();
  for (const u of updates) {
    const arr = byId.get(u.fact_id) || [];
    arr.push(u);
    byId.set(u.fact_id, arr);
  }
  const conflicts: string[] = [];
  for (const [id, arr] of byId) {
    if (arr.length < 2) continue;
    const summaries = new Set(arr.map((a) => a.summary));
    const dates = new Set(arr.map((a) => a.effective_date || ""));
    if (summaries.size > 1 || dates.size > 1) conflicts.push(id);
  }
  // Cross-check VAT 85 vs 90 style contradictions inside a single summary set
  for (const u of updates) {
    if (/85,?000/.test(u.summary) && /90,?000/.test(u.summary) && u.fact_id.includes("vat")) {
      // both present can be "outdated vs current" — OK if clearly marked; if not, conflict
      if (!/outdated|previous|was £85/.test(u.summary)) conflicts.push(u.fact_id);
    }
  }
  return [...new Set(conflicts)];
}
