/** Structured fact extraction from official GOV.UK / HMRC text. */

import type { KnowledgeFact } from "../../models/schemas.js";
import type { ExtractedFactUpdate, PageSnapshot, WatchlistEntry } from "./types.js";

function pubDate(snap: PageSnapshot): string | null {
  return (
    snap.content_api?.public_updated_at?.slice(0, 10) ||
    snap.content_api?.first_published_at?.slice(0, 10) ||
    null
  );
}

function baselineMap(facts: KnowledgeFact[]): Map<string, KnowledgeFact> {
  return new Map(facts.map((f) => [f.id, f]));
}

export function extractFactUpdates(
  entry: WatchlistEntry,
  snap: PageSnapshot,
  baselineFacts: KnowledgeFact[],
): { updates: ExtractedFactUpdate[]; errors: string[] } {
  const text = `${snap.title}\n${snap.text_excerpt}\n`; // excerpt alone too short — callers pass full text via snap
  // Prefer full text from a side channel: we stash it on text_excerpt for short pages;
  // for extraction we require the monitor to pass full text in a dedicated field.
  // Use text_excerpt + authenticity path; service will set snap with full text in text_excerpt for fixtures,
  // and for live Content API we extend by reading a hidden property.
  const fullText =
    (snap as PageSnapshot & { full_text?: string }).full_text ||
    snap.text_excerpt;
  const base = baselineMap(baselineFacts);
  const publication_date = pubDate(snap);
  const extractor = entry.extractor || "generic_phrases";

  switch (extractor) {
    case "mtd_thresholds":
      return extractMtdThresholds(entry, snap, fullText, base, publication_date);
    case "mtd_qualifying_income":
      return extractQualifyingIncome(entry, snap, fullText, base, publication_date);
    case "vat_threshold":
      return extractVat(entry, snap, fullText, base, publication_date);
    case "sa_deadlines":
      return extractSaDeadlines(entry, snap, fullText, base, publication_date);
    case "personal_allowance":
      return extractPersonalAllowance(entry, snap, fullText, base, publication_date);
    default:
      return extractGeneric(entry, snap, fullText, base, publication_date);
  }
}

function extractMtdThresholds(
  entry: WatchlistEntry,
  snap: PageSnapshot,
  text: string,
  base: Map<string, KnowledgeFact>,
  publication_date: string | null,
): { updates: ExtractedFactUpdate[]; errors: string[] } {
  const errors: string[] = [];
  const bands = [
    {
      fact_id: "mtd-threshold-50k-april-2026",
      amount: "50,000",
      start: "6 April 2026",
      effective_date: "2026-04-06",
      tax_years: ["2025-26", "2026-27", "2027-28"],
      condition: "qualifying income more than £50,000 for 2024-25",
    },
    {
      fact_id: "mtd-threshold-30k-april-2027",
      amount: "30,000",
      start: "6 April 2027",
      effective_date: "2027-04-06",
      tax_years: ["2025-26", "2026-27", "2027-28"],
      condition: "qualifying income more than £30,000 for 2025-26",
    },
    {
      fact_id: "mtd-threshold-20k-april-2028",
      amount: "20,000",
      start: "6 April 2028",
      effective_date: "2028-04-06",
      tax_years: ["2026-27", "2027-28"],
      condition: "qualifying income more than £20,000 for 2026-27",
    },
  ];

  const updates: ExtractedFactUpdate[] = [];
  const hasWho = /sole trader|landlord|making tax digital for income tax/i.test(text);

  for (const band of bands) {
    const amountOk =
      text.includes(`£${band.amount}`) || text.replace(/,/g, "").includes(band.amount.replace(/,/g, ""));
    const startOk = text.includes(band.start) || text.includes(band.effective_date);
    if (!amountOk || !startOk) {
      errors.push(`Could not reliably extract ${band.fact_id} (${band.amount} / ${band.start})`);
      continue;
    }
    const prev = base.get(band.fact_id);
    const summary =
      `If your qualifying income was more than £${band.amount} for the relevant prior tax year, ` +
      `you need to use Making Tax Digital for Income Tax from ${band.start}. ` +
      `Qualifying income is turnover/gross self-employment and property income before expenses, not profit. ` +
      `Condition: ${band.condition}. Always confirm on GOV.UK.`;
    updates.push({
      fact_id: band.fact_id,
      source_url: entry.url,
      tax_years: band.tax_years,
      effective_date: band.effective_date,
      publication_date,
      applicable_conditions: band.condition,
      summary,
      title: prev?.title,
      superseded_summary: prev?.summary || null,
      confidence: "high",
      validation_notes: [
        `Matched £${band.amount} and ${band.start} in official text`,
        `version_token=${snap.version_token}`,
      ],
    });
  }

  if (hasWho && base.has("mtd-who-and-when")) {
    const prev = base.get("mtd-who-and-when")!;
    updates.push({
      fact_id: "mtd-who-and-when",
      source_url: entry.url,
      tax_years: [...prev.tax_years],
      effective_date: "2026-04-06",
      publication_date,
      applicable_conditions:
        "sole trader or landlord registered for Self Assessment with qualifying income above the relevant threshold",
      summary: prev.summary,
      title: prev.title,
      superseded_summary: prev.summary,
      confidence: "high",
      validation_notes: ["Who/when overview confirmed present in official guidance"],
    });
  }

  return { updates, errors };
}

