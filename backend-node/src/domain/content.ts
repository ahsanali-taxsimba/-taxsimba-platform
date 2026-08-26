/**
 * Configurable customer-facing wording.
 *
 * Only the keys defined in `CONTENT_DEFAULTS` can ever be overridden: business copy such as
 * package marketing text, client-facing headings, helper text and explanatory paragraphs.
 * Security messages, validation errors, workflow/state identifiers, API field names and role
 * rules are deliberately absent from the allow-list and therefore not editable at runtime.
 *
 * The code default is always the fallback, so a missing, deleted or rolled-back override can
 * never leave a screen blank.
 */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

export interface ContentDefault {
  group: string;
  label: string;
  value: string;
  /** Rendered as a list of lines by the consumer (features, bullet points). */
  list?: boolean;
}

export const CONTENT_GROUPS = [
  "Packages",
  "Client dashboard",
  "Documents",
  "Calculation & approval",
  "MTD",
  "Payments",
  "Support",
] as const;

/**
 * The allow-list. Keys are stable identifiers; the frontend keeps its own hard-coded strings
 * as the last-resort fallback, so adopting a key is an independent, optional change.
 */
export const CONTENT_DEFAULTS: Record<string, ContentDefault> = {
  // ---------------------------------------------------------------- packages
  "package.SIMPLE.description": {
    group: "Packages",
    label: "Simple — description",
    value:
      "A straightforward Self Assessment for employed and simple self-employed income, prepared and checked by a qualified accountant.",
  },
  "package.SIMPLE.features": {
    group: "Packages",
    label: "Simple — features",
    list: true,
    value: [
      "Self Assessment prepared by an accountant",
      "Secure document upload",
      "Review and approval before submission",
      "Email and in-app updates",
    ].join("\n"),
  },
  "package.SMART.description": {
    group: "Packages",
    label: "Smart — description",
    value:
      "For clients with several income sources who want their allowances and expenses reviewed in detail before filing.",
  },
  "package.SMART.features": {
    group: "Packages",
    label: "Smart — features",
    list: true,
    value: [
      "Everything in Simple",
      "Multiple income sources reviewed",
      "Expenses and allowances check",
      "Priority accountant messaging",
    ].join("\n"),
  },
  "package.ELITE.description": {
    group: "Packages",
    label: "Elite — description",
    value:
      "Our most thorough Self Assessment service, including planning conversations and a full review of your position for the year.",
  },
  "package.ELITE.features": {
    group: "Packages",
    label: "Elite — features",
    list: true,
    value: [
      "Everything in Smart",
      "Full review of your tax position",
      "Tax planning conversation",
      "Priority turnaround",
    ].join("\n"),
  },
  "package.MTD_ESSENTIAL.description": {
    group: "Packages",
    label: "MTD Essential — description",
    value:
      "Quarterly Making Tax Digital for Income Tax support, covering your four quarterly updates and your Final Declaration.",
  },
  "package.MTD_ESSENTIAL.features": {
    group: "Packages",
    label: "MTD Essential — features",
    list: true,
    value: [
      "Four quarterly updates prepared",
      "Final Declaration prepared",
      "Deadline reminders",
      "Secure document upload",
    ].join("\n"),
  },
  "package.MTD_PLUS.description": {
    group: "Packages",
    label: "MTD Plus — description",
    value:
      "Making Tax Digital support with a closer review of each quarter and ongoing help with your record keeping.",
  },
  "package.MTD_PLUS.features": {
    group: "Packages",
    label: "MTD Plus — features",
    list: true,
    value: [
      "Everything in MTD Essential",
      "Detailed quarterly review",
      "Bookkeeping guidance",
      "Priority accountant messaging",
    ].join("\n"),
  },
  // -------------------------------------------------------- client dashboard
  "client.dashboard.heading": {
    group: "Client dashboard",
    label: "Dashboard heading",
    value: "Your tax overview",
  },
  "client.dashboard.intro": {
    group: "Client dashboard",
    label: "Dashboard introduction",
    value:
      "Everything your accountant needs from you appears here. We will tell you the moment something needs your attention.",
  },
  "client.actions.heading": {
    group: "Client dashboard",
    label: "Action Required heading",
    value: "Action required",
  },
  "client.actions.empty": {
    group: "Client dashboard",
    label: "Action Required — nothing outstanding",
    value: "Nothing needs your attention right now. We will let you know when it does.",
  },
  "client.actions.helper": {
    group: "Client dashboard",
    label: "Action Required helper text",
    value: "Complete these items so your accountant can carry on with your return.",
  },
  // ---------------------------------------------------------------- documents
  "documents.upload.heading": {
    group: "Documents",
    label: "Upload heading",
    value: "Upload a document",
  },
  "documents.upload.helper": {
    group: "Documents",
    label: "Upload helper text",
    value:
      "Photos and scans are fine as long as the whole page is readable. Uploading against a request marks it as done automatically.",
  },
  "documents.empty": {
    group: "Documents",
    label: "No documents yet",
    value: "You have not uploaded any documents yet.",
  },
  // ----------------------------------------------------- calculation/approval
  "calculation.ready.heading": {
    group: "Calculation & approval",
    label: "Calculation ready heading",
    value: "Your calculation is ready to review",
  },
  "calculation.ready.helper": {
    group: "Calculation & approval",
    label: "Calculation ready helper text",
    value:
      "Please read the figures carefully. Once you approve them, your accountant will file on your behalf.",
  },
  "approval.confirmation": {
    group: "Calculation & approval",
    label: "Approval confirmation wording",
    value: "Thank you — your approval has been recorded and your accountant has been notified.",
  },
  // --------------------------------------------------------------------- MTD
  "mtd.overview.heading": {
    group: "MTD",
    label: "MTD overview heading",
    value: "Making Tax Digital for Income Tax",
  },
  "mtd.overview.intro": {
    group: "MTD",
    label: "MTD overview introduction",
    value:
      "You have four quarterly updates and a Final Declaration each year. We will prepare each one and ask you to approve it before anything is filed.",
  },
  "mtd.quarter.helper": {
    group: "MTD",
    label: "Quarter helper text",
    value: "Send us your figures and records for the quarter and we will do the rest.",
  },
  // ---------------------------------------------------------------- payments
  "payments.additional_work.helper": {
    group: "Payments",
    label: "Additional work helper text",
    value:
      "Additional work is anything outside your package. Your accountant will always explain it and agree the amount with you before it is charged.",
  },
  "payments.receipt.footer": {
    group: "Payments",
    label: "Receipt footer note",
    value: "Thank you for your payment. Please keep this receipt for your records.",
  },
  // ----------------------------------------------------------------- support
  "support.contact": {
    group: "Support",
    label: "Support contact line",
    value: "Need help? Message your accountant in the app and we will come straight back to you.",
  },
  "support.response_time": {
    group: "Support",
    label: "Expected response time",
    value: "We usually reply the same working day.",
  },
};

