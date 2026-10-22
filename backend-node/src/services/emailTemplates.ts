/**
 * Email Template Library — list, preview, send, admin edit, send audit log.
 */
import { randomUUID } from "crypto";

import {
  EMAIL_TEMPLATE_COLLECTION,
  EMAIL_TEMPLATE_SEND_LOG,
  EmailTemplateCategory,
  MERGE_TOKENS,
  applyMergeTokens,
  nowIso,
} from "../domain/emailTemplates";
import { getCase } from "../domain/cases";
import { notify } from "../domain/workflow";
import { clean, cleanMany, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { queueEmail } from "./email";

const STAFF = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"];

function assertStaff(actor: Doc): void {
  if (!STAFF.includes(actor.role)) {
    throw httpError(403, "Email templates are only available to accountants and admins");
  }
}

function assertAdmin(actor: Doc): void {
  if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    throw httpError(403, "Only admins can edit email templates");
  }
}

export function normalizeMergeValues(
  raw: Record<string, string | null | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of MERGE_TOKENS) {
    const bare = token.replace(/^\[|\]$/g, "");
    const v = raw?.[token] ?? raw?.[bare] ?? "";
    out[token] = String(v ?? "").trim();
  }
  return out;
}

export async function listEmailTemplates(
  actor: Doc,
  filters: { category?: string; active_only?: boolean } = {},
): Promise<Doc[]> {
  assertStaff(actor);
  const q: Doc = {};
  if (filters.category) {
    if (!["admin", "accountant"].includes(filters.category)) {
      throw httpError(400, "category must be admin or accountant");
    }
    // Accountants may browse accountant templates; admins see both (or filtered).
    if (actor.role === "ACCOUNTANT" && filters.category === "admin") {
      throw httpError(403, "Accountants cannot access admin email templates");
    }
    q.category = filters.category;
  } else if (actor.role === "ACCOUNTANT") {
    q.category = "accountant";
  }
  if (filters.active_only !== false) q.is_active = true;
  return cleanMany(
    await col(EMAIL_TEMPLATE_COLLECTION).find(q).sort({ category: 1, title: 1 }).toArray(),
  );
}

export async function getEmailTemplate(id: string, actor: Doc): Promise<Doc> {
  assertStaff(actor);
  const row = (await col(EMAIL_TEMPLATE_COLLECTION).findOne({ id })) as Doc | null;
  if (!row || row.is_active === false) throw httpError(404, "Email template not found");
  if (actor.role === "ACCOUNTANT" && row.category !== "accountant") {
    throw httpError(403, "Accountants cannot access admin email templates");
  }
  return clean(row) as Doc;
}

/** Prefill merge tokens from client / case / staff context. */
export async function suggestMergeValues(params: {
  actor: Doc;
  client_user_id?: string | null;
  client_id?: string | null;
  case_id?: string | null;
}): Promise<Record<string, string>> {
  assertStaff(params.actor);
  let client: Doc | null = null;
  let user: Doc | null = null;
  let kase: Doc | null = null;

  if (params.case_id) {
    kase = await getCase(params.case_id, params.actor);
  }
  if (params.client_id) {
    client = (await col("clients").findOne({ id: params.client_id })) as Doc | null;
  } else if (kase?.client_id) {
    client = (await col("clients").findOne({ id: kase.client_id })) as Doc | null;
  }
  const userId = params.client_user_id || client?.user_id || kase?.client_user_id;
  if (userId) {
    user = (await col("users").findOne({ id: userId })) as Doc | null;
  }

  return normalizeMergeValues({
    "[Client Name]": (client?.name as string) || (user?.name as string) || (kase?.client_name as string) || "",
    "[Staff Name]": params.actor.name || "",
    "[Appointment Date]": "",
    "[Appointment Time]": "",
    "[Missing Item 1]": "",
    "[Missing Item 2]": "",
  });
}

export function previewTemplate(
  template: Doc,
  merge: Record<string, string>,
): { subject: string; body: string } {
  const values = normalizeMergeValues(merge);
  return {
    subject: applyMergeTokens(String(template.subject || ""), values),
    body: applyMergeTokens(String(template.body || ""), values),
  };
}

