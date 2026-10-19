/**
 * HMRC Form 64-8 — Authorising your agent.
 *
 * Staff (accountant/admin) generate an auto-filled copy from client master data,
 * then send it for e-signature. Clients never edit the form — they only sign.
 *
 * Legal note: field labels mirror the official HMRC 64-8 boxes. Do not reword
 * HMRC instructional text. Layout is an HTML facsimile for e-sign; production
 * may swap in an immutable PDF template once counsel signs off.
 *
 * TODO(hmrc): integrate Agent Authorisation API when available for digital AA.
 * TODO(security): confirm object-storage encryption-at-rest for signed copies.
 * TODO(compliance): upload the current HMRC PDF template and map field coordinates.
 */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

export const HMRC64_COLLECTIONS = {
  forms: "hmrc_64_forms",
  audit: "hmrc_64_audit_log",
} as const;

export const HMRC64_STATUSES = ["DRAFT", "SENT", "SIGNED", "EXPIRED", "CANCELLED"] as const;
export type Hmrc64Status = (typeof HMRC64_STATUSES)[number];

/** UI-friendly status labels for client profile badges. */
export const HMRC64_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  DRAFT: "Not Started",
  SENT: "Awaiting Signature",
  SIGNED: "Signed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export const HMRC64_EVENT_TYPES = [
  "GENERATED",
  "SENT",
  "VIEWED",
  "SIGNED",
  "EXPIRED",
  "RESENT",
  "CANCELLED",
  "DOWNLOADED",
  "REMINDER_SENT",
] as const;
export type Hmrc64EventType = (typeof HMRC64_EVENT_TYPES)[number];

/** Consent shown on the client signing page for 64-8 only. */
export const HMRC64_CONSENT_TEXT =
  "I confirm that the details on this HMRC 64-8 authorisation form are correct and I authorise the named agent to act on my behalf as indicated.";

export interface Hmrc64FillFields {
  client_full_name: string;
  address_line_1: string;
  address_line_2: string;
  address_line_3: string;
  address_postcode: string;
  date_of_birth: string;
  ni_number: string;
  utr: string;
  business_name: string;
  business_utr: string;
  vat_registration_number: string;
  company_registration_number: string;
  agent_name: string;
  agent_address: string;
  agent_phone: string;
  agent_reference: string;
}

export interface Hmrc64Precheck {
  client_id: string;
  client_user_id: string | null;
  client_email: string | null;
  fields: Hmrc64FillFields;
  missing: string[];
  warnings: string[];
  ready: boolean;
}

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function box(label: string, value: string, testId?: string): string {
  return [
    `<div class="hmrc64-box" ${testId ? `data-field="${testId}"` : ""}>`,
    `<div class="hmrc64-label">${esc(label)}</div>`,
    `<div class="hmrc64-value">${esc(value) || "&nbsp;"}</div>`,
    `</div>`,
  ].join("");
}

/**
 * Fixed HTML facsimile of HMRC 64-8 boxes.
 * Labels are HMRC-facing wording; only values are auto-filled.
 */
