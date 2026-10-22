/**
 * HMRC 64-8 authorisation — pre-check, generate, send for e-sign, vault, dashboard.
 */
import { randomUUID } from "crypto";

import { env } from "../config/env";
import {
  HMRC64_COLLECTIONS,
  HMRC64_CONSENT_TEXT,
  HMRC64_STATUS_LABELS,
  Hmrc64FillFields,
  Hmrc64Precheck,
  Hmrc64Status,
  logHmrc64Audit,
  nowIso,
  renderHmrc64Html,
  sanitizeClientOverrides,
  splitAddress,
} from "../domain/hmrc64";
import { getCase } from "../domain/cases";
import { notify } from "../domain/workflow";
import { clean, cleanMany, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import {
  createGeneratedDocument,
  createSignatureRequest,
  sendInvitations,
} from "./esign";
import { queueEmail } from "./email";

const STAFF = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"];

function assertStaff(actor: Doc): void {
  if (!STAFF.includes(actor.role)) {
    throw httpError(403, "HMRC 64-8 forms are only available to accountants and admins");
  }
}

function agentDefaults(): Pick<
  Hmrc64FillFields,
  "agent_name" | "agent_address" | "agent_phone" | "agent_reference"
> {
  // Agent boxes are firm identity only — never taken from staff request overrides.
  return {
    agent_name: env("FIRM_LEGAL_NAME") || env("FIRM_NAME") || "Taxsimba Group Ltd",
    agent_address: env("FIRM_ADDRESS") || "Taxsimba Group Ltd, United Kingdom",
    agent_phone: env("FIRM_PHONE") || "",
    agent_reference: env("FIRM_AGENT_CODE") || env("HMRC_AGENT_CODE") || "",
  };
}

export async function loadClientFor64(clientId: string, actor: Doc): Promise<Doc> {
  assertStaff(actor);
  const client = (await col("clients").findOne({ id: clientId })) as Doc | null;
  if (!client) throw httpError(404, "Client not found");
  // Accountants may only act on clients they have a case for (or admin roles).
  if (actor.role === "ACCOUNTANT") {
    const linked = await col("cases").findOne({
      client_id: clientId,
      assigned_accountant_id: actor.id,
    });
    if (!linked) throw httpError(403, "Not assigned to this client");
  }
  return clean(client) as Doc;
}

export function buildFillFields(
  client: Doc,
  overrides: Partial<Hmrc64FillFields> = {},
): Hmrc64FillFields {
  // Agent / structure are locked. Only client (+ business) boxes accept overrides.
  const clientOnly = sanitizeClientOverrides(overrides);
  const addr = splitAddress(
    clientOnly.address_line_1
      ? [
          clientOnly.address_line_1,
          clientOnly.address_line_2,
          clientOnly.address_line_3,
          clientOnly.address_postcode,
        ]
          .filter(Boolean)
          .join(", ")
      : (client.address as string) || "",
  );
  const agent = agentDefaults();
  return {
    client_full_name: clientOnly.client_full_name ?? (client.name as string) ?? "",
    address_line_1: clientOnly.address_line_1 ?? addr.line1,
    address_line_2: clientOnly.address_line_2 ?? addr.line2,
    address_line_3: clientOnly.address_line_3 ?? addr.line3,
    address_postcode: clientOnly.address_postcode ?? addr.postcode,
    date_of_birth: clientOnly.date_of_birth ?? (client.date_of_birth as string) ?? "",
    ni_number: clientOnly.ni_number ?? (client.ni_number as string) ?? (client.nino as string) ?? "",
    utr: clientOnly.utr ?? (client.utr as string) ?? "",
    business_name:
      clientOnly.business_name ??
      (client.business_name as string) ??
      (client.company_name as string) ??
      "",
    business_utr: clientOnly.business_utr ?? (client.business_utr as string) ?? "",
    vat_registration_number:
      clientOnly.vat_registration_number ?? (client.vat_registration_number as string) ?? "",
    company_registration_number:
      clientOnly.company_registration_number ??
      (client.company_registration_number as string) ??
      (client.company_number as string) ??
      "",
    // Always firm defaults — ignore any agent_* in the request body.
    agent_name: agent.agent_name,
    agent_address: agent.agent_address,
    agent_phone: agent.agent_phone,
    agent_reference: agent.agent_reference,
  };
}

export function evaluatePrecheck(fields: Hmrc64FillFields): {
  missing: string[];
  warnings: string[];
  ready: boolean;
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!fields.client_full_name.trim()) missing.push("Client full name");
  if (!fields.address_line_1.trim()) missing.push("Client address");
  if (!fields.address_postcode.trim()) warnings.push("Postcode missing — confirm before sending");
  if (!fields.utr.trim() && !fields.ni_number.trim()) {
    warnings.push("Neither UTR nor NI number is on file — HMRC may need at least one reference");
  }
  if (!fields.date_of_birth.trim()) warnings.push("Date of birth not on file");
  if (!fields.agent_name.trim()) missing.push("Agent / firm name");
  return { missing, warnings, ready: missing.length === 0 };
}

