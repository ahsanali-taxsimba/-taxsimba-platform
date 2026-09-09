/**
 * Engagement / client-care agreement acceptance (P0 K.4 / baseline G1).
 * Minimal persisted record — does not activate services or create cases.
 */
import { createHash, randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { clientOf, servicesFor } from "../domain/packages";
import { nowIso } from "../domain/workflow";

export const AGREEMENT_VERSION = "client-care-v1";

function hashSignature(signature: string): string {
  return createHash("sha256").update(signature, "utf8").digest("hex");
}

export async function ensureEngagementIndexes(): Promise<void> {
  try {
    await col("engagement_acceptances").createIndex({ user_id: 1 }, { unique: true });
    await col("engagement_acceptances").createIndex({ status: 1, accepted_at: 1 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`engagement indexes skipped: ${String(e)}`);
  }
}

export async function getEngagementAcceptance(userId: string): Promise<Doc | null> {
  return (await col("engagement_acceptances").findOne({ user_id: userId })) as Doc | null;
}

export function isEngagementAccepted(row: Doc | null | undefined): boolean {
  return Boolean(row && row.status === "ACCEPTED" && row.accepted_at);
}

/** Snapshot for auth/session payloads — never invents ACTIVE entitlement. */
export async function engagementStatusForUser(user: Doc): Promise<{
  isEngagementLetterAccepted: boolean;
  engagementAcceptedAt: string | null;
  agreementVersion: string | null;
}> {
  if (user.role !== "CLIENT") {
    return {
      isEngagementLetterAccepted: false,
      engagementAcceptedAt: null,
      agreementVersion: null,
    };
  }
  const row = await getEngagementAcceptance(String(user.id));
  if (!isEngagementAccepted(row)) {
    return {
      isEngagementLetterAccepted: false,
      engagementAcceptedAt: null,
      agreementVersion: null,
    };
  }
  return {
    isEngagementLetterAccepted: true,
    engagementAcceptedAt: (row!.accepted_at as string) ?? null,
    agreementVersion: (row!.agreement_version as string) ?? AGREEMENT_VERSION,
  };
}

/**
 * Persist acceptance for the authenticated CLIENT.
 * Captures ACTIVE service_types / case_ids at accept time for audit only.
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

  const existing = await getEngagementAcceptance(String(user.id));
  if (isEngagementAccepted(existing)) {
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
  const version = (input.agreementVersion ?? AGREEMENT_VERSION).trim() || AGREEMENT_VERSION;
  const doc: Doc = {
    id: existing?.id ?? randomUUID(),
    user_id: user.id,
    client_id: client.id,
    agreement_version: version,
    status: "ACCEPTED",
    accepted_at: acceptedAt,
    signature_hash: hashSignature(signature),
    // Store signature for audit; hash is primary integrity check.
    signature,
    service_types: serviceTypes,
    case_ids: caseIds,
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