export function renderHmrc64Html(fields: Hmrc64FillFields, meta: { generated_at: string; our_ref?: string }): string {
  const css = `
.hmrc64 { font-family: "Public Sans", Arial, sans-serif; color: #161B18; max-width: 720px; margin: 0 auto; }
.hmrc64 h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
.hmrc64 .sub { color: #626A65; font-size: 0.85rem; margin-bottom: 1.25rem; }
.hmrc64 h2 { font-size: 1rem; margin: 1.5rem 0 0.75rem; border-bottom: 2px solid #006B3C; padding-bottom: 0.35rem; }
.hmrc64-box { border: 1px solid #C5D4CB; border-radius: 6px; padding: 0.65rem 0.75rem; margin-bottom: 0.5rem; background: #fff; }
.hmrc64-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #626A65; font-weight: 600; }
.hmrc64-value { font-size: 0.95rem; font-weight: 600; margin-top: 0.2rem; min-height: 1.2em; }
.hmrc64 .note { font-size: 0.8rem; color: #445049; line-height: 1.45; margin: 0.75rem 0; }
.hmrc64 .sig { border: 1px dashed #C5D4CB; border-radius: 8px; padding: 1rem; margin-top: 1.5rem; background: #F7F8F7; }
.hmrc64 .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
@media (max-width: 640px) { .hmrc64 .grid2 { grid-template-columns: 1fr; } }
`.trim();

  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="utf-8" /><title>HMRC 64-8 — Authorising your agent</title><style>${css}</style></head>
<body>
<article class="hmrc64" data-testid="hmrc64-form">
  <h1>Authorising your agent</h1>
  <p class="sub">HMRC form 64-8 (facsimile for electronic signature) · Generated ${esc(meta.generated_at)}${meta.our_ref ? ` · Ref ${esc(meta.our_ref)}` : ""}</p>
  <p class="note">
    This document mirrors the official HMRC 64-8 authorisation boxes. Field labels are not altered.
    Only the boxed values below are completed from your client record. Sign where indicated —
    all other fields are locked.
  </p>

  <h2>Your details</h2>
  ${box("Your full name", fields.client_full_name, "client_full_name")}
  ${box("Address line 1", fields.address_line_1, "address_line_1")}
  ${box("Address line 2", fields.address_line_2, "address_line_2")}
  ${box("Address line 3 / town", fields.address_line_3, "address_line_3")}
  <div class="grid2">
    ${box("Postcode", fields.address_postcode, "address_postcode")}
    ${box("Date of birth", fields.date_of_birth, "date_of_birth")}
  </div>
  <div class="grid2">
    ${box("National Insurance number", fields.ni_number, "ni_number")}
    ${box("Unique Taxpayer Reference (UTR)", fields.utr, "utr")}
  </div>

  <h2>Business details (if applicable)</h2>
  ${box("Business or company name", fields.business_name, "business_name")}
  <div class="grid2">
    ${box("Business UTR", fields.business_utr, "business_utr")}
    ${box("VAT registration number", fields.vat_registration_number, "vat_registration_number")}
  </div>
  ${box("Company registration number", fields.company_registration_number, "company_registration_number")}

  <h2>Agent details</h2>
  ${box("Agent / firm name", fields.agent_name, "agent_name")}
  ${box("Agent address", fields.agent_address, "agent_address")}
  <div class="grid2">
    ${box("Agent telephone", fields.agent_phone, "agent_phone")}
    ${box("Agent reference", fields.agent_reference, "agent_reference")}
  </div>

  <h2>What you are authorising</h2>
  <p class="note">
    By signing this form you authorise the agent named above to act on your behalf with HMRC
    in respect of the taxes and matters covered by form 64-8, including receiving information
    and corresponding with HMRC as your agent.
  </p>

  <div class="sig">
    <div class="hmrc64-label">Client signature</div>
    <p class="note" style="margin:0.5rem 0 0">
      Please sign this HMRC 64-8 authorisation form. Signature is captured electronically;
      do not edit any boxed details above.
    </p>
  </div>
</article>
</body>
</html>`;
}

/** Split a free-text address into 64-8 style lines + postcode heuristic. */
export function splitAddress(raw: string | null | undefined): {
  line1: string;
  line2: string;
  line3: string;
  postcode: string;
} {
  const text = (raw || "").trim();
  if (!text) return { line1: "", line2: "", line3: "", postcode: "" };
  const parts = text
    .split(/[\n,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const ukPostcode =
    parts
      .slice()
      .reverse()
      .find((p) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(p)) || "";
  const withoutPc = ukPostcode ? parts.filter((p) => p !== ukPostcode) : parts;
  return {
    line1: withoutPc[0] || "",
    line2: withoutPc[1] || "",
    line3: withoutPc.slice(2).join(", "),
    postcode: ukPostcode.toUpperCase(),
  };
}

export async function ensureHmrc64Indexes(): Promise<void> {
  const specs: [string, Doc, Doc?][] = [
    [HMRC64_COLLECTIONS.forms, { client_id: 1, created_at: -1 }],
    [HMRC64_COLLECTIONS.forms, { status: 1, sent_at: -1 }],
    [HMRC64_COLLECTIONS.forms, { esign_request_id: 1 }],
    [HMRC64_COLLECTIONS.audit, { hmrc64_id: 1, timestamp: -1 }],
    [HMRC64_COLLECTIONS.audit, { client_id: 1, timestamp: -1 }],
  ];
  for (const [name, keys, opts] of specs) {
    try {
      await col(name).createIndex(keys, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`hmrc64 index ${name} skipped: ${String(e)}`);
    }
  }
}

export async function logHmrc64Audit(params: {
  hmrc64_id: string;
  client_id: string;
  event_type: Hmrc64EventType;
  user_id?: string | null;
  ip_address?: string | null;
  meta?: Doc;
}): Promise<void> {
  await col(HMRC64_COLLECTIONS.audit).insertOne({
    id: randomUUID(),
    hmrc64_id: params.hmrc64_id,
    client_id: params.client_id,
    event_type: params.event_type,
    timestamp: nowIso(),
    user_id: params.user_id ?? null,
    ip_address: params.ip_address ?? null,
    meta: params.meta ?? {},
  });
}

export { nowIso, randomUUID };
export type { Doc };
