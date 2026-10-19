/**
 * Native e-signature module — domain model for UK/EU tax approval packs.
 *
 * Design goals (eIDAS-aligned electronic signatures + HMRC evidence practice):
 * - Immutable calculation snapshot: every GeneratedDocument stores a SHA-256 hash of
 *   the merge payload (figures) so the signed artefact cannot drift from what was shown.
 * - Unique, expiring signing tokens per Signer (not shared links).
 * - Full SignatureEvent audit trail (viewed / consented / signed / declined / expired)
 *   with IP + user-agent for each event.
 * - Post-sign hooks lock the tax job and gate "Submit to HMRC" on CLIENT_APPROVED /
 *   READY_FOR_SUBMISSION workflow states.
 *
 * TODO(legal): Counsel should confirm the consent wording and certificate format against
 * current eIDAS / UK Electronic Communications Act guidance before production use.
 * This scaffold implements "simple electronic signatures" with strong audit evidence —
 * not qualified electronic signatures (QES) via a trust service provider.
 */
import { createHash, randomBytes, randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { isoPlusDays, nowIso } from "./workflow";

// ---------------------------------------------------------------------------
// Enums / constants
// ---------------------------------------------------------------------------

/** Document kinds used in VAT/MTD, SA, CT, and extensibility stubs. */
export const DOCUMENT_TYPES = [
  "VAT_RETURN_APPROVAL",
  "MTD_QUARTERLY_APPROVAL",
  "SA_SUMMARY_APPROVAL",
  "CT_SUMMARY_APPROVAL",
  "ENGAGEMENT_LETTER",
  "AML_PACK",
  "CUSTOM",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const GENERATED_DOC_STATUSES = [
  "DRAFT",
  "READY",
  "SENT",
  "SIGNED",
  "SUPERSEDED",
  "VOID",
] as const;
export type GeneratedDocStatus = (typeof GENERATED_DOC_STATUSES)[number];

export const REQUEST_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "PARTIALLY_SIGNED",
  "SIGNED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const SIGNER_ROLES = ["CLIENT", "AGENT", "DIRECTOR", "PARTNER", "WITNESS"] as const;
export type SignerRole = (typeof SIGNER_ROLES)[number];

export const SIGNER_STATUSES = [
  "PENDING",
  "INVITED",
  "VIEWED",
  "SIGNED",
  "DECLINED",
  "EXPIRED",
] as const;
export type SignerStatus = (typeof SIGNER_STATUSES)[number];

/** Auth methods — EMAIL_LINK is the default; OTP/SMS are design stubs. */
export const AUTH_METHODS = ["EMAIL_LINK", "OTP_EMAIL", "OTP_SMS", "SESSION"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

export const EVENT_TYPES = [
  "CREATED",
  "SENT",
  "VIEWED",
  "CONSENTED",
  "SIGNED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
  "DOWNLOADED",
  "REMINDER_SENT",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const DELIVERY_CHANNELS = ["EMAIL", "SMS", "IN_APP"] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

/** Explicit HMRC-authorisation consent shown on the signing page. */
export const HMRC_CONSENT_TEXT =
  "I confirm these figures are correct and authorise submission to HMRC.";

export const DEFAULT_EXPIRY_DAYS = 14;

// ---------------------------------------------------------------------------
// Collection names (Mongo — mirrors Prisma-style entities)
// ---------------------------------------------------------------------------

export const ESIGN_COLLECTIONS = {
  templates: "esign_document_templates",
  documents: "esign_generated_documents",
  requests: "esign_signature_requests",
  signers: "esign_signers",
  events: "esign_signature_events",
  /** Per-firm branding for white-label / multi-firm (stub). */
  branding: "esign_firm_branding",
} as const;

// ---------------------------------------------------------------------------
// TypeScript entity shapes (documentation + runtime helpers)
// ---------------------------------------------------------------------------

/**
 * DocumentTemplate — reusable layout + merge-field definitions.
 *
 * Prisma-equivalent sketch:
 *   model DocumentTemplate {
 *     id            String   @id
 *     firmId        String?  // white-label stub
 *     type          DocumentType
 *     name          String
 *     title         String
 *     bodyMarkdown  String
 *     mergeFields   Json     // [{ key, label, required }]
 *     layout        Json?
 *     version       Int
 *     isActive      Boolean
 *     createdAt     DateTime
 *   }
 */
export interface DocumentTemplate {
  id: string;
  firm_id: string | null;
  type: DocumentType;
  name: string;
  title: string;
  body_markdown: string;
  merge_fields: { key: string; label: string; required?: boolean }[];
  layout: Doc | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GeneratedDocument — rendered instance tied to client + period + immutable hash.
 *
 *   model GeneratedDocument {
 *     id                    String
 *     templateId            String
 *     templateVersion       Int
 *     type                  DocumentType
 *     clientId              String?
 *     clientUserId          String?
 *     caseId                String?
 *     mtdPeriodId           String?
 *     taxPeriodLabel        String?
 *     calculationVersionId  String?  // SA calc snapshot
 *     calculationHash       String   // SHA-256 of canonical merge payload
 *     mergePayload          Json
 *     title                 String
 *     bodyRendered          String
 *     status                GeneratedDocStatus
 *     version               Int
 *     signedPdfKey          String?
 *     certificateHtml       String?
 *     firmId                String?
 *   }
 */
export interface GeneratedDocument {
  id: string;
  template_id: string;
  template_version: number;
  type: DocumentType;
  client_id: string | null;
  client_user_id: string | null;
  client_name: string | null;
  case_id: string | null;
  mtd_period_id: string | null;
  tax_period_label: string | null;
  calculation_version_id: string | null;
  calculation_hash: string;
  merge_payload: Doc;
  title: string;
  body_rendered: string;
  status: GeneratedDocStatus;
  version: number;
  signed_at: string | null;
  signed_pdf_key: string | null;
  certificate_html: string | null;
  firm_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * SignatureRequest — envelope sent to one or more signers.
 *
 *   model SignatureRequest {
 *     id            String
 *     documentId    String
 *     status        RequestStatus
 *     sentAt        DateTime?
 *     expiresAt     DateTime
 *     completedAt   DateTime?
 *     channels      DeliveryChannel[]
 *     message       String?
 *     paymentRedirectUrl String?  // post-sign payment stub
 *   }
 */
export interface SignatureRequest {
  id: string;
  document_id: string;
  case_id: string | null;
  mtd_period_id: string | null;
  client_user_id: string | null;
  status: RequestStatus;
  sent_at: string | null;
  expires_at: string;
  completed_at: string | null;
  channels: DeliveryChannel[];
  message: string | null;
  /** TODO(payments): optional redirect after all signers complete. */
  payment_redirect_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Signer — individual party on a request (token is hashed at rest).
 */
export interface Signer {
  id: string;
  request_id: string;
  document_id: string;
  name: string;
  email: string;
  role: SignerRole;
  auth_method: AuthMethod;
  status: SignerStatus;
  /** SHA-256 of the raw signing token; raw token only leaves the server once (email). */
  token_hash: string;
  token_expires_at: string;
  invited_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  signature_type: "DRAWN" | "TYPED" | "CLICK" | null;
  signature_data: string | null;
  consent_text: string | null;
  consent_accepted: boolean;
  /** TODO(otp): store challenge id / expiry when OTP_EMAIL / OTP_SMS is enabled. */
  otp_challenge_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface SignatureEvent {
  id: string;
  request_id: string;
  document_id: string;
  signer_id: string | null;
  event_type: EventType;
  timestamp: string;
  ip: string | null;
  user_agent: string | null;
  meta: Doc;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Canonical JSON → SHA-256. Used as the immutable calculation / document hash. */
export function hashPayload(payload: unknown): string {
  const canonical = JSON.stringify(sortKeys(payload ?? {}));
  return createHash("sha256").update(canonical).digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
    return out;
  }
  return value;
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Cryptographically random URL-safe signing token (raw form emailed once). */
export function mintSigningToken(): string {
  return randomBytes(32).toString("base64url");
}

export function renderMerge(template: string, fields: Doc): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key: string) => {
    const parts = key.split(".");
    let cur: unknown = fields;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return "";
      cur = (cur as Doc)[p];
    }
    return cur == null ? "" : String(cur);
  });
}

export function defaultExpiryIso(days = DEFAULT_EXPIRY_DAYS): string {
  return isoPlusDays(days);
}

/** Seed built-in templates used by VAT/MTD and SA/CT approval flows. */
export async function ensureEsignTemplates(): Promise<void> {
  const existing = await col(ESIGN_COLLECTIONS.templates).countDocuments({});
  if (existing > 0) return;

  const now = nowIso();
  const seeds: Omit<DocumentTemplate, "id">[] = [
    {
      firm_id: null,
      type: "SA_SUMMARY_APPROVAL",
      name: "Self Assessment approval summary",
      title: "Self Assessment tax return — client approval",
      body_markdown: [
        "# Self Assessment approval",
        "",
        "**Client:** {{client_name}}",
        "**Tax year:** {{tax_year}}",
        "**Case:** {{case_ref}}",
        "",
        "## Summary figures",
        "- Total income: {{figures.total_income}}",
        "- Taxable income: {{figures.taxable_income}}",
        "- Income tax due: {{figures.income_tax}}",
        "- National Insurance: {{figures.ni}}",
        "- Total due: {{figures.total_due}}",
        "",
        "Calculation version: {{calculation_version}}",
        "Document hash: {{calculation_hash}}",
        "",
        "By signing, you confirm these figures are correct and authorise TaxSimba to submit",
        "this return to HMRC on your behalf.",
      ].join("\n"),
      merge_fields: [
        { key: "client_name", label: "Client name", required: true },
        { key: "tax_year", label: "Tax year", required: true },
        { key: "case_ref", label: "Case reference" },
        { key: "figures", label: "Summary figures object", required: true },
        { key: "calculation_version", label: "Calc version" },
        { key: "calculation_hash", label: "Hash (auto)" },
      ],
      layout: { sections: ["header", "figures", "consent"] },
      version: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      firm_id: null,
      type: "MTD_QUARTERLY_APPROVAL",
      name: "MTD quarterly update approval",
      title: "Making Tax Digital — quarterly update approval",
      body_markdown: [
        "# MTD quarterly update approval",
        "",
        "**Client:** {{client_name}}",
        "**Period:** {{period_label}}",
        "**Obligation:** {{obligation_type}}",
        "",
        "## Figures for this update",
        "- Income: {{figures.income}}",
        "- Expenses: {{figures.expenses}}",
        "- Net: {{figures.net}}",
        "",
        "Snapshot hash: {{calculation_hash}}",
        "",
        "By signing, you confirm these figures are correct and authorise submission to HMRC.",
      ].join("\n"),
      merge_fields: [
        { key: "client_name", label: "Client name", required: true },
        { key: "period_label", label: "Period label", required: true },
        { key: "obligation_type", label: "Obligation type" },
        { key: "figures", label: "Period figures", required: true },
        { key: "calculation_hash", label: "Hash (auto)" },
      ],
      layout: { sections: ["header", "figures", "consent"] },
      version: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      firm_id: null,
      type: "VAT_RETURN_APPROVAL",
      name: "VAT return approval",
      title: "VAT return — client approval",
      body_markdown: [
        "# VAT return approval",
        "",
        "**Client:** {{client_name}}",
        "**Period:** {{period_label}}",
        "",
        "## Box summary",
        "- Box 1 (VAT due on sales): {{figures.box1}}",
        "- Box 4 (VAT reclaimed): {{figures.box4}}",
        "- Box 5 (Net VAT): {{figures.box5}}",
        "- Box 6 (Total sales): {{figures.box6}}",
        "- Box 7 (Total purchases): {{figures.box7}}",
        "",
        "Document hash: {{calculation_hash}}",
      ].join("\n"),
      merge_fields: [
        { key: "client_name", label: "Client name", required: true },
        { key: "period_label", label: "VAT period", required: true },
        { key: "figures", label: "VAT boxes", required: true },
        { key: "calculation_hash", label: "Hash (auto)" },
      ],
      layout: { sections: ["header", "boxes", "consent"] },
      version: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      firm_id: null,
      type: "CT_SUMMARY_APPROVAL",
      name: "Corporation Tax summary approval",
      title: "Corporation Tax return — director approval",
      body_markdown: [
        "# Corporation Tax approval",
        "",
        "**Company:** {{client_name}}",
        "**Accounting period:** {{tax_year}}",
        "",
        "## Summary",
        "- Taxable profit: {{figures.taxable_profit}}",
        "- Corporation tax: {{figures.ct_due}}",
        "",
        "Document hash: {{calculation_hash}}",
        "",
        "Directors may co-sign this document. Each signature is recorded separately.",
      ].join("\n"),
      merge_fields: [
        { key: "client_name", label: "Company name", required: true },
        { key: "tax_year", label: "Accounting period", required: true },
        { key: "figures", label: "CT figures", required: true },
        { key: "calculation_hash", label: "Hash (auto)" },
      ],
      layout: { sections: ["header", "figures", "consent"] },
      version: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    // Engagement letters are owned by domain/engagementLetter.ts (frozen legal
    // wording + auto schedules). This catalogue row remains for e-sign type
    // routing / downloads — do not edit legal copy here.
    {
      firm_id: null,
      type: "ENGAGEMENT_LETTER",
      name: "Engagement letter (system-generated)",
      title: "Terms of Engagement",
      body_markdown:
        "See domain/engagementLetter.ts — legal template is code-owned and not staff-editable.",
      merge_fields: [
        { key: "client_display_name", label: "Client name", required: true },
        { key: "schedules_block", label: "Service schedules", required: true },
        { key: "our_ref", label: "Our Ref" },
        { key: "letter_date", label: "Date" },
      ],
      layout: { sections: ["letter", "acceptance"] },
      version: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
    {
      firm_id: null,
      type: "AML_PACK",
      name: "AML + engagement onboarding pack (stub)",
      title: "Onboarding & AML pack",
      body_markdown: [
        "# Onboarding pack",
        "",
        "**Client:** {{client_name}}",
        "",
        "## AML questionnaire",
        "{{aml_summary}}",
        "",
        "## Engagement letter",
        "{{engagement_summary}}",
        "",
        "<!-- TODO(aml): bundle AML questionnaire + engagement letter + first",
        "     approval into one multi-document SignatureRequest. -->",
      ].join("\n"),
      merge_fields: [
        { key: "client_name", label: "Client name", required: true },
        { key: "aml_summary", label: "AML answers summary" },
        { key: "engagement_summary", label: "Engagement excerpt" },
      ],
      layout: { sections: ["aml", "engagement", "consent"] },
      version: 1,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await col(ESIGN_COLLECTIONS.templates).insertMany(
    seeds.map((s) => ({ id: randomUUID(), ...s })),
  );
}

export async function ensureEsignIndexes(): Promise<void> {
  const specs: [string, Doc][] = [
    [ESIGN_COLLECTIONS.templates, { type: 1, is_active: 1 }],
    [ESIGN_COLLECTIONS.templates, { firm_id: 1 }],
    [ESIGN_COLLECTIONS.documents, { case_id: 1 }],
    [ESIGN_COLLECTIONS.documents, { mtd_period_id: 1 }],
    [ESIGN_COLLECTIONS.documents, { client_user_id: 1 }],
    [ESIGN_COLLECTIONS.documents, { calculation_hash: 1 }],
    [ESIGN_COLLECTIONS.documents, { status: 1 }],
    [ESIGN_COLLECTIONS.requests, { document_id: 1 }],
    [ESIGN_COLLECTIONS.requests, { case_id: 1, status: 1 }],
    [ESIGN_COLLECTIONS.requests, { status: 1, expires_at: 1 }],
    [ESIGN_COLLECTIONS.signers, { request_id: 1 }],
    [ESIGN_COLLECTIONS.signers, { token_hash: 1 }],
    [ESIGN_COLLECTIONS.signers, { email: 1 }],
    [ESIGN_COLLECTIONS.events, { request_id: 1, timestamp: 1 }],
    [ESIGN_COLLECTIONS.events, { document_id: 1 }],
    [ESIGN_COLLECTIONS.branding, { firm_id: 1 }],
  ];
  for (const [name, keys] of specs) {
    try {
      await col(name).createIndex(keys);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`esign index ${name} skipped: ${String(e)}`);
    }
  }
  // Unique token hash so two signers never share a link.
  try {
    await col(ESIGN_COLLECTIONS.signers).createIndex({ token_hash: 1 }, { unique: true });
  } catch {
    /* already exists */
  }
}
