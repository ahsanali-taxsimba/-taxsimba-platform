/**
 * Centralised Email Template Library — Taxsimba Group Ltd.
 *
 * Staff (Admin / Accountant) select a template, fill merge tokens, preview, and send.
 * Templates are seeded as read-only for accountants; admins may edit active copy.
 *
 * Merge tokens use square-bracket placeholders, e.g. [Client Name].
 */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

export const EMAIL_TEMPLATE_COLLECTION = "email_templates";
export const EMAIL_TEMPLATE_SEND_LOG = "email_template_send_log";

export const EMAIL_TEMPLATE_CATEGORIES = ["admin", "accountant"] as const;
export type EmailTemplateCategory = (typeof EMAIL_TEMPLATE_CATEGORIES)[number];

export const MERGE_TOKENS = [
  "[Client Name]",
  "[Appointment Date]",
  "[Appointment Time]",
  "[Staff Name]",
  "[Missing Item 1]",
  "[Missing Item 2]",
] as const;

export interface EmailTemplate {
  id: string;
  title: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  /** Stable seed key so restarts do not duplicate catalogue rows. */
  seed_key: string;
}

const FIRM = "Taxsimba Group Ltd";

/** Catalogue seeded once per environment. */
export const EMAIL_TEMPLATE_SEEDS: Omit<EmailTemplate, "id" | "created_at" | "updated_at">[] = [
  {
    seed_key: "admin.document_request",
    title: "Document Request – Admin Team (Taxsimba Group Ltd)",
    category: "admin",
    subject: `Documents required — ${FIRM}`,
    body: [
      "Dear [Client Name],",
      "",
      `Thank you for choosing ${FIRM}.`,
      "",
      "Our Admin Team is preparing your file and we need a few documents from you to proceed.",
      "Please upload the requested items via your secure client portal at your earliest convenience.",
      "",
      "If you are unsure what is needed, reply to this email or message us in the portal and we will guide you.",
      "",
      "Kind regards,",
      "[Staff Name]",
      `Admin Team · ${FIRM}`,
    ].join("\n"),
    is_active: true,
  },
  {
    seed_key: "admin.appointment_confirmation",
    title: "Appointment Confirmation – Admin Team (Taxsimba Group Ltd)",
    category: "admin",
    subject: `Appointment confirmed — ${FIRM}`,
    body: [
      "Dear [Client Name],",
      "",
      `This email confirms your appointment with ${FIRM}.`,
      "",
      "Date: [Appointment Date]",
      "Time: [Appointment Time]",
      "",
      "If you need to reschedule, please contact us as soon as possible so we can rearrange.",
      "",
      "We look forward to speaking with you.",
      "",
      "Kind regards,",
      "[Staff Name]",
      `Admin Team · ${FIRM}`,
    ].join("\n"),
    is_active: true,
  },
  {
    seed_key: "admin.welcome_onboard",
    title: "Welcome Onboard – Admin Team (Taxsimba Group Ltd)",
    category: "admin",
    subject: `Welcome to ${FIRM}`,
    body: [
      "Dear [Client Name],",
      "",
      `Welcome to ${FIRM}. We are delighted to have you as a client.`,
      "",
      "Your secure client portal is ready. From there you can upload documents, track your tax journey, message your accountant, and complete any outstanding tasks.",
      "",
      "Our Admin Team is here if you need help getting started. Simply reply to this email or use the portal Help Centre.",
      "",
      "Kind regards,",
      "[Staff Name]",
      `Admin Team · ${FIRM}`,
    ].join("\n"),
    is_active: true,
  },
  {
    seed_key: "accountant.tax_return_info_request",
    title: "Tax Return Information Request – Accountant (Taxsimba Group Ltd)",
    category: "accountant",
    subject: `Information needed for your tax return — ${FIRM}`,
    body: [
      "Dear [Client Name],",
      "",
      `I am preparing your tax return and need some additional information to complete the figures accurately.`,
      "",
      "Please provide the following via your client portal:",
      "• [Missing Item 1]",
      "• [Missing Item 2]",
      "",
      "Once we have these, we can continue preparation without delay.",
      "",
      "Kind regards,",
      "[Staff Name]",
      `Accountant · ${FIRM}`,
    ].join("\n"),
    is_active: true,
  },
  {
    seed_key: "accountant.tax_return_ready_review",
    title: "Tax Return Ready for Review – Accountant (Taxsimba Group Ltd)",
    category: "accountant",
    subject: `Your tax return is ready for review — ${FIRM}`,
    body: [
      "Dear [Client Name],",
      "",
      "Your tax return is ready for your review and approval.",
      "",
      "Please sign in to your client portal to review the summary figures and approve so we can proceed with submission to HMRC.",
      "",
      "If anything looks incorrect, message me in the portal and I will amend the return before filing.",
      "",
      "Kind regards,",
      "[Staff Name]",
      `Accountant · ${FIRM}`,
    ].join("\n"),
    is_active: true,
  },
  {
    seed_key: "accountant.missing_information_reminder",
    title: "Missing Information Reminder – Accountant (Taxsimba Group Ltd)",
    category: "accountant",
    subject: `Reminder: information still needed — ${FIRM}`,
    body: [
      "Dear [Client Name],",
      "",
      "This is a gentle reminder that we are still waiting for the following information to complete your tax return:",
      "",
      "• [Missing Item 1]",
      "• [Missing Item 2]",
      "",
      "Please upload these documents or details via your portal when you can. If you need more time or an alternative arrangement, let me know.",
      "",
      "Kind regards,",
      "[Staff Name]",
      `Accountant · ${FIRM}`,
    ].join("\n"),
    is_active: true,
  },
];

export function applyMergeTokens(text: string, values: Record<string, string>): string {
  let out = text;
  for (const [token, value] of Object.entries(values)) {
    const key = token.startsWith("[") ? token : `[${token}]`;
    out = out.split(key).join(value ?? "");
  }
  return out;
}

export async function ensureEmailTemplateIndexes(): Promise<void> {
  try {
    await col(EMAIL_TEMPLATE_COLLECTION).createIndex({ seed_key: 1 }, { unique: true });
    await col(EMAIL_TEMPLATE_COLLECTION).createIndex({ category: 1, is_active: 1 });
    await col(EMAIL_TEMPLATE_SEND_LOG).createIndex({ created_at: -1 });
    await col(EMAIL_TEMPLATE_SEND_LOG).createIndex({ client_user_id: 1, created_at: -1 });
    await col(EMAIL_TEMPLATE_SEND_LOG).createIndex({ template_id: 1, created_at: -1 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`email template indexes skipped: ${String(e)}`);
  }
}

/** Idempotent seed of Taxsimba Group Ltd catalogue. */
export async function ensureEmailTemplates(): Promise<void> {
  const now = nowIso();
  for (const seed of EMAIL_TEMPLATE_SEEDS) {
    const existing = await col(EMAIL_TEMPLATE_COLLECTION).findOne({ seed_key: seed.seed_key });
    if (existing) continue;
    await col(EMAIL_TEMPLATE_COLLECTION).insertOne({
      id: randomUUID(),
      ...seed,
      created_at: now,
      updated_at: now,
    });
  }
}

export { nowIso, randomUUID };
export type { Doc };