export async function sendTemplateEmail(params: {
  actor: Doc;
  template_id: string;
  client_user_id: string;
  case_id?: string | null;
  merge_values?: Record<string, string>;
  /** Optional override after preview — still logged against the template. */
  subject_override?: string | null;
  body_override?: string | null;
}): Promise<Doc> {
  assertStaff(params.actor);
  const template = await getEmailTemplate(params.template_id, params.actor);

  const user = (await col("users").findOne({ id: params.client_user_id })) as Doc | null;
  if (!user || user.role !== "CLIENT") throw httpError(404, "Client user not found");
  if (!user.email) throw httpError(400, "Client has no email address on file");

  if (params.case_id) {
    const kase = await getCase(params.case_id, params.actor);
    if (kase.client_user_id !== params.client_user_id) {
      throw httpError(400, "Client does not belong to this case");
    }
  } else if (params.actor.role === "ACCOUNTANT") {
    // Accountants must have at least one assigned case for the client.
    const linked = await col("cases").findOne({
      client_user_id: params.client_user_id,
      assigned_accountant_id: params.actor.id,
    });
    if (!linked) throw httpError(403, "Not assigned to this client");
  }

  const suggested = await suggestMergeValues({
    actor: params.actor,
    client_user_id: params.client_user_id,
    case_id: params.case_id,
  });
  const merge = normalizeMergeValues({ ...suggested, ...(params.merge_values || {}) });
  const rendered = previewTemplate(template, merge);
  const subject = (params.subject_override?.trim() || rendered.subject).trim();
  const body = (params.body_override?.trim() || rendered.body).trim();
  if (!subject || !body) throw httpError(400, "Subject and body are required");

  const emailId = await queueEmail({
    to: user.email,
    recipientName: user.name,
    kind: `TEMPLATE_${template.seed_key || template.id}`,
    title: subject,
    body,
    link: "/messages",
    callToAction: "Open client portal",
    dedupeKey: `email-template:${template.id}:${params.client_user_id}:${randomUUID()}`,
    userId: user.id,
    caseId: params.case_id ?? null,
  });

  await notify(
    user.id,
    subject,
    body.slice(0, 280),
    params.case_id ?? null,
    "/messages",
    "MESSAGE",
  );

  const logId = randomUUID();
  const now = nowIso();
  const log: Doc = {
    id: logId,
    template_id: template.id,
    template_title: template.title,
    template_category: template.category,
    seed_key: template.seed_key ?? null,
    sender_id: params.actor.id,
    sender_name: params.actor.name,
    sender_role: params.actor.role,
    client_user_id: user.id,
    client_name: user.name,
    client_email: user.email,
    case_id: params.case_id ?? null,
    subject,
    body,
    merge_values: merge,
    email_message_id: emailId,
    created_at: now,
  };
  await col(EMAIL_TEMPLATE_SEND_LOG).insertOne({ ...log });

  return { ok: true, send_log_id: logId, email_message_id: emailId, subject, preview_body: body };
}

export async function updateEmailTemplate(
  actor: Doc,
  id: string,
  patch: { title?: string; subject?: string; body?: string; is_active?: boolean },
): Promise<Doc> {
  assertAdmin(actor);
  const row = (await col(EMAIL_TEMPLATE_COLLECTION).findOne({ id })) as Doc | null;
  if (!row) throw httpError(404, "Email template not found");
  const set: Doc = { updated_at: nowIso() };
  if (patch.title !== undefined) set.title = patch.title.trim();
  if (patch.subject !== undefined) set.subject = patch.subject.trim();
  if (patch.body !== undefined) set.body = patch.body;
  if (patch.is_active !== undefined) set.is_active = Boolean(patch.is_active);
  await col(EMAIL_TEMPLATE_COLLECTION).updateOne({ id }, { $set: set });
  return clean((await col(EMAIL_TEMPLATE_COLLECTION).findOne({ id })) as Doc) as Doc;
}

export async function listSendLog(
  actor: Doc,
  filters: { template_id?: string; limit?: number } = {},
): Promise<Doc[]> {
  assertStaff(actor);
  const q: Doc = {};
  if (filters.template_id) q.template_id = filters.template_id;
  if (actor.role === "ACCOUNTANT") q.sender_id = actor.id;
  return cleanMany(
    await col(EMAIL_TEMPLATE_SEND_LOG)
      .find(q)
      .sort({ created_at: -1 })
      .limit(filters.limit ?? 100)
      .toArray(),
  );
}

export type { EmailTemplateCategory };