export async function precheckHmrc64(
  clientId: string,
  actor: Doc,
  overrides: Partial<Hmrc64FillFields> = {},
): Promise<Hmrc64Precheck> {
  const client = await loadClientFor64(clientId, actor);
  const user = client.user_id
    ? ((await col("users").findOne({ id: client.user_id })) as Doc | null)
    : null;
  const fields = buildFillFields(client, overrides);
  const { missing, warnings, ready } = evaluatePrecheck(fields);
  return {
    client_id: client.id,
    client_user_id: (client.user_id as string) || null,
    client_email: (user?.email as string) || (client.email as string) || null,
    fields,
    missing,
    warnings,
    ready,
  };
}

export async function latestHmrc64ForClient(clientId: string, actor: Doc): Promise<Doc | null> {
  await loadClientFor64(clientId, actor);
  const row = (await col(HMRC64_COLLECTIONS.forms).findOne(
    { client_id: clientId, status: { $ne: "CANCELLED" } },
    { sort: { created_at: -1 } },
  )) as Doc | null;
  return row ? (clean(row) as Doc) : null;
}

export async function clientHmrc64Status(clientId: string, actor: Doc): Promise<Doc> {
  const latest = await latestHmrc64ForClient(clientId, actor);
  if (!latest) {
    return {
      status: "NOT_STARTED",
      label: HMRC64_STATUS_LABELS.NOT_STARTED,
      form: null,
    };
  }
  // Expire stale SENT forms whose e-sign link has passed.
  if (latest.status === "SENT" && latest.expires_at && new Date(latest.expires_at).getTime() < Date.now()) {
    await markExpired(latest.id as string, actor);
    return {
      status: "EXPIRED",
      label: HMRC64_STATUS_LABELS.EXPIRED,
      form: await latestHmrc64ForClient(clientId, actor),
    };
  }
  return {
    status: latest.status,
    label: HMRC64_STATUS_LABELS[latest.status as string] || latest.status,
    form: latest,
  };
}

async function markExpired(formId: string, actor: Doc | null): Promise<void> {
  const form = (await col(HMRC64_COLLECTIONS.forms).findOne({ id: formId })) as Doc | null;
  if (!form || form.status !== "SENT") return;
  await col(HMRC64_COLLECTIONS.forms).updateOne(
    { id: formId },
    { $set: { status: "EXPIRED", updated_at: nowIso() } },
  );
  await logHmrc64Audit({
    hmrc64_id: formId,
    client_id: form.client_id,
    event_type: "EXPIRED",
    user_id: actor?.id ?? null,
  });
}