function extractQualifyingIncome(
  entry: WatchlistEntry,
  snap: PageSnapshot,
  text: string,
  base: Map<string, KnowledgeFact>,
  publication_date: string | null,
): { updates: ExtractedFactUpdate[]; errors: string[] } {
  const errors: string[] = [];
  const before = /before expenses|turnover|gross/i.test(text);
  const notProfit = /not (the same as )?profit|before expenses/i.test(text);
  if (!before) {
    errors.push("Could not confirm qualifying income is before expenses / turnover");
    return { updates: [], errors };
  }
  const prev = base.get("mtd-qualifying-income-definition");
  if (!prev) {
    errors.push("Baseline fact mtd-qualifying-income-definition missing");
    return { updates: [], errors };
  }
  return {
    updates: [
      {
        fact_id: prev.id,
        source_url: entry.url,
        tax_years: [...prev.tax_years],
        effective_date: prev.effective_date || "2026-04-06",
        publication_date,
        applicable_conditions:
          "Self-employment and property income; PAYE/dividends/pensions excluded",
        summary: prev.summary,
        title: prev.title,
        superseded_summary: prev.summary,
        confidence: notProfit ? "high" : "medium",
        validation_notes: [`version_token=${snap.version_token}`],
      },
    ],
    errors,
  };
}

function extractVat(
  entry: WatchlistEntry,
  snap: PageSnapshot,
  text: string,
  base: Map<string, KnowledgeFact>,
  publication_date: string | null,
): { updates: ExtractedFactUpdate[]; errors: string[] } {
  const errors: string[] = [];
  const has90 = /£\s*90,?000|90000/.test(text.replace(/,/g, ""));
  const has85 = /£\s*85,?000|85000/.test(text.replace(/,/g, ""));
  if (has85 && !has90) {
    errors.push("Official text still references outdated £85,000 without £90,000");
    return { updates: [], errors };
  }
  if (!has90) {
    errors.push("Could not extract VAT threshold £90,000");
    return { updates: [], errors };
  }
  const updates: ExtractedFactUpdate[] = [];
  for (const id of ["vat-threshold-overview", "vat-registration-timing-tests"]) {
    const prev = base.get(id);
    if (!prev) continue;
    updates.push({
      fact_id: id,
      source_url: entry.url,
      tax_years: [...prev.tax_years],
      effective_date: prev.effective_date || "2024-04-01",
      publication_date,
      applicable_conditions: "VAT taxable turnover registration tests",
      summary: prev.summary.includes("90,000")
        ? prev.summary
        : prev.summary.replace(/£85,000/g, "£90,000"),
      title: prev.title,
      superseded_summary: prev.summary,
      confidence: "high",
      validation_notes: ["Matched £90,000 VAT threshold in official text"],
    });
  }
  return { updates, errors };
}