export const MAX_CONTENT_LENGTH = 4000;

export async function ensureContentIndexes(): Promise<void> {
  await col("content_strings").createIndex({ key: 1 }, { unique: true });
  await col("content_audit").createIndex({ key: 1, created_at: -1 });
}

export function isEditableKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONTENT_DEFAULTS, key);
}

/** Plain business copy only: no markup, no scripting, no unbounded text. */
export function validateContentValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Content value cannot be empty");
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Content value cannot exceed ${MAX_CONTENT_LENGTH} characters`);
  }
  if (/<\s*\/?\s*[a-z]/i.test(trimmed) || /javascript:/i.test(trimmed)) {
    throw new Error("Content value must be plain text");
  }
  return trimmed;
}

async function overrides(): Promise<Record<string, string>> {
  const rows = (await col("content_strings").find({}).limit(500).toArray()) as Doc[];
  const map: Record<string, string> = {};
  for (const row of rows) {
    const key = String(row.key);
    // A blank stored value is treated as absent, so a screen can never render empty.
    if (isEditableKey(key) && typeof row.value === "string" && row.value.trim()) {
      map[key] = row.value;
    }
  }
  return map;
}

/** Every allow-listed key with its effective value — defaults merged with overrides. */
export async function contentMap(): Promise<Record<string, string>> {
  const saved = await overrides();
  const out: Record<string, string> = {};
  for (const [key, def] of Object.entries(CONTENT_DEFAULTS)) out[key] = saved[key] ?? def.value;
  return out;
}

export interface ContentEntry {
  key: string;
  group: string;
  label: string;
  value: string;
  default_value: string;
  is_overridden: boolean;
  is_list: boolean;
}

export async function contentEntries(): Promise<ContentEntry[]> {
  const saved = await overrides();
  return Object.entries(CONTENT_DEFAULTS).map(([key, def]) => ({
    key,
    group: def.group,
    label: def.label,
    value: saved[key] ?? def.value,
    default_value: def.value,
    is_overridden: key in saved,
    is_list: Boolean(def.list),
  }));
}

export async function contentValue(key: string): Promise<string> {
  const def = CONTENT_DEFAULTS[key];
  if (!def) throw new Error(`Unknown content key '${key}'`);
  const row = (await col("content_strings").findOne({ key })) as Doc | null;
  return typeof row?.value === "string" && row.value.trim() ? row.value : def.value;
}

export type ContentActor = Doc;

async function auditContent(
  key: string,
  previous: string,
  next: string,
  actor: ContentActor,
): Promise<void> {
  await col("content_audit").insertOne({
    id: randomUUID(),
    key,
    previous_value: previous,
    new_value: next,
    changed_by: String(actor.name),
    role: String(actor.role),
    created_at: nowIso(),
  });
}

export async function setContent(
  key: string,
  value: string,
  actor: ContentActor,
): Promise<string> {
  const clean = validateContentValue(value);
  const previous = await contentValue(key);
  await col("content_strings").updateOne(
    { key },
    {
      $set: { value: clean, updated_by: String(actor.name), updated_at: nowIso() },
      $setOnInsert: { id: randomUUID(), key, created_at: nowIso() },
    },
    { upsert: true },
  );
  await auditContent(key, previous, clean, actor);
  return clean;
}

/** Remove an override so the code default applies again. */
export async function resetContent(key: string, actor: ContentActor): Promise<string> {
  const previous = await contentValue(key);
  const fallback = CONTENT_DEFAULTS[key].value;
  await col("content_strings").deleteOne({ key });
  if (previous !== fallback) await auditContent(key, previous, fallback, actor);
  return fallback;
}

export async function contentHistory(key: string): Promise<Doc[]> {
  return (await col("content_audit")
    .find({ key })
    .sort({ created_at: -1 })
    .limit(200)
    .toArray()) as Doc[];
}
