/**
 * Engagement Letter service — generate, fetch, sign, and gate tax/MTD work.
 *
 * Replaces any prior “Client Care Letter” onboarding step: after a service is
 * purchased/activated the client must e-sign this letter before filing/MTD
 * actions are allowed.
 */
import { randomUUID } from "crypto";

import {
  ENGAGEMENT_COLLECTIONS,
  ENGAGEMENT_TEMPLATE_VERSION,
  EngagementLetter,
  EngagementSchedule,
  bodyToHtml,
  buildOurRef,
  buildScheduleLine,
  firmDefaults,
  formatLetterDate,
  hashBody,
  newEngagementId,
  parseAddressLines,
  parseClientName,
  renderEngagementBody,
  SERVICE_SCHEDULE_LABELS,
} from "../domain/engagementLetter";
import { ESIGN_COLLECTIONS, HMRC_CONSENT_TEXT, hashPayload } from "../domain/esign";
import { nowIso, logActivity, notify } from "../domain/workflow";
import { clean, cleanMany, col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { assertAmlApproved } from "./aml";
import { MTD, SELF_ASSESSMENT, SERVICE_LABELS } from "./clientServices";

const CONSENT =
  "I acknowledge receipt of this engagement letter and agree to the letter, the attached schedules of services, and the terms of business.";

// ---------------------------------------------------------------------------
// Active services → schedules
// ---------------------------------------------------------------------------

export async function activeServiceRows(clientId: string): Promise<Doc[]> {
  const rows = await col("client_services")
    .find({ client_id: clientId, status: "ACTIVE" })
    .toArray();
  const out: Doc[] = [];
  for (const svc of rows) {
    const pkg = svc.package_code
      ? ((await col("packages").findOne({
          service_type: svc.service_type,
          code: svc.package_code,
        })) as Doc | null)
      : null;
    out.push({
      service_type: svc.service_type,
      service_label:
        SERVICE_SCHEDULE_LABELS[svc.service_type] ||
        SERVICE_LABELS[svc.service_type] ||
        svc.service_type,
      package_code: svc.package_code ?? null,
      package_name: pkg?.name ?? null,
      // Prefer frozen agreed_price from purchase; fall back to catalogue.
      price: svc.agreed_price ?? pkg?.price ?? null,
      billing_frequency: svc.billing_frequency ?? pkg?.billing_frequency ?? null,
    });
  }
  // Stable order: SA first, then MTD, then others.
  const rank = (t: string) => (t === SELF_ASSESSMENT ? 0 : t === MTD ? 1 : 2);
  out.sort((a, b) => rank(a.service_type) - rank(b.service_type));
  return out;
}

function schedulesFingerprint(services: Doc[]): string {
  return hashPayload(
    services.map((s) => ({
      service_type: s.service_type,
      package_code: s.package_code,
      price: s.price,
    })),
  );
}

// ---------------------------------------------------------------------------
// Generate / refresh letter instance
// ---------------------------------------------------------------------------

/**
 * Build (or refresh) a PENDING engagement letter for a client from live
 * profile + purchased services. Legal wording is never taken from request input.
 */
export async function generateEngagementLetter(
  client: Doc,
  opts: { force?: boolean; actor?: Doc | null } = {},
): Promise<Doc> {
  // Engagement / e-sign onboarding proceeds only after AML CDD is approved.
  await assertAmlApproved(client);

  const services = await activeServiceRows(client.id);
  if (!services.length) {
    throw httpError(400, "No active services to include in the engagement letter");
  }

  const existing = (await col(ENGAGEMENT_COLLECTIONS.letters).findOne(
    {
      client_id: client.id,
      status: { $in: ["PENDING_SIGNATURE", "SIGNED", "ACTIVE"] },
    },
    { sort: { created_at: -1 } },
  )) as Doc | null;

  const fp = schedulesFingerprint(services);

  // Already signed for the same service mix — return as-is unless forced.
  if (
    existing &&
    ["SIGNED", "ACTIVE"].includes(existing.status) &&
    existing.schedules_fingerprint === fp &&
    !opts.force
  ) {
    return decorateEngagement(existing.id);
  }

  // Pending letter with identical schedules — reuse.
  if (
    existing &&
    existing.status === "PENDING_SIGNATURE" &&
    existing.schedules_fingerprint === fp &&
    !opts.force
  ) {
    return decorateEngagement(existing.id);
  }

  // Supersede prior pending/active when schedules or profile force a new version.
  if (existing) {
    await col(ENGAGEMENT_COLLECTIONS.letters).updateOne(
      { id: existing.id },
      { $set: { status: "SUPERSEDED", updated_at: nowIso() } },
    );
  }

  const firm = firmDefaults();
  const names = parseClientName(client.name || "", client.title);
  const address = parseAddressLines(client.address);
  const letterDate = formatLetterDate(new Date());
  const ourRef = buildOurRef(client.client_ref);
  const yourRef = names.display_name;
  // Acceptance line in the source letter omits the dot after title: "Mr ASHLEY…"
  const acceptanceName = `${names.title} ${[names.first_name, names.middle_names, names.last_name]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()}`.replace(/\s+/g, " ");

  const scheduleDocs: EngagementSchedule[] = services.map((s, i) => {
    const sort = i + 1;
    return {
      id: randomUUID(),
      engagement_letter_id: "", // filled below
      sort_order: sort,
      service_type: s.service_type,
      service_label: s.service_label,
      package_code: s.package_code,
      package_name: s.package_name,
      price: s.price,
      billing_frequency: s.billing_frequency,
      line_text: buildScheduleLine({
        sort_order: sort,
        service_type: s.service_type,
        package_name: s.package_name,
        price: s.price,
        billing_frequency: s.billing_frequency,
      }),
      created_at: nowIso(),
    };
  });

  const schedulesBlock = scheduleDocs.map((s) => s.line_text).join("\n    \n");

  const fields: Record<string, string> = {
    client_display_name: names.display_name,
    address_block: address.block,
    your_ref: yourRef,
    our_ref: ourRef,
    letter_date: letterDate,
    dear_name: names.display_name_upper,
    primary_contact: firm.primary_contact,
    schedules_block: schedulesBlock,
    engagement_start_date: letterDate,
    firm_signatory: firm.signatory,
    firm_name: firm.firm_name,
    firm_email: firm.email,
    firm_tel: firm.tel,
    firm_tel_line: firm.tel ? `\nTel No: ${firm.tel}` : "",
    acceptance_name: acceptanceName,
    // Checkbox marker filled at sign-time; blank until then.
    early_start_marker: "☐",
  };

  const plain = renderEngagementBody(fields);
  const html = bodyToHtml(plain);
  const bodyHash = hashBody(plain);
  const id = newEngagementId();
  const now = nowIso();

  for (const s of scheduleDocs) s.engagement_letter_id = id;

  // Mirror into e-sign GeneratedDocument for unified audit / download.
  const esignDocId = randomUUID();
  await col(ESIGN_COLLECTIONS.documents).insertOne({
    id: esignDocId,
    template_id: "engagement-letter-v1",
    template_version: ENGAGEMENT_TEMPLATE_VERSION,
    type: "ENGAGEMENT_LETTER",
    client_id: client.id,
    client_user_id: client.user_id ?? null,
    client_name: client.name,
    case_id: null,
    mtd_period_id: null,
    tax_period_label: null,
    calculation_version_id: null,
    calculation_hash: bodyHash,
    merge_payload: {
      ...fields,
      schedules: scheduleDocs.map((s) => ({
        service_type: s.service_type,
        line_text: s.line_text,
        price: s.price,
      })),
      // Staff must never receive editable legal copy via this payload.
      legal_template_version: ENGAGEMENT_TEMPLATE_VERSION,
    },
    title: `Engagement letter — ${names.display_name}`,
    body_rendered: plain,
    status: "READY",
    version: 1,
    signed_at: null,
    signed_pdf_key: null,
    certificate_html: null,
    firm_id: null,
    created_by: opts.actor?.id || "system",
    created_at: now,
    updated_at: now,
  });

  const letter: EngagementLetter & { schedules_fingerprint: string; merge_fields: Doc } = {
    id,
    client_id: client.id,
    client_user_id: client.user_id ?? null,
    our_ref: ourRef,
    your_ref: yourRef,
    letter_date: letterDate,
    engagement_start_date: letterDate,
    status: "PENDING_SIGNATURE",
    body_html: html,
    body_hash: bodyHash,
    template_version: ENGAGEMENT_TEMPLATE_VERSION,
    esign_document_id: esignDocId,
    esign_request_id: null,
    signed_at: null,
    signed_name: null,
    signature_type: null,
    early_start_instructed: false,
    created_at: now,
    updated_at: now,
    schedules_fingerprint: fp,
    merge_fields: fields,
  };

  await col(ENGAGEMENT_COLLECTIONS.letters).insertOne({ ...letter });
  if (scheduleDocs.length) {
    await col(ENGAGEMENT_COLLECTIONS.schedules).insertMany(scheduleDocs.map((s) => ({ ...s })));
  }

  // Flag client record for quick gating.
  await col("clients").updateOne(
    { id: client.id },
    {
      $set: {
        engagement_status: "PENDING_SIGNATURE",
        engagement_letter_id: id,
        updated_at: now,
      },
    },
  );

  if (opts.actor && client.user_id) {
    await notify(
      client.user_id,
      "Engagement letter ready to sign",
      "Please review and sign your engagement letter to activate your services.",
      null,
      "/dashboard",
      "APPROVAL",
    );
  }

  return decorateEngagement(id);
}

export async function decorateEngagement(id: string): Promise<Doc> {
  const letter = (await col(ENGAGEMENT_COLLECTIONS.letters).findOne({ id })) as Doc | null;
  if (!letter) throw httpError(404, "Engagement letter not found");
  const schedules = cleanMany(
    await col(ENGAGEMENT_COLLECTIONS.schedules)
      .find({ engagement_letter_id: id })
      .sort({ sort_order: 1 })
      .toArray(),
  );
  return {
    ...clean(letter),
    schedules,
    consent_text: CONSENT,
    // Explicitly never expose a writable legal template to the client.
    legal_wording_editable: false,
  };
}

export async function getClientEngagement(client: Doc): Promise<Doc | null> {
  const letter = (await col(ENGAGEMENT_COLLECTIONS.letters).findOne(
    {
      client_id: client.id,
      status: { $in: ["PENDING_SIGNATURE", "SIGNED", "ACTIVE"] },
    },
    { sort: { created_at: -1 } },
  )) as Doc | null;
  if (!letter) return null;
  return decorateEngagement(letter.id);
}

/**
 * Gate helper used by filing / MTD / ServiceGuard.
 * Returns { ok, reason, engagement }.
 */
export async function engagementGate(client: Doc): Promise<{
  ok: boolean;
  reason: string | null;
  status: string | null;
  engagement_id: string | null;
  engagement: Doc | null;
}> {
  const services = await activeServiceRows(client.id);
  if (!services.length) {
    return {
      ok: true,
      reason: null,
      status: null,
      engagement_id: null,
      engagement: null,
    };
  }

  let engagement = await getClientEngagement(client);
  // Auto-generate when an active service exists but no letter yet (e.g. legacy clients).
  if (!engagement) {
    engagement = await generateEngagementLetter(client, { actor: null });
  } else {
    // Refresh if purchased services drifted since last letter.
    const fp = schedulesFingerprint(services);
    if (
      engagement.schedules_fingerprint !== fp &&
      ["SIGNED", "ACTIVE"].includes(engagement.status)
    ) {
      // TODO(legal): confirm whether schedule changes require a full re-sign.
      engagement = await generateEngagementLetter(client, { force: true });
    }
  }

  const signed = ["SIGNED", "ACTIVE"].includes(engagement.status);
  return {
    ok: signed,
    reason: signed ? null : "Engagement letter pending signature",
    status: engagement.status,
    engagement_id: engagement.id,
    engagement,
  };
}

export async function assertEngagementSigned(client: Doc): Promise<void> {
  const gate = await engagementGate(client);
  if (!gate.ok) {
    throw httpError(403, gate.reason || "Engagement letter pending signature");
  }
}

// ---------------------------------------------------------------------------
// In-app e-sign (session-authenticated client)
// ---------------------------------------------------------------------------

export async function signEngagementLetter(
  client: Doc,
  actor: Doc,
  input: {
    signature_type: "CLICK" | "TYPED" | "DRAWN";
    signature_data?: string | null;
    typed_name?: string | null;
    early_start_instructed: boolean;
    consent_accepted: boolean;
    ip?: string | null;
    user_agent?: string | null;
  },
): Promise<Doc> {
  if (actor.role !== "CLIENT" || actor.id !== client.user_id) {
    throw httpError(403, "Only the client may sign their engagement letter");
  }
  if (!input.consent_accepted) {
    throw httpError(400, "You must confirm agreement to the engagement letter");
  }

  let engagement = await getClientEngagement(client);
  if (!engagement) {
    engagement = await generateEngagementLetter(client, { actor });
  }
  if (["SIGNED", "ACTIVE"].includes(engagement.status)) {
    return engagement;
  }
  if (engagement.status !== "PENDING_SIGNATURE") {
    throw httpError(400, `Cannot sign engagement in status ${engagement.status}`);
  }

  const signedName =
    (input.typed_name || input.signature_data || client.name || "").trim() || client.name;
  const now = nowIso();
  const signatureType = input.signature_type;
  const signatureData =
    input.signature_data ||
    (signatureType === "CLICK" ? `CLICK:${signedName}` : signedName);

  // Update early-start marker in stored body for the signed artefact.
  const fields = {
    ...(engagement.merge_fields || {}),
    early_start_marker: input.early_start_instructed ? "☑" : "☐",
  };
  const plain = renderEngagementBody(fields as Record<string, string>);
  const html = bodyToHtml(plain);
  const bodyHash = hashBody(plain);

  const requestId = randomUUID();
  const signerId = randomUUID();

  await col(ESIGN_COLLECTIONS.requests).insertOne({
    id: requestId,
    document_id: engagement.esign_document_id,
    case_id: null,
    mtd_period_id: null,
    client_user_id: client.user_id,
    status: "SIGNED",
    sent_at: now,
    expires_at: now,
    completed_at: now,
    channels: ["IN_APP"],
    message: "In-app engagement letter signature (replaces Client Care Letter)",
    payment_redirect_url: null,
    created_by: actor.id,
    created_at: now,
    updated_at: now,
    engagement_letter_id: engagement.id,
  });

  await col(ESIGN_COLLECTIONS.signers).insertOne({
    id: signerId,
    request_id: requestId,
    document_id: engagement.esign_document_id,
    name: signedName,
    email: client.email || actor.email,
    role: "CLIENT",
    auth_method: "SESSION",
    status: "SIGNED",
    token_hash: hashPayload({ engagement: engagement.id, signer: signerId, at: now }),
    token_expires_at: now,
    invited_at: now,
    viewed_at: now,
    signed_at: now,
    signature_type: signatureType,
    signature_data: signatureData,
    consent_text: CONSENT,
    consent_accepted: true,
    otp_challenge_id: null,
    sort_order: 0,
    created_at: now,
  });

  for (const eventType of ["CREATED", "VIEWED", "CONSENTED", "SIGNED"] as const) {
    await col(ESIGN_COLLECTIONS.events).insertOne({
      id: randomUUID(),
      request_id: requestId,
      document_id: engagement.esign_document_id,
      signer_id: signerId,
      event_type: eventType,
      timestamp: now,
      ip: input.ip ?? null,
      user_agent: input.user_agent ?? null,
      meta: {
        engagement_letter_id: engagement.id,
        early_start_instructed: input.early_start_instructed,
        consent_text: eventType === "CONSENTED" ? CONSENT : undefined,
        note:
          eventType === "CREATED"
            ? "Replaces Client Care Letter — engagement letter e-sign"
            : undefined,
      },
    });
  }

  await col(ESIGN_COLLECTIONS.documents).updateOne(
    { id: engagement.esign_document_id },
    {
      $set: {
        status: "SIGNED",
        signed_at: now,
        body_rendered: plain,
        calculation_hash: bodyHash,
        updated_at: now,
        merge_payload: {
          ...(engagement.merge_fields || {}),
          ...fields,
          early_start_instructed: input.early_start_instructed,
        },
      },
    },
  );

  await col(ENGAGEMENT_COLLECTIONS.letters).updateOne(
    { id: engagement.id },
    {
      $set: {
        status: "ACTIVE",
        signed_at: now,
        signed_name: signedName,
        signature_type: signatureType,
        early_start_instructed: input.early_start_instructed,
        body_html: html,
        body_hash: bodyHash,
        merge_fields: fields,
        esign_request_id: requestId,
        updated_at: now,
      },
    },
  );

  await col("clients").updateOne(
    { id: client.id },
    {
      $set: {
        engagement_status: "ACTIVE",
        engagement_letter_id: engagement.id,
        engagement_signed_at: now,
        updated_at: now,
      },
    },
  );

  // Activity on each active case for staff visibility.
  const cases = await col("cases")
    .find({ client_id: client.id, service_type: { $in: [SELF_ASSESSMENT, MTD] } })
    .toArray();
  for (const kase of cases) {
    await logActivity(kase.id as string, "Engagement letter signed", actor, {
      engagement_letter_id: engagement.id,
      our_ref: engagement.our_ref,
      early_start: input.early_start_instructed,
    });
  }

  return decorateEngagement(engagement.id);
}

/**
 * Called from activateService after a purchase so the engagement letter
 * (replacing Client Care Letter) is ready for the payment-success / dashboard modal.
 */
export async function ensureEngagementAfterActivation(client: Doc): Promise<void> {
  try {
    const services = await activeServiceRows(client.id);
    if (!services.length) return;
    await generateEngagementLetter(client, { actor: null });
  } catch (e) {
    // Activation must not fail if letter generation hiccups; client can retry via GET /engagement/me.
    // eslint-disable-next-line no-console
    console.warn(`engagement letter after activation: ${String(e)}`);
  }
}

/**
 * Seed/fixture helper: mark the latest engagement ACTIVE without a UI signature.
 * Production clients must use signEngagementLetter().
 */
export async function seedMarkEngagementActive(client: Doc): Promise<void> {
  await ensureEngagementAfterActivation(client);
  const letter = await getClientEngagement(client);
  if (!letter || ["SIGNED", "ACTIVE"].includes(letter.status)) return;
  const now = nowIso();
  await col(ENGAGEMENT_COLLECTIONS.letters).updateOne(
    { id: letter.id },
    {
      $set: {
        status: "ACTIVE",
        signed_at: now,
        signed_name: client.name,
        signature_type: "SEED",
        early_start_instructed: true,
        updated_at: now,
      },
    },
  );
  await col("clients").updateOne(
    { id: client.id },
    {
      $set: {
        engagement_status: "ACTIVE",
        engagement_letter_id: letter.id,
        engagement_signed_at: now,
        updated_at: now,
      },
    },
  );
}

/** Consent text exposed to UI (not the HMRC tax-approval consent). */
export const ENGAGEMENT_CONSENT_TEXT = CONSENT;

/** Keep HMRC constant imported so engagement + tax consents stay distinct in reviews. */
export const _taxConsentDistinct = HMRC_CONSENT_TEXT;