function extractSaDeadlines(
  entry: WatchlistEntry,
  snap: PageSnapshot,
  text: string,
  base: Map<string, KnowledgeFact>,
  publication_date: string | null,
): { updates: ExtractedFactUpdate[]; errors: string[] } {
  const errors: string[] = [];
  const online = /31 January/i.test(text);
  const paper = /31 October/i.test(text);
  if (!online) errors.push("Missing 31 January online deadline");
  if (!paper) errors.push("Missing 31 October paper deadline");
  const updates: ExtractedFactUpdate[] = [];
  if (online && base.has("sa-deadline-online")) {
    const prev = base.get("sa-deadline-online")!;
    updates.push({
      fact_id: prev.id,
      source_url: entry.url,
      tax_years: [...prev.tax_years],
      // Recurring annual deadline — tax-year start is the effective rule anchor
      effective_date: prev.effective_date || "2025-04-06",
      publication_date,
      applicable_conditions: "Online Self Assessment filing",
      summary: prev.summary,
      title: prev.title,
      superseded_summary: prev.summary,
      confidence: "high",
      validation_notes: ["Matched 31 January online deadline"],
    });
  }
  if (paper && base.has("sa-paper-deadline")) {
    const prev = base.get("sa-paper-deadline")!;
    updates.push({
      fact_id: prev.id,
      source_url: entry.url,
      tax_years: [...prev.tax_years],
      effective_date: prev.effective_date || "2025-04-06",
      publication_date,
      applicable_conditions: "Paper Self Assessment filing",
      summary: prev.summary,
      title: prev.title,
      superseded_summary: prev.summary,
      confidence: "high",
      validation_notes: ["Matched 31 October paper deadline"],
    });
  }
  return { updates, errors };
}

function extractPersonalAllowance(
  entry: WatchlistEntry,
  snap: PageSnapshot,
  text: string,
  base: Map<string, KnowledgeFact>,
  publication_date: string | null,
): { updates: ExtractedFactUpdate[]; errors: string[] } {
  const errors: string[] = [];
  if (!/£\s*12,?570|12570/.test(text.replace(/,/g, ""))) {
    errors.push("Could not extract Personal Allowance £12,570");
    return { updates: [], errors };
  }
  const prev = base.get("personal-allowance-2025-26");
  if (!prev) {
    errors.push("Baseline personal-allowance-2025-26 missing");
    return { updates: [], errors };
  }
  return {
    updates: [
      {
        fact_id: prev.id,
        source_url: entry.url,
        tax_years: [...prev.tax_years],
        effective_date: prev.effective_date || "2025-04-06",
        publication_date,
        applicable_conditions: "Standard Personal Allowance for 2025-26 (confirm taper rules separately)",
        summary: prev.summary,
        title: prev.title,
        superseded_summary: prev.summary,
        confidence: "high",
        validation_notes: ["Matched £12,570 Personal Allowance"],
      },
    ],
    errors,
  };
}

function extractGeneric(
  entry: WatchlistEntry,
  snap: PageSnapshot,
  _text: string,
  base: Map<string, KnowledgeFact>,
  publication_date: string | null,
): { updates: ExtractedFactUpdate[]; errors: string[] } {
  const updates: ExtractedFactUpdate[] = [];
  for (const id of entry.linked_fact_ids) {
    const prev = base.get(id);
    if (!prev) continue;
    updates.push({
      fact_id: id,
      source_url: entry.url,
      tax_years: [...prev.tax_years],
      effective_date: prev.effective_date || null,
      publication_date,
      applicable_conditions: null,
      summary: prev.summary,
      title: prev.title,
      superseded_summary: prev.summary,
      confidence: "medium",
      validation_notes: [`Generic refresh from ${snap.source_mode}`],
    });
  }
  return { updates, errors: [] };
}
