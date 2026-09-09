/**
 * Engagement / client-care agreement acceptance (P0 K.4 / baseline G1).
 * Minimal persisted record — does not activate services or create cases.
 *
 * Contract (client-care-v1): account-level client-care acceptance. `service_types` /
 * `case_ids` are an audit snapshot of ACTIVE entitlements at accept time. A valid
 * current-version acceptance covers later ACTIVE services under the same agreement
 * version (no silent per-service invention; version changes require re-acceptance).
 */
import { createHash, randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { clientOf, servicesFor } from "../domain/packages";
import { nowIso } from "../domain/workflow";

const DEFAULT_AGREEMENT_VERSION = "client-care-v1";

/** Current required agreement version (overridable in tests via ENGAGEMENT_AGREEMENT_VERSION). */
export function requiredAgreementVersion(): string {
  const fromEnv = process.env.ENGAGEMENT_AGREEMENT_VERSION?.trim();
  return fromEnv || DEFAULT_AGREEMENT_VERSION;
}

/** @deprecated use requiredAgreementVersion() — kept for callers expecting a constant name. */
export const AGREEMENT_VERSION = DEFAULT_AGREEMENT_VERSION;

function hashSignature(signature: string): string {
  return createHash("sha256").update(signature, "utf8").digest("hex");
}

function archiveSnapshot(row: Doc, reason: string): Doc {
  return {
    id: row.id,
    agreement_version: row.agreement_version,
    status: row.status,
    accepted_at: row.accepted_at,
    signature_hash: row.signature_hash,
    signature: row.signature,
    service_types: row.service_types ?? [],
    case_ids: row.case_ids ?? [],
    audit: row.audit ?? null,
    archived_at: nowIso(),
    reason,
  };
}

export async function ensureEngagementIndexes(): Promise<void> {
  try {
    await col("engagement_acceptances").createIndex({ user_id: 1 }, { unique: true });
    await col("engagement_acceptances").createIndex({ status: 1, accepted_at: 1 });
    await col("engagement_acceptances").createIndex({ agreement_version: 1 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`engagement indexes skipped: ${String(e)}`);
  }
}

export async function getEngagementAcceptance(userId: string): Promise<Doc | null> {
  return (await col("engagement_acceptances").findOne({ user_id: userId })) as Doc | null;
}

/** True only when accepted under the *current* required agreement version. */
export function isEngagementAccepted(
  row: Doc | null | undefined,
  requiredVersion = requiredAgreementVersion(),
): boolean {
  return Boolean(
    row &&
      row.status === "ACCEPTED" &&
      row.accepted_at &&
      String(row.agreement_version) === requiredVersion,
  );
}

/** Snapshot for auth/session payloads — never invents ACTIVE entitlement. */
export async function engagementStatusForUser(user: Doc): Promise<{
  isEngagementLetterAccepted: boolean;
  engagementAcceptedAt: string | null;
  agreementVersion: string | null;
  requiredAgreementVersion: string;
}> {
  const required = requiredAgreementVersion();
  if (user.role !== "CLIENT") {
    return {
      isEngagementLetterAccepted: false,
      engagementAcceptedAt: null,
      agreementVersion: null,
      requiredAgreementVersion: required,
    };
  }
  const row = await getEngagementAcceptance(String(user.id));
  if (!isEngagementAccepted(row, required)) {
    return {
      isEngagementLetterAccepted: false,
      engagementAcceptedAt: null,
      // Surface stored (possibly stale) version for diagnostics; not treated as accepted.
      agreementVersion: row?.agreement_version ? String(row.agreement_version) : null,
      requiredAgreementVersion: required,
    };
  }
  return {
    isEngagementLetterAccepted: true,
    engagementAcceptedAt: (row!.accepted_at as string) ?? null,
    agreementVersion: String(row!.agreement_version),
    requiredAgreementVersion: required,
  };
}

/**
 * Persist acceptance for the authenticated CLIENT.
 * Captures ACTIVE service_types / case_ids at accept time for audit only.
 * Re-accept under a new required version archives the prior snapshot into `history`.
 */
export async function acceptEngagementLetter(
  user: Doc,
  input: { signature: string; accepted: boolean; agreementVersion?: string | null },
): Promise<Doc> {
  if (user.role !== "CLIENT") throw httpError(403, "Only clients can accept the engagement letter");
  if (!input.accepted) throw httpError(400, "Acceptance is required");
  const signature = (input.signature ?? "").trim();
  if (!signature) throw httpError(400, "Signature is required");
  if (signature.length > 1_500_000) throw httpError(400, "Signature is too large");

  const required = requiredAgreementVersion();
  // Clients cannot self-assert an arbitrary version — always persist the required current version.
  if (input.agreementVersion != null && String(input.agreementVersion).trim()) {
    const requested = String(input.agreementVersion).trim();
    if (requested !== required) {
      throw httpError(400, `Agreement version must be ${required}`);
    }
  }

  const existing = await getEngagementAcceptance(String(user.id));
  if (isEngagementAccepted(existing, required)) {
    // Idempotent for the current version — do not rewrite the audit record.
    return existing as Doc;
  }

  const client = await clientOf(user);
  const services = await servicesFor(client);
  const active = services.filter((s) => s.status === "ACTIVE");
  // G2: engagement is post-purchase — require at least one ACTIVE entitlement.
  if (!active.length) {
    throw httpError(
      400,
      "An active service is required before accepting the engagement letter",
    );
  }
  const serviceTypes = active.map((s) => s.service_type);
  const caseIds: string[] = [];
  for (const s of active) {
    for (const c of (s.cases as Doc[] | undefined) ?? []) {
      if (c?.id) caseIds.push(String(c.id));
    }
  }

  const acceptedAt = nowIso();
  const priorHistory = Array.isArray(existing?.history) ? [...(existing!.history as Doc[])] : [];
  if (existing && existing.accepted_at) {
    priorHistory.push(
      archiveSnapshot(
        existing,
        existing.agreement_version === required
          ? "reaccepted_same_version"
          : "superseded_by_new_version",
      ),
    );
  }

  const doc: Doc = {
    id: existing?.id ?? randomUUID(),
    user_id: user.id,
    client_id: client.id,
    agreement_version: required,
    status: "ACCEPTED",
    accepted_at: acceptedAt,
    signature_hash: hashSignature(signature),
    signature,
    service_types: serviceTypes,
    case_ids: caseIds,
    history: priorHistory,
    audit: {
      accepted_by_user_id: user.id,
      accepted_by_email: user.email,
      accepted_by_name: user.name,
      ip: null,
      source: "client/accept-engagement-letter",
    },
    created_at: existing?.created_at ?? acceptedAt,
    updated_at: acceptedAt,
  };

  if (existing) {
    await col("engagement_acceptances").updateOne(
      { user_id: user.id },
      { $set: { ...doc, id: existing.id } },
    );
    return { ...doc, id: existing.id };
  }
  await col("engagement_acceptances").insertOne({ ...doc });
  return doc;
}