export async function generateHmrc64(params: {
  client_id: string;
  actor: Doc;
  case_id?: string | null;
  overrides?: Partial<Hmrc64FillFields>;
  ip?: string | null;
}): Promise<Doc> {
  assertStaff(params.actor);
  if (params.case_id) await getCase(params.case_id, params.actor);
  const check = await precheckHmrc64(params.client_id, params.actor, params.overrides || {});
  if (!check.ready) {
    throw httpError(400, {
      code: "HMRC64_PRECHECK_FAILED",
      message: "Complete missing client details before generating the 64-8 form",
      missing: check.missing,
      warnings: check.warnings,
    });
  }

  const now = nowIso();
  const html = renderHmrc64Html(check.fields, {
    generated_at: now,
    our_ref: check.client_id.slice(0, 8).toUpperCase(),
  });

  // Create immutable e-sign document (locked body — signature only on signing page).
  const esignDoc = await createGeneratedDocument(
    {
      type: "HMRC_64_8",
      case_id: params.case_id ?? null,
      client_id: params.client_id,
      client_user_id: check.client_user_id,
      client_name: check.fields.client_full_name,
      merge_fields: {
        ...check.fields,
        body_html: html,
        form_title: "HMRC 64-8 — Authorising your agent",
      },
    },
    params.actor,
  );

  // Prefer rendered HTML facsimile as the signing body.
  await col("esign_generated_documents").updateOne(
    { id: esignDoc.id },
    {
      $set: {
        body_rendered: html,
        title: "HMRC 64-8 — Authorising your agent",
        updated_at: now,
      },
    },
  );

  const form: Doc = {
    id: randomUUID(),
    client_id: params.client_id,
    client_user_id: check.client_user_id,
    case_id: params.case_id ?? null,
    status: "DRAFT" as Hmrc64Status,
    fill_fields: check.fields,
    generated_at: now,
    sent_at: null,
    signed_at: null,
    expires_at: null,
    file_id: null,
    esign_document_id: esignDoc.id,
    esign_request_id: null,
    created_by: params.actor.id,
    created_at: now,
    updated_at: now,
    // TODO(security): signed artefact stored via putObject with bucket encryption-at-rest.
  };
  await col(HMRC64_COLLECTIONS.forms).insertOne({ ...form });
  await logHmrc64Audit({
    hmrc64_id: form.id,
    client_id: params.client_id,
    event_type: "GENERATED",
    user_id: params.actor.id,
    ip_address: params.ip ?? null,
  });

  return {
    ...clean(form),
    precheck: check,
    preview_html: html,
    esign_document: esignDoc,
  };
}

export async function sendHmrc64ForSignature(params: {
  form_id: string;
  actor: Doc;
  message?: string | null;
  ip?: string | null;
}): Promise<Doc> {
  assertStaff(params.actor);
  const form = (await col(HMRC64_COLLECTIONS.forms).findOne({ id: params.form_id })) as Doc | null;
  if (!form) throw httpError(404, "64-8 form not found");
  await loadClientFor64(form.client_id, params.actor);

  if (form.status === "SENT" && form.esign_request_id) {
    return resendHmrc64({ form_id: params.form_id, actor: params.actor, ip: params.ip });
  }
  if (!["DRAFT", "EXPIRED"].includes(form.status)) {
    throw httpError(400, `Cannot send form in status ${form.status}`);
  }

  const user = form.client_user_id
    ? ((await col("users").findOne({ id: form.client_user_id })) as Doc | null)
    : null;
  const email = (user?.email as string) || null;
  const name = (form.fill_fields as Hmrc64FillFields)?.client_full_name || user?.name || "Client";
  if (!email) throw httpError(400, "Client email is required to send for signature");

  const request = await createSignatureRequest(
    {
      document_id: form.esign_document_id,
      signers: [{ name, email, role: "CLIENT", auth_method: "EMAIL_LINK" }],
      channels: ["EMAIL", "IN_APP"],
      message:
        params.message ||
        "Please sign this HMRC 64-8 authorisation form so we can act as your agent with HMRC.",
      send_now: true,
    },
    params.actor,
  );

  const now = nowIso();
  await col(HMRC64_COLLECTIONS.forms).updateOne(
    { id: form.id },
    {
      $set: {
        status: "SENT",
        sent_at: now,
        expires_at: request.expires_at,
        esign_request_id: request.id,
        updated_at: now,
        last_reminder_at: null,
      },
    },
  );
  await logHmrc64Audit({
    hmrc64_id: form.id,
    client_id: form.client_id,
    event_type: form.status === "SENT" || form.status === "EXPIRED" ? "RESENT" : "SENT",
    user_id: params.actor.id,
    ip_address: params.ip ?? null,
    meta: { esign_request_id: request.id },
  });

  // Extra in-portal cue with clear client wording.
  if (form.client_user_id) {
    await notify(
      form.client_user_id,
      "HMRC 64-8 authorisation",
      "Please sign this HMRC 64-8 authorisation form.",
      form.case_id ?? null,
      null,
      "DOCUMENT",
    );
  }

  return decorateHmrc64(form.id);
}

