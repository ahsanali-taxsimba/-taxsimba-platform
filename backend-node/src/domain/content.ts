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
  "Action Required",
  "Documents",
  "Self Assessment",
  "MTD",
  "Payments & services",
  "Support",
] as const;

/**
 * The allow-list. Keys are stable identifiers; the frontend keeps its own hard-coded strings
 * as the last-resort fallback, so adopting a key is an independent, optional change.
 */
export const CONTENT_DEFAULTS: Record<string, ContentDefault> = {
  // ---------------------------------------------------------------- packages
  // Package marketing copy does not exist in the current UI. The defaults are therefore empty:
  // nothing is rendered until a Super Admin writes copy, so adopting these keys cannot change
  // the current screens.
  "package.SIMPLE.description": { group: "Packages", label: "Simple \u2014 description", value: "" },
  "package.SIMPLE.features": { group: "Packages", label: "Simple \u2014 features", list: true, value: "" },
  "package.SMART.description": { group: "Packages", label: "Smart \u2014 description", value: "" },
  "package.SMART.features": { group: "Packages", label: "Smart \u2014 features", list: true, value: "" },
  "package.ELITE.description": { group: "Packages", label: "Elite \u2014 description", value: "" },
  "package.ELITE.features": { group: "Packages", label: "Elite \u2014 features", list: true, value: "" },
  "package.MTD_ESSENTIAL.description": {
    group: "Packages",
    label: "MTD Essential \u2014 description",
    value: "",
  },
  "package.MTD_ESSENTIAL.features": {
    group: "Packages",
    label: "MTD Essential \u2014 features",
    list: true,
    value: "",
  },
  "package.MTD_PLUS.description": { group: "Packages", label: "MTD Plus \u2014 description", value: "" },
  "package.MTD_PLUS.features": {
    group: "Packages",
    label: "MTD Plus \u2014 features",
    list: true,
    value: "",
  },
  // -------------------------------------------------------- client dashboard
  "client.dashboard.mtd_card.heading": {
    group: "Client dashboard",
    label: "MTD card heading",
    value: "Making Tax Digital for Income Tax",
  },
  "client.dashboard.mtd_card.body": {
    group: "Client dashboard",
    label: "MTD card text",
    value:
      "Your MTD service is active. Your quarterly updates and Final Declaration are in your MTD area.",
  },
  "client.dashboard.ready.heading": {
    group: "Client dashboard",
    label: "Ready to review heading",
    value: "Your tax return is ready to review",
  },
  "client.dashboard.ready.body": {
    group: "Client dashboard",
    label: "Ready to review text",
    value:
      "Your accountant has prepared your return and it has been approved by our internal review team. Please review it and approve when you're happy.",
  },
  "client.dashboard.submitted.heading": {
    group: "Client dashboard",
    label: "Submitted heading",
    value: "Your return has been submitted to HMRC",
  },
  "client.dashboard.submitted.body": {
    group: "Client dashboard",
    label: "Submitted text",
    value:
      "We've submitted your tax return and you'll find your submission reference and final documents on My Tax Return. There's nothing more for you to do.",
  },
  "client.dashboard.action_required.heading": {
    group: "Client dashboard",
    label: "Action required heading",
    value: "Action required",
  },
  "client.dashboard.action_required.body": {
    group: "Client dashboard",
    label: "Action required text",
    value:
      "We still need some information from you. Your accountant needs the following items before they can continue preparing your tax return.",
  },
  "client.dashboard.up_to_date.heading": {
    group: "Client dashboard",
    label: "Up to date heading",
    value: "You're all up to date",
  },
  "client.dashboard.up_to_date.body": {
    group: "Client dashboard",
    label: "Up to date text",
    value:
      "We have everything we need for now. Your accountant is reviewing your information and documents. We'll let you know if anything else is required.",
  },
  "client.dashboard.up_to_date.note": {
    group: "Client dashboard",
    label: "Up to date note",
    value: "No action required from you right now.",
  },
  // ---------------------------------------------------------- action required
  "client.actions.title": {
    group: "Action Required",
    label: "Page title",
    value: "Action Required",
  },
  "client.actions.subtitle": {
    group: "Action Required",
    label: "Page subtitle",
    value: "Everything waiting on you, across all your services.",
  },
  "client.actions.empty": {
    group: "Action Required",
    label: "Nothing outstanding",
    value: "Nothing needs your attention right now.",
  },
  // ---------------------------------------------------------------- documents
  "client.documents.title": { group: "Documents", label: "Page title", value: "Documents" },
  "client.documents.subtitle": {
    group: "Documents",
    label: "Page subtitle",
    value: "Requested items, your uploads and final documents.",
  },
  "client.documents.empty": {
    group: "Documents",
    label: "No documents yet",
    value: "Nothing here yet.",
  },
  // ------------------------------------------------- Self Assessment / approval
  "client.return.status.helper": {
    group: "Self Assessment",
    label: "Status helper text",
    value:
      "You review and approve your return. Your accountant then files it with HMRC and records the outcome here.",
  },
  "client.return.not_ready": {
    group: "Self Assessment",
    label: "Calculation not ready text",
    value:
      "Your tax return isn't ready to review yet. Once your accountant has prepared it and our internal review team has approved it, you'll be able to review and approve it here.",
  },
  "client.return.approve.helper": {
    group: "Self Assessment",
    label: "Approval helper text",
    value:
      "By approving, you confirm the information is complete and correct to the best of your knowledge.",
  },
  // --------------------------------------------------------------------- MTD
  "client.mtd.title": { group: "MTD", label: "Page title", value: "MTD for Income Tax" },
  "client.mtd.subtitle": {
    group: "MTD",
    label: "Page subtitle",
    value: "Your quarterly updates and Final Declaration.",
  },
  "client.mtd.intro.heading": {
    group: "MTD",
    label: "Service introduction heading",
    value: "Your Making Tax Digital service",
  },
  "client.mtd.intro.body": {
    group: "MTD",
    label: "Service introduction text",
    value:
      "We'll manage your quarterly MTD updates throughout the year. Your accountant will let you know whenever information or documents are required.",
  },
  "client.mtd.intro.reassurance": {
    group: "MTD",
    label: "Service introduction reassurance",
    value:
      "Your Making Tax Digital reporting starts from 6 April 2026. Your accountant will manage your quarterly updates for you.",
  },
  // ------------------------------------------------------- payments & services
  "client.services.additional_work.helper": {
    group: "Payments & services",
    label: "Additional work helper text",
    value:
      "Additional work has been identified outside your current package. Please review the details below.",
  },
  "client.services.offer.default_message": {
    group: "Payments & services",
    label: "Recommendation default message",
    value:
      "Your accountant believes this service is right for you. Our team has reviewed and approved this recommendation.",
  },
  // ----------------------------------------------------------------- support
  "client.help.title": { group: "Support", label: "Help Centre title", value: "Help Centre" },
  "client.help.subtitle": {
    group: "Support",
    label: "Help Centre subtitle",
    value: "How can we help?",
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
