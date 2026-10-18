/**
 * E-sign business logic: document generation, requests, invitations, signing,
 * certificate assembly, and post-sign workflow hooks for tax/MTD jobs.
 */
import { randomUUID } from "crypto";

import { env } from "../config/env";
import {
  AUTH_METHODS,
  AuthMethod,
  DEFAULT_EXPIRY_DAYS,
  DELIVERY_CHANNELS,
  DeliveryChannel,
  DOCUMENT_TYPES,
  DocumentType,
  ESIGN_COLLECTIONS,
  EVENT_TYPES,
  EventType,
  GeneratedDocument,
  HMRC_CONSENT_TEXT,
  REQUEST_STATUSES,
  RequestStatus,
  SIGNER_ROLES,
  SignerRole,
  defaultExpiryIso,
  hashPayload,
  hashToken,
  mintSigningToken,
  renderMerge,
} from "../domain/esign";
import { getCase } from "../domain/cases";
import { logActivity, notify, nowIso, transition } from "../domain/workflow";
import { clean, cleanMany, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { queueEmail } from "./email";

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface CreateDocumentInput {
  template_id?: string | null;
  type: DocumentType;
  case_id?: string | null;
  mtd_period_id?: string | null;
  client_id?: string | null;
  client_user_id?: string | null;
  client_name?: string | null;
  tax_period_label?: string | null;
  calculation_version_id?: string | null;
  merge_fields: Doc;
  firm_id?: string | null;
}

export interface SignerInput {
  name: string;
  email: string;
  role?: SignerRole;
  auth_method?: AuthMethod;
  sort_order?: number;
}

export interface CreateRequestInput {
  document_id: string;
  signers: SignerInput[];
  expires_at?: string | null;
  channels?: DeliveryChannel[];
  message?: string | null;
  /** TODO(payments): URL to send the client to after all signers complete. */
  payment_redirect_url?: string | null;
  send_now?: boolean;
}

export interface SignInput {
  signature_type: "DRAWN" | "TYPED" | "CLICK";
  signature_data?: string | null;
  consent_accepted: boolean;
  typed_name?: string | null;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

async function requireTemplate(typeOrId: { type?: DocumentType; id?: string }): Promise<Doc> {
  const q: Doc = { is_active: true };
  if (typeOrId.id) q.id = typeOrId.id;
  else if (typeOrId.type) q.type = typeOrId.type;
  else throw httpError(400, "template_id or type is required");
  const tpl = (await col(ESIGN_COLLECTIONS.templates).findOne(q)) as Doc | null;
  if (!tpl) throw httpError(404, "Document template not found");
  return tpl;
}

export async function getDocument(id: string): Promise<Doc> {
  const doc = (await col(ESIGN_COLLECTIONS.documents).findOne({ id })) as Doc | null;
  if (!doc) throw httpError(404, "Generated document not found");
  return clean(doc) as Doc;
}

export async function getRequest(id: string): Promise<Doc> {
  const req = (await col(ESIGN_COLLECTIONS.requests).findOne({ id })) as Doc | null;
  if (!req) throw httpError(404, "Signature request not found");
  return clean(req) as Doc;
}

async function signersFor(requestId: string): Promise<Doc[]> {
  return cleanMany(
    await col(ESIGN_COLLECTIONS.signers)
      .find({ request_id: requestId })
      .sort({ sort_order: 1 })
      .toArray(),
  );
}

async function eventsFor(requestId: string): Promise<Doc[]> {
  return cleanMany(
    await col(ESIGN_COLLECTIONS.events)
      .find({ request_id: requestId })
      .sort({ timestamp: 1 })
      .toArray(),
  );
}

export async function recordEvent(params: {
  request_id: string;
  document_id: string;
  signer_id?: string | null;
  event_type: EventType;
  ip?: string | null;
  user_agent?: string | null;
  meta?: Doc;
}): Promise<void> {
  if (!EVENT_TYPES.includes(params.event_type)) {
    throw httpError(400, `Unknown event type ${params.event_type}`);
  }
  await col(ESIGN_COLLECTIONS.events).insertOne({
    id: randomUUID(),
    request_id: params.request_id,
    document_id: params.document_id,
    signer_id: params.signer_id ?? null,
    event_type: params.event_type,
    timestamp: nowIso(),
    ip: params.ip ?? null,
    user_agent: params.user_agent ?? null,
    meta: params.meta ?? {},
  });
}

// ---------------------------------------------------------------------------
// Create generated document from template + merge fields
// ---------------------------------------------------------------------------

export async function createGeneratedDocument(
  input: CreateDocumentInput,
  actor: Doc,
): Promise<Doc> {
  if (!DOCUMENT_TYPES.includes(input.type)) {
    throw httpError(400, `Unknown document type ${input.type}`);
  }

  // Staff must have case access when a case is named (prevents cross-client leakage).
  let kase: Doc | null = null;
  if (input.case_id) {
    kase = await getCase(input.case_id, actor);
  }

  const tpl = await requireTemplate({
    id: input.template_id ?? undefined,
    type: input.template_id ? undefined : input.type,
  });

  const merge = { ...(input.merge_fields || {}) };
  // Prefer case / period context when not supplied in merge fields.
  if (kase) {
    merge.client_name = merge.client_name ?? kase.client_name ?? input.client_name;
    merge.case_ref = merge.case_ref ?? kase.case_ref;
    merge.tax_year = merge.tax_year ?? kase.tax_year;
  }

  const calculationHash = hashPayload({
    type: input.type,
    case_id: input.case_id ?? null,
    mtd_period_id: input.mtd_period_id ?? null,
    calculation_version_id: input.calculation_version_id ?? null,
    merge,
  });
  merge.calculation_hash = calculationHash;

  const title = renderMerge(tpl.title, merge);
  const body = renderMerge(tpl.body_markdown, merge);
  const now = nowIso();

  // Supersede prior DRAFT/READY docs for the same case+type+period so only one active pack.
  const supersedeQ: Doc = {
    type: input.type,
    status: { $in: ["DRAFT", "READY", "SENT"] },
  };
  if (input.case_id) supersedeQ.case_id = input.case_id;
  if (input.mtd_period_id) supersedeQ.mtd_period_id = input.mtd_period_id;
  await col(ESIGN_COLLECTIONS.documents).updateMany(supersedeQ, {
    $set: { status: "SUPERSEDED", updated_at: now },
  });

  const version =
    (await col(ESIGN_COLLECTIONS.documents).countDocuments({
      case_id: input.case_id ?? null,
      type: input.type,
      mtd_period_id: input.mtd_period_id ?? null,
    })) + 1;

  const doc: GeneratedDocument = {
    id: randomUUID(),
    template_id: tpl.id,
    template_version: tpl.version,
    type: input.type,
    client_id: input.client_id ?? kase?.client_id ?? null,
    client_user_id: input.client_user_id ?? kase?.client_user_id ?? null,
    client_name: (merge.client_name as string) ?? input.client_name ?? kase?.client_name ?? null,
    case_id: input.case_id ?? null,
    mtd_period_id: input.mtd_period_id ?? null,
    tax_period_label:
      input.tax_period_label ??
      (merge.period_label as string) ??
      (merge.tax_year as string) ??
      null,
    calculation_version_id: input.calculation_version_id ?? null,
    calculation_hash: calculationHash,
    merge_payload: merge,
    title,
    body_rendered: body,
    status: "READY",
    version,
    signed_at: null,
    signed_pdf_key: null,
    certificate_html: null,
    firm_id: input.firm_id ?? null,
    created_by: actor.id,
    created_at: now,
    updated_at: now,
  };

  await col(ESIGN_COLLECTIONS.documents).insertOne({ ...doc });
  if (doc.case_id) {
    await logActivity(doc.case_id, "E-sign document generated", actor, {
      document_id: doc.id,
      type: doc.type,
      calculation_hash: doc.calculation_hash,
    });
  }
  return clean(doc as Doc) as Doc;
}

// ---------------------------------------------------------------------------
// Create + optionally send signature request
// ---------------------------------------------------------------------------

function validateSigner(s: SignerInput, index: number): void {
  if (!s.name?.trim()) throw httpError(422, `signers[${index}].name is required`);
  if (!s.email?.includes("@")) throw httpError(422, `signers[${index}].email is invalid`);
  if (s.role && !SIGNER_ROLES.includes(s.role)) {
    throw httpError(422, `signers[${index}].role is invalid`);
  }
  if (s.auth_method && !AUTH_METHODS.includes(s.auth_method)) {
    throw httpError(422, `signers[${index}].auth_method is invalid`);
  }
}

export async function createSignatureRequest(
  input: CreateRequestInput,
  actor: Doc,
): Promise<Doc> {
  const document = await getDocument(input.document_id);
  if (!["READY", "SENT"].includes(document.status)) {
    throw httpError(400, `Document status ${document.status} cannot be sent for signature`);
  }
  if (document.case_id) await getCase(document.case_id, actor);

  if (!input.signers?.length) throw httpError(422, "At least one signer is required");
  input.signers.forEach(validateSigner);

  const channels = (input.channels?.length ? input.channels : ["EMAIL"]) as DeliveryChannel[];
  for (const ch of channels) {
    if (!DELIVERY_CHANNELS.includes(ch)) throw httpError(422, `Unknown channel ${ch}`);
    // TODO(sms): when SMS delivery is enabled, validate signer phone numbers here.
    if (ch === "SMS") {
      // Scaffold accepts the channel but sendInvitations no-ops with a recorded event.
    }
  }

  const now = nowIso();
  const expiresAt = input.expires_at || defaultExpiryIso(DEFAULT_EXPIRY_DAYS);
  const request: Doc = {
    id: randomUUID(),
    document_id: document.id,
    case_id: document.case_id,
    mtd_period_id: document.mtd_period_id,
    client_user_id: document.client_user_id,
    status: "DRAFT" as RequestStatus,
    sent_at: null,
    expires_at: expiresAt,
    completed_at: null,
    channels,
    message: input.message ?? null,
    payment_redirect_url: input.payment_redirect_url ?? null,
    created_by: actor.id,
    created_at: now,
    updated_at: now,
  };
  await col(ESIGN_COLLECTIONS.requests).insertOne(request);

  const rawTokens: { signerId: string; token: string; email: string; name: string }[] = [];
  for (let i = 0; i < input.signers.length; i++) {
    const s = input.signers[i];
    const raw = mintSigningToken();
    const signer: Doc = {
      id: randomUUID(),
      request_id: request.id,
      document_id: document.id,
      name: s.name.trim(),
      email: s.email.trim().toLowerCase(),
      role: s.role ?? "CLIENT",
      auth_method: s.auth_method ?? "EMAIL_LINK",
      status: "PENDING",
      token_hash: hashToken(raw),
      token_expires_at: expiresAt,
      invited_at: null,
      viewed_at: null,
      signed_at: null,
      signature_type: null,
      signature_data: null,
      consent_text: null,
      consent_accepted: false,
      otp_challenge_id: null,
      sort_order: s.sort_order ?? i,
      created_at: now,
    };
    await col(ESIGN_COLLECTIONS.signers).insertOne(signer);
    rawTokens.push({ signerId: signer.id, token: raw, email: signer.email, name: signer.name });
  }

  await recordEvent({
    request_id: request.id,
    document_id: document.id,
    event_type: "CREATED",
    meta: { signer_count: input.signers.length, actor_id: actor.id },
  });

  if (input.send_now !== false) {
    await sendInvitations(request.id, actor, rawTokens);
  }

  return decorateRequest(request.id);
}

function appBaseUrl(): string {
  return (env("APP_BASE_URL") ?? "").replace(/\/$/, "") || "http://localhost:3000";
}

/**
 * Deliver signing invitations.
 * Email is implemented; SMS is a deliberate stub so the channel can be added later
 * without changing the SignatureRequest / Signer schema.
 */
export async function sendInvitations(
  requestId: string,
  actor: Doc,
  preMinted?: { signerId: string; token: string; email: string; name: string }[],
): Promise<Doc> {
  const request = await getRequest(requestId);
  if (["SIGNED", "CANCELLED", "DECLINED"].includes(request.status)) {
    throw httpError(400, `Cannot send invitations for status ${request.status}`);
  }
  if (new Date(request.expires_at).getTime() < Date.now()) {
    await expireRequest(request);
    throw httpError(400, "Signature request has expired");
  }

  const document = await getDocument(request.document_id);
  const signers = await signersFor(requestId);
  const tokenBySigner = new Map((preMinted || []).map((t) => [t.signerId, t.token]));

  // Tokens are only available at create-time. Re-sends without preMinted rotate the token.
  for (const signer of signers) {
    if (signer.status === "SIGNED") continue;
    let raw = tokenBySigner.get(signer.id);
    if (!raw) {
      raw = mintSigningToken();
      await col(ESIGN_COLLECTIONS.signers).updateOne(
        { id: signer.id },
        {
          $set: {
            token_hash: hashToken(raw),
            token_expires_at: request.expires_at,
            status: "INVITED",
            invited_at: nowIso(),
          },
        },
      );
    } else {
      await col(ESIGN_COLLECTIONS.signers).updateOne(
        { id: signer.id },
        { $set: { status: "INVITED", invited_at: nowIso() } },
      );
    }

    const signUrl = `${appBaseUrl()}/sign/${raw}`;

    if (request.channels.includes("EMAIL")) {
      await queueEmail({
        to: signer.email,
        recipientName: signer.name,
        kind: "ESIGN_INVITATION",
        title: `Please sign: ${document.title}`,
        body:
          request.message ||
          `You have been asked to review and sign "${document.title}". This link expires on ${new Date(request.expires_at).toLocaleDateString("en-GB")}.`,
        link: signUrl,
        callToAction: "Review and sign",
        dedupeKey: `esign-invite:${request.id}:${signer.id}:${signer.invited_at || nowIso()}`,
        userId: document.client_user_id,
        caseId: document.case_id,
      });
    }

    if (request.channels.includes("SMS")) {
      // TODO(sms): integrate SMS provider (e.g. Twilio) — store phone on Signer and
      // deliver a short link. Until then we only record intent in the audit trail.
      await recordEvent({
        request_id: request.id,
        document_id: document.id,
        signer_id: signer.id,
        event_type: "SENT",
        meta: { channel: "SMS", stub: true, note: "SMS delivery not configured" },
      });
    }

    if (request.channels.includes("IN_APP") && document.client_user_id) {
      await notify(
        document.client_user_id,
        "Document ready to sign",
        document.title,
        document.case_id,
        signUrl,
        "APPROVAL",
      );
    }

    await recordEvent({
      request_id: request.id,
      document_id: document.id,
      signer_id: signer.id,
      event_type: "SENT",
      meta: { channel: "EMAIL", actor_id: actor.id },
    });
  }

  const now = nowIso();
  await col(ESIGN_COLLECTIONS.requests).updateOne(
    { id: requestId },
    { $set: { status: "SENT", sent_at: request.sent_at || now, updated_at: now } },
  );
  await col(ESIGN_COLLECTIONS.documents).updateOne(
    { id: document.id },
    { $set: { status: "SENT", updated_at: now } },
  );

  // Move SA/MTD case into AWAITING_CLIENT_APPROVAL when staff release for e-sign.
  if (document.case_id && !document.mtd_period_id) {
    try {
      const kase = await getCase(document.case_id, actor);
      if (kase.status === "ADMIN_APPROVED") {
        await transition(kase, "AWAITING_CLIENT_APPROVAL", actor, "Sent for e-signature approval");
      }
    } catch {
      /* transition may already be past this stage */
    }
  }
  if (document.mtd_period_id) {
    // MTD periods use their own status machine; mark awaiting client when sent.
    await col("mtd_periods").updateOne(
      { id: document.mtd_period_id, status: { $in: ["ADMIN_REVIEW", "IN_PROGRESS", "ADMIN_APPROVED"] } },
      {
        $set: {
          status: "AWAITING_CLIENT_APPROVAL",
          next_action: "Client to e-sign quarterly update",
          next_action_owner: "CLIENT",
          last_updated: now,
          esign_request_id: requestId,
        },
      },
    );
  }

  if (document.case_id) {
    await logActivity(document.case_id, "E-sign invitations sent", actor, {
      request_id: requestId,
      document_id: document.id,
    });
  }

  return decorateRequest(requestId);
}

async function expireRequest(request: Doc): Promise<void> {
  const now = nowIso();
  await col(ESIGN_COLLECTIONS.requests).updateOne(
    { id: request.id },
    { $set: { status: "EXPIRED", updated_at: now } },
  );
  await col(ESIGN_COLLECTIONS.signers).updateMany(
    { request_id: request.id, status: { $nin: ["SIGNED"] } },
    { $set: { status: "EXPIRED" } },
  );
  await recordEvent({
    request_id: request.id,
    document_id: request.document_id,
    event_type: "EXPIRED",
  });
}

// ---------------------------------------------------------------------------
// Status / list
// ---------------------------------------------------------------------------

export async function decorateRequest(requestId: string): Promise<Doc> {
  const request = await getRequest(requestId);
  const document = await getDocument(request.document_id);
  const signers = await signersFor(requestId);
  // Never expose token_hash to API consumers.
  const safeSigners = signers.map((s) => {
    const { token_hash: _t, ...rest } = s;
    return rest;
  });
  const events = await eventsFor(requestId);
  return {
    ...request,
    document,
    signers: safeSigners,
    events,
    consent_text: HMRC_CONSENT_TEXT,
  };
}

export async function listRequests(
  actor: Doc,
  filters: {
    status?: string;
    case_id?: string;
    mtd_period_id?: string;
    awaiting?: boolean;
    ready_to_file?: boolean;
  } = {},
): Promise<Doc[]> {
  const q: Doc = {};
  if (filters.status) q.status = filters.status;
  if (filters.case_id) {
    await getCase(filters.case_id, actor);
    q.case_id = filters.case_id;
  }
  if (filters.mtd_period_id) q.mtd_period_id = filters.mtd_period_id;
  if (filters.awaiting) q.status = { $in: ["SENT", "VIEWED", "PARTIALLY_SIGNED"] };
  if (filters.ready_to_file) q.status = "SIGNED";

  if (actor.role === "ACCOUNTANT" && !filters.case_id) {
    const cases = await col("cases")
      .find({ assigned_accountant_id: actor.id }, { projection: { id: 1 } })
      .toArray();
    q.case_id = { $in: cases.map((c) => c.id) };
  }

  const rows = await col(ESIGN_COLLECTIONS.requests)
    .find(q)
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();

  const out: Doc[] = [];
  for (const r of rows) {
    const document = await col(ESIGN_COLLECTIONS.documents).findOne({ id: r.document_id });
    const signers = await signersFor(r.id);
    out.push({
      ...clean(r),
      document: clean(document),
      signers: signers.map(({ token_hash: _t, ...rest }) => rest),
    });
  }
  return out;
}

export async function dashboardWidgets(actor: Doc): Promise<Doc> {
  const awaiting = await listRequests(actor, { awaiting: true });
  const ready = await listRequests(actor, { ready_to_file: true });
  return {
    awaiting_signature: awaiting,
    approved_ready_to_file: ready,
    counts: {
      awaiting_signature: awaiting.length,
      approved_ready_to_file: ready.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Public signing (token-gated)
// ---------------------------------------------------------------------------

export async function resolveSignerByToken(rawToken: string): Promise<{
  signer: Doc;
  request: Doc;
  document: Doc;
}> {
  if (!rawToken || rawToken.length < 20) throw httpError(404, "Signing link not found");
  const signer = (await col(ESIGN_COLLECTIONS.signers).findOne({
    token_hash: hashToken(rawToken),
  })) as Doc | null;
  if (!signer) throw httpError(404, "Signing link not found");

  const request = await getRequest(signer.request_id);
  const document = await getDocument(signer.document_id);

  if (["CANCELLED", "DECLINED"].includes(request.status)) {
    throw httpError(410, "This signature request is no longer available");
  }
  if (
    new Date(signer.token_expires_at).getTime() < Date.now() ||
    new Date(request.expires_at).getTime() < Date.now()
  ) {
    if (request.status !== "EXPIRED") await expireRequest(request);
    throw httpError(410, "This signing link has expired");
  }

  return { signer: clean(signer) as Doc, request, document };
}

/** Public package for the embedded signing page (no auth cookie required). */
export async function getSigningPackage(rawToken: string, meta: { ip?: string; ua?: string }) {
  const { signer, request, document } = await resolveSignerByToken(rawToken);

  // First view → VIEWED on signer + request (if still SENT).
  if (!signer.viewed_at && signer.status !== "SIGNED") {
    const now = nowIso();
    await col(ESIGN_COLLECTIONS.signers).updateOne(
      { id: signer.id },
      { $set: { viewed_at: now, status: "VIEWED" } },
    );
    if (["SENT", "DRAFT"].includes(request.status)) {
      await col(ESIGN_COLLECTIONS.requests).updateOne(
        { id: request.id },
        { $set: { status: "VIEWED", updated_at: now } },
      );
    }
    await recordEvent({
      request_id: request.id,
      document_id: document.id,
      signer_id: signer.id,
      event_type: "VIEWED",
      ip: meta.ip,
      user_agent: meta.ua,
    });
    signer.viewed_at = now;
    signer.status = "VIEWED";
  }

  // TODO(white-label): load esign_firm_branding by document.firm_id for logo/colours.
  const branding = document.firm_id
    ? await col(ESIGN_COLLECTIONS.branding).findOne({ firm_id: document.firm_id })
    : null;

  return {
    request_id: request.id,
    status: request.status,
    expires_at: request.expires_at,
    already_signed: signer.status === "SIGNED",
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      role: signer.role,
      status: signer.status,
      auth_method: signer.auth_method,
    },
    document: {
      id: document.id,
      type: document.type,
      title: document.title,
      body_rendered: document.body_rendered,
      calculation_hash: document.calculation_hash,
      tax_period_label: document.tax_period_label,
      client_name: document.client_name,
      version: document.version,
    },
    consent_text: HMRC_CONSENT_TEXT,
    branding: branding
      ? clean(branding)
      : { firm_name: "TaxSimba", primary_colour: "#006B3C", logo_url: null },
    /**
     * TODO(otp): when auth_method is OTP_EMAIL / OTP_SMS, require a verified challenge
     * before returning body_rendered / accepting a signature.
     */
    otp_required: ["OTP_EMAIL", "OTP_SMS"].includes(signer.auth_method),
  };
}

export async function completeSignature(
  rawToken: string,
  input: SignInput,
  meta: { ip?: string; ua?: string },
): Promise<Doc> {
  const { signer, request, document } = await resolveSignerByToken(rawToken);

  if (signer.status === "SIGNED") {
    throw httpError(400, "You have already signed this document");
  }
  if (!input.consent_accepted) {
    throw httpError(400, "You must accept the consent statement to sign");
  }
  if (!["DRAWN", "TYPED", "CLICK"].includes(input.signature_type)) {
    throw httpError(422, "Invalid signature_type");
  }
  if (input.signature_type === "TYPED" && !input.typed_name?.trim() && !input.signature_data) {
    throw httpError(422, "Typed signature requires your name");
  }

  // TODO(otp): verify otp_challenge_id before accepting signature when auth_method requires it.

  const now = nowIso();
  const signatureData =
    input.signature_data ||
    (input.signature_type === "CLICK"
      ? `CLICK:${signer.name}`
      : input.typed_name?.trim() || signer.name);

  await col(ESIGN_COLLECTIONS.signers).updateOne(
    { id: signer.id },
    {
      $set: {
        status: "SIGNED",
        signed_at: now,
        signature_type: input.signature_type,
        signature_data: signatureData,
        consent_text: HMRC_CONSENT_TEXT,
        consent_accepted: true,
      },
    },
  );

  await recordEvent({
    request_id: request.id,
    document_id: document.id,
    signer_id: signer.id,
    event_type: "CONSENTED",
    ip: meta.ip,
    user_agent: meta.ua,
    meta: { consent_text: HMRC_CONSENT_TEXT },
  });
  await recordEvent({
    request_id: request.id,
    document_id: document.id,
    signer_id: signer.id,
    event_type: "SIGNED",
    ip: meta.ip,
    user_agent: meta.ua,
    meta: { signature_type: input.signature_type },
  });

  const allSigners = await signersFor(request.id);
  const signedCount = allSigners.filter((s) =>
    s.id === signer.id ? true : s.status === "SIGNED",
  ).length;
  const allDone = signedCount >= allSigners.length;

  if (allDone) {
    const certificate = buildCertificateHtml({
      document,
      request,
      signers: allSigners.map((s) =>
        s.id === signer.id
          ? {
              ...s,
              status: "SIGNED",
              signed_at: now,
              signature_type: input.signature_type,
              signature_data: signatureData,
              consent_accepted: true,
            }
          : s,
      ),
      events: await eventsFor(request.id),
    });

    await col(ESIGN_COLLECTIONS.requests).updateOne(
      { id: request.id },
      { $set: { status: "SIGNED", completed_at: now, updated_at: now } },
    );
    await col(ESIGN_COLLECTIONS.documents).updateOne(
      { id: document.id },
      {
        $set: {
          status: "SIGNED",
          signed_at: now,
          certificate_html: certificate,
          updated_at: now,
        },
      },
    );

    await applyPostSignHooks(document, request, {
      id: "system",
      name: "E-sign",
      role: "SYSTEM",
    });

    // TODO(payments): if request.payment_redirect_url is set, surface it to the
    // signing UI so the client can be redirected after completion.
  } else {
    await col(ESIGN_COLLECTIONS.requests).updateOne(
      { id: request.id },
      { $set: { status: "PARTIALLY_SIGNED", updated_at: now } },
    );
  }

  return {
    status: allDone ? "SIGNED" : "PARTIALLY_SIGNED",
    all_signed: allDone,
    payment_redirect_url: allDone ? request.payment_redirect_url : null,
    request: await decorateRequest(request.id),
  };
}

/**
 * Post-sign hooks for tax/MTD workflows:
 * 1. Mark tax job as Approved (CLIENT_APPROVED / MTD APPROVED).
 * 2. Lock figures for filing (immutable flag on calc / period).
 * 3. Enable Ready for submission so "Submit to HMRC" becomes available.
 */
async function applyPostSignHooks(document: Doc, request: Doc, systemUser: Doc): Promise<void> {
  const now = nowIso();

  if (document.mtd_period_id) {
    await col("mtd_periods").updateOne(
      { id: document.mtd_period_id },
      {
        $set: {
          status: "APPROVED",
          client_approved_at: now,
          figures_locked: true,
          esign_request_id: request.id,
          esign_document_id: document.id,
          esign_calculation_hash: document.calculation_hash,
          next_action: "Submit update to HMRC",
          next_action_owner: "ADMIN",
          last_updated: now,
        },
      },
    );
    // Mirror into case activity when linked.
    if (document.case_id) {
      await logActivity(document.case_id, "MTD period e-signed and figures locked", systemUser, {
        mtd_period_id: document.mtd_period_id,
        request_id: request.id,
        calculation_hash: document.calculation_hash,
      });
      if (document.client_user_id) {
        // Notify assigned accountant via case.
        const kase = (await col("cases").findOne({ id: document.case_id })) as Doc | null;
        if (kase?.assigned_accountant_id) {
          await notify(
            kase.assigned_accountant_id,
            "MTD update signed",
            `${document.client_name || "Client"} signed ${document.tax_period_label || "period"}. Ready to file.`,
            document.case_id,
            `/work/cases/${document.case_id}?tab=MTD%20Periods`,
            "APPROVAL",
          );
        }
      }
    }
    return;
  }

  if (!document.case_id) return;

  const kase = (await col("cases").findOne({ id: document.case_id })) as Doc | null;
  if (!kase) return;

  // Record a client_approvals row compatible with the existing SA approval trail.
  await col("client_approvals").insertOne({
    id: randomUUID(),
    case_id: document.case_id,
    client_user_id: document.client_user_id,
    client_name: document.client_name,
    calculation_version_id: document.calculation_version_id,
    version: document.merge_payload?.calculation_version ?? document.version,
    confirmation: HMRC_CONSENT_TEXT,
    approved_at: now,
    esign_request_id: request.id,
    esign_document_id: document.id,
    calculation_hash: document.calculation_hash,
  });

  // Lock the calculation snapshot so figures cannot change before HMRC submit.
  if (document.calculation_version_id) {
    await col("calculation_versions").updateOne(
      { id: document.calculation_version_id },
      {
        $set: {
          figures_locked: true,
          locked_at: now,
          locked_by_esign_request_id: request.id,
          locked_hash: document.calculation_hash,
        },
      },
    );
  }

  const actor: Doc = {
    id: document.client_user_id || systemUser.id,
    name: document.client_name || "Client",
    role: "CLIENT",
  };

  if (["ADMIN_APPROVED", "AWAITING_CLIENT_APPROVAL"].includes(kase.status)) {
    await transition(kase, "CLIENT_APPROVED", actor, "Client e-signed approval document", {
      extra: {
        client_approved_at: now,
        figures_locked: true,
        esign_request_id: request.id,
        approved_version: document.merge_payload?.calculation_version ?? null,
      },
    });
    const blocking = await col("tasks").countDocuments({
      case_id: document.case_id,
      status: "OPEN",
    });
    if (!blocking) {
      await transition(kase, "READY_FOR_SUBMISSION", actor, "E-sign complete — ready for HMRC");
      await col("submission_records").insertOne({
        id: randomUUID(),
        case_id: document.case_id,
        status: "READY",
        calculation_version_id: document.calculation_version_id,
        reference: null,
        esign_request_id: request.id,
        created_at: now,
      });
    }
  }

  if (kase.assigned_accountant_id) {
    await notify(
      kase.assigned_accountant_id,
      "Return e-signed by client",
      `${document.client_name || "Client"} signed ${document.title}.`,
      document.case_id,
      `/work/cases/${document.case_id}`,
      "APPROVAL",
    );
  }
}

// ---------------------------------------------------------------------------
// Certificate + download
// ---------------------------------------------------------------------------

/**
 * Appendable "signature certificate" page — evidence pack for eIDAS-style
 * simple electronic signatures and HMRC supporting records.
 *
 * TODO(legal): have compliance review the certificate fields and retention policy
 * (GDPR storage limitation vs HMRC record-keeping periods).
 */
export function buildCertificateHtml(params: {
  document: Doc;
  request: Doc;
  signers: Doc[];
  events: Doc[];
}): string {
  const { document, request, signers, events } = params;
  const signerRows = signers
    .map(
      (s) =>
        `<tr><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.role)}</td>` +
        `<td>${esc(s.signed_at || "—")}</td><td>${esc(s.signature_type || "—")}</td></tr>`,
    )
    .join("");
  const eventRows = events
    .map(
      (e) =>
        `<tr><td>${esc(e.timestamp)}</td><td>${esc(e.event_type)}</td>` +
        `<td>${esc(e.ip || "—")}</td><td>${esc(trunc(e.user_agent, 80))}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Signature certificate</title>
<style>
body{font-family:Georgia,serif;color:#1B2A22;max-width:720px;margin:40px auto;padding:0 16px}
h1{color:#006B3C;font-size:22px}h2{font-size:16px;margin-top:28px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th,td{border:1px solid #E3E7E4;padding:6px 8px;text-align:left}
th{background:#F1F8F4}code{font-size:11px;word-break:break-all}
.note{font-size:11px;color:#626A65;margin-top:24px}
</style></head><body>
<h1>Signature certificate</h1>
<p>This certificate forms part of the audit evidence for an electronic signature
executed within TaxSimba. It is designed to support eIDAS-style simple electronic
signatures and HMRC record-keeping practice.</p>
<h2>Document</h2>
<ul>
<li><strong>Title:</strong> ${esc(document.title)}</li>
<li><strong>Type:</strong> ${esc(document.type)}</li>
<li><strong>Document ID:</strong> ${esc(document.id)}</li>
<li><strong>Version:</strong> ${esc(String(document.version))}</li>
<li><strong>Document / calculation hash (SHA-256):</strong><br/><code>${esc(document.calculation_hash)}</code></li>
<li><strong>Client:</strong> ${esc(document.client_name || "—")}</li>
<li><strong>Period:</strong> ${esc(document.tax_period_label || "—")}</li>
<li><strong>Case ID:</strong> ${esc(document.case_id || "—")}</li>
<li><strong>MTD period ID:</strong> ${esc(document.mtd_period_id || "—")}</li>
</ul>
<h2>Request</h2>
<ul>
<li><strong>Request ID:</strong> ${esc(request.id)}</li>
<li><strong>Sent:</strong> ${esc(request.sent_at || "—")}</li>
<li><strong>Completed:</strong> ${esc(request.completed_at || "—")}</li>
<li><strong>Expires:</strong> ${esc(request.expires_at)}</li>
<li><strong>Consent:</strong> ${esc(HMRC_CONSENT_TEXT)}</li>
</ul>
<h2>Signers</h2>
<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Signed at</th><th>Method</th></tr></thead>
<tbody>${signerRows}</tbody></table>
<h2>Event timeline</h2>
<table><thead><tr><th>Timestamp</th><th>Event</th><th>IP</th><th>User agent</th></tr></thead>
<tbody>${eventRows}</tbody></table>
<p class="note">Retention: store alongside the tax working papers for at least the HMRC
enquiry window. TODO(legal): confirm retention schedule with DPO / compliance.</p>
</body></html>`;
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trunc(v: unknown, n: number): string {
  const s = String(v ?? "");
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Download bundle: rendered document body + certificate.
 * Returns HTML today; swap for a real PDF (pdfkit / headless Chromium) without
 * changing the route contract — Content-Type becomes application/pdf.
 *
 * TODO(pdf): generate a true multi-page PDF and persist to object storage
 * (signed_pdf_key on GeneratedDocument).
 */
export async function buildDownloadBundle(requestId: string, actor: Doc): Promise<{
  filename: string;
  contentType: string;
  body: Buffer;
  request: Doc;
}> {
  const decorated = await decorateRequest(requestId);
  if (decorated.case_id) await getCase(decorated.case_id, actor);
  else if (actor.role === "ACCOUNTANT") {
    throw httpError(403, "Not authorised to download this request");
  }

  const document = decorated.document as Doc;
  const certificate =
    document.certificate_html ||
    buildCertificateHtml({
      document,
      request: decorated,
      signers: decorated.signers,
      events: decorated.events,
    });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(document.title)}</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1B2A22}
pre{white-space:pre-wrap;font-family:Georgia,serif;line-height:1.5}
hr{border:none;border-top:1px solid #E3E7E4;margin:48px 0}</style></head><body>
<h1>${esc(document.title)}</h1>
<pre>${esc(document.body_rendered)}</pre>
<hr/>
${certificate.replace(/^<!DOCTYPE html>[\s\S]*<body>/, "").replace(/<\/body><\/html>$/, "")}
</body></html>`;

  await recordEvent({
    request_id: requestId,
    document_id: document.id,
    event_type: "DOWNLOADED",
    meta: { actor_id: actor.id },
  });

  const safeName = String(document.title || "signed-document")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .slice(0, 60)
    .trim()
    .replace(/\s+/g, "-");

  return {
    filename: `${safeName || "signed-document"}-certificate.html`,
    contentType: "text/html; charset=utf-8",
    body: Buffer.from(html, "utf8"),
    request: decorated,
  };
}

export async function listTemplates(type?: string): Promise<Doc[]> {
  const q: Doc = { is_active: true };
  if (type) q.type = type;
  return cleanMany(
    await col(ESIGN_COLLECTIONS.templates).find(q).sort({ type: 1, name: 1 }).toArray(),
  );
}

/** Ensure REQUEST_STATUSES typing is referenced (avoids unused import in some tsconfigs). */
export const _statusGuard = REQUEST_STATUSES;