export async function resendHmrc64(params: {
  form_id: string;
  actor: Doc;
  ip?: string | null;
}): Promise<Doc> {
  assertStaff(params.actor);
  const form = (await col(HMRC64_COLLECTIONS.forms).findOne({ id: params.form_id })) as Doc | null;
  if (!form) throw httpError(404, "64-8 form not found");
  if (!form.esign_request_id) {
    return sendHmrc64ForSignature(params);
  }
  await loadClientFor64(form.client_id, params.actor);
  await sendInvitations(form.esign_request_id, params.actor);
  await col(HMRC64_COLLECTIONS.forms).updateOne(
    { id: form.id },
    { $set: { status: "SENT", updated_at: nowIso(), last_reminder_at: null } },
  );
  await logHmrc64Audit({
    hmrc64_id: form.id,
    client_id: form.client_id,
    event_type: "RESENT",
    user_id: params.actor.id,
    ip_address: params.ip ?? null,
  });
  return decorateHmrc64(form.id);
}

export async function decorateHmrc64(formId: string): Promise<Doc> {
  const form = (await col(HMRC64_COLLECTIONS.forms).findOne({ id: formId })) as Doc | null;
  if (!form) throw httpError(404, "64-8 form not found");
  const audit = cleanMany(
    await col(HMRC64_COLLECTIONS.audit)
      .find({ hmrc64_id: formId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray(),
  );
  return {
    ...clean(form),
    label: HMRC64_STATUS_LABELS[form.status as string] || form.status,
    preview_html: renderHmrc64Html(form.fill_fields as Hmrc64FillFields, {
      generated_at: form.generated_at,
    }),
    audit,
    consent_text: HMRC64_CONSENT_TEXT,
  };
}

export async function getHmrc64(formId: string, actor: Doc): Promise<Doc> {
  assertStaff(actor);
  const form = await decorateHmrc64(formId);
  await loadClientFor64(form.client_id, actor);
  return form;
}

/** Called from e-sign post-sign hooks when document type is HMRC_64_8. */
export async function onHmrc64Signed(params: {
  esign_document_id: string;
  esign_request_id: string;
  signed_at: string;
  certificate_html?: string | null;
}): Promise<void> {
  const form = (await col(HMRC64_COLLECTIONS.forms).findOne({
    esign_document_id: params.esign_document_id,
  })) as Doc | null;
  if (!form) return;

  const fileId = randomUUID();
  // Vault copy for staff download (HTML certificate + form body as document record).
  await col("documents").insertOne({
    id: fileId,
    case_id: form.case_id,
    client_id: form.client_id,
    client_user_id: form.client_user_id,
    document_type: "HMRC 64-8 Authorisation",
    category: "HMRC_64_8",
    name: "HMRC 64-8 — Authorising your agent (signed)",
    status: "Final",
    is_final: true,
    is_internal: false,
    is_deleted: false,
    content_type: "text/html",
    size: (params.certificate_html || "").length,
    storage_path: null,
    body_html: form.fill_fields
      ? renderHmrc64Html(form.fill_fields as Hmrc64FillFields, { generated_at: form.generated_at })
      : null,
    certificate_html: params.certificate_html ?? null,
    hmrc64_id: form.id,
    esign_request_id: params.esign_request_id,
    esign_document_id: params.esign_document_id,
    upload_date: params.signed_at,
    uploaded_at: params.signed_at,
    created_at: params.signed_at,
    scan_status: "clean",
    scan_timestamp: params.signed_at,
    scanner_notes: "System-generated signed authorisation (no upload scan)",
  });

  await col(HMRC64_COLLECTIONS.forms).updateOne(
    { id: form.id },
    {
      $set: {
        status: "SIGNED",
        signed_at: params.signed_at,
        file_id: fileId,
        updated_at: params.signed_at,
        agent_authorisation: "Completed",
      },
    },
  );
  await col("clients").updateOne(
    { id: form.client_id },
    {
      $set: {
        hmrc_agent_authorisation: "Completed",
        hmrc_64_8_status: "SIGNED",
        hmrc_64_8_signed_at: params.signed_at,
        updated_at: params.signed_at,
      },
    },
  );
  await logHmrc64Audit({
    hmrc64_id: form.id,
    client_id: form.client_id,
    event_type: "SIGNED",
    meta: { file_id: fileId, esign_request_id: params.esign_request_id },
  });
}

export async function hmrc64Dashboard(actor: Doc): Promise<Doc> {
  assertStaff(actor);
  const q: Doc = {};
  if (actor.role === "ACCOUNTANT") {
    const cases = await col("cases")
      .find({ assigned_accountant_id: actor.id }, { projection: { client_id: 1 } })
      .toArray();
    q.client_id = { $in: [...new Set(cases.map((c) => c.client_id).filter(Boolean))] };
  }

  const forms = cleanMany(
    await col(HMRC64_COLLECTIONS.forms).find(q).sort({ updated_at: -1 }).limit(500).toArray(),
  );

  const pending = forms.filter((f) => f.status === "SENT");
  const completed = forms.filter((f) => f.status === "SIGNED");
  const expired = forms.filter((f) => f.status === "EXPIRED");

  // Clients missing tax references (UTR and NI).
  const clientQ: Doc = {};
  if (q.client_id) clientQ.id = q.client_id;
  const clients = await col("clients").find(clientQ).limit(500).toArray();
  const missingRefs = clients
    .filter((c) => !c.utr && !c.ni_number && !c.nino)
    .map((c) => ({
      id: c.id,
      name: c.name,
      client_ref: c.client_ref,
      email: c.email,
    }));

  return {
    pending_authorisation: pending,
    completed_authorisation: completed,
    expired,
    missing_tax_references: missingRefs,
    counts: {
      pending: pending.length,
      completed: completed.length,
      expired: expired.length,
      missing_tax_references: missingRefs.length,
    },
  };
}

/** Reminder every 3 days for unsigned 64-8 forms. */
export async function runHmrc64Reminders(): Promise<{ reminded: number }> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const pending = (await col(HMRC64_COLLECTIONS.forms)
    .find({
      status: "SENT",
      sent_at: { $lte: cutoff },
      $or: [{ last_reminder_at: null }, { last_reminder_at: { $lte: cutoff } }],
    })
    .limit(100)
    .toArray()) as Doc[];

  let reminded = 0;
  for (const form of pending) {
    if (form.expires_at && new Date(form.expires_at).getTime() < Date.now()) {
      await markExpired(form.id as string, null);
      continue;
    }
    const user = form.client_user_id
      ? ((await col("users").findOne({ id: form.client_user_id })) as Doc | null)
      : null;
    if (user?.email && form.esign_request_id) {
      // Rotate / resend via e-sign invitation path would need actor; email a nudge instead.
      await queueEmail({
        to: user.email,
        recipientName: user.name,
        kind: "HMRC64_REMINDER",
        title: "Reminder: please sign your HMRC 64-8",
        body: "Please sign this HMRC 64-8 authorisation form so we can act as your agent with HMRC. Check your earlier email for the secure signing link, or contact us if you need it resent.",
        link: "/actions",
        callToAction: "Open portal",
        dedupeKey: `hmrc64-reminder:${form.id}:${cutoff.slice(0, 10)}`,
        userId: user.id,
        caseId: form.case_id ?? null,
      });
      if (form.client_user_id) {
        await notify(
          form.client_user_id,
          "Reminder: HMRC 64-8",
          "Please sign this HMRC 64-8 authorisation form.",
          form.case_id ?? null,
          null,
          "DOCUMENT",
        );
      }
      await col(HMRC64_COLLECTIONS.forms).updateOne(
        { id: form.id },
        { $set: { last_reminder_at: nowIso(), updated_at: nowIso() } },
      );
      await logHmrc64Audit({
        hmrc64_id: form.id,
        client_id: form.client_id,
        event_type: "REMINDER_SENT",
      });
      reminded += 1;
    }
  }
  return { reminded };
}
