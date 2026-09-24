/**
 * Email verification tokens (P0 K.2).
 *
 * Tokens are stored hashed (like staff invites). Raw tokens are returned to callers that
 * send email / run tests — never persisted in plaintext.
 */
import { createHash, randomBytes, randomUUID } from "crypto";

import { env } from "../config/env";
import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { nowIso } from "../domain/workflow";
import { queueEmail } from "./email";
import { resolveEmailFirstName } from "./emailRecipient";

export const VERIFY_TTL_HOURS = 48;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function appBase(): string {
  return (env("APP_BASE_URL") ?? "https://taxsimba.co.uk").replace(/\/+$/, "");
}

export function isEmailVerified(user: Doc | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.email_verified_at);
}

/** Additive checkout/activation guard — does not change entitlement or payment domain logic. */
export function requireVerifiedEmail(user: Doc, action = "start a paid checkout"): void {
  if (!isEmailVerified(user)) {
    throw httpError(
      403,
      `Email verification is required to ${action}. Check your inbox or request a new verification email.`,
    );
  }
}

export async function ensureAuthTokenIndexes(): Promise<void> {
  try {
    await col("email_verify_tokens").createIndex({ token_hash: 1 }, { unique: true });
    await col("email_verify_tokens").createIndex({ user_id: 1, used_at: 1 });
    await col("password_reset_tokens").createIndex({ token_hash: 1 }, { unique: true });
    await col("password_reset_tokens").createIndex({ user_id: 1, used_at: 1 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`auth token indexes skipped: ${String(e)}`);
  }
}

/** Invalidate prior unused tokens and issue a fresh verification token. */
export async function issueEmailVerification(
  user: Doc,
): Promise<{ id: string; token: string; expires_at: string }> {
  if (isEmailVerified(user)) {
    throw httpError(400, "Email is already verified");
  }
  const now = new Date();
  await col("email_verify_tokens").updateMany(
    { user_id: user.id, used_at: null, revoked_at: null },
    { $set: { revoked_at: now.toISOString() } },
  );
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(now.getTime() + VERIFY_TTL_HOURS * 3600 * 1000);
  const id = randomUUID();
  await col("email_verify_tokens").insertOne({
    id,
    user_id: user.id,
    email: user.email,
    token_hash: hashToken(token),
    expires_at: expires.toISOString(),
    used_at: null,
    revoked_at: null,
    created_at: now.toISOString(),
  });
  const link = `${appBase()}/verify-email?token=${encodeURIComponent(token)}`;
  const client = (await col("clients").findOne({ user_id: user.id })) as Doc | null;
  const firstName = resolveEmailFirstName(user, client);
  await queueEmail({
    to: String(user.email),
    recipientName: firstName || null,
    kind: "EMAIL_VERIFICATION",
    subject: "Verify your email address | TaxSimba",
    title: "Verify your TaxSimba account",
    body:
      "Please verify your email address to confirm your TaxSimba account.\n\n" +
      "This email only verifies your account. It does not activate a package, confirm a purchase, or start a subscription.\n\n" +
      "After you verify, you can continue setting up your chosen tax service and complete purchase when you are ready.\n\n" +
      "If you didn't create a TaxSimba account, you can safely ignore this email.\n\n" +
      "Never share your TaxSimba password or verification link with anyone.",
    link,
    callToAction: "Verify my email",
    preheader: "Verify your TaxSimba account email address",
    dedupeKey: `email-verify:${id}`,
    userId: user.id as string,
  });
  return { id, token, expires_at: expires.toISOString() };
}

export async function consumeEmailVerification(token: string): Promise<Doc> {
  const raw = (token ?? "").trim();
  if (!raw) throw httpError(400, "Verification token is required");
  const row = (await col("email_verify_tokens").findOne({
    token_hash: hashToken(raw),
  })) as Doc | null;
  if (!row || row.used_at || row.revoked_at) {
    throw httpError(400, "Invalid or expired verification link");
  }
  if (String(row.expires_at) < new Date().toISOString()) {
    throw httpError(400, "Invalid or expired verification link");
  }
  const user = (await col("users").findOne({ id: row.user_id })) as Doc | null;
  if (!user || user.is_active === false) throw httpError(400, "Invalid or expired verification link");
  const verifiedAt = nowIso();
  await col("users").updateOne(
    { id: user.id },
    { $set: { email_verified_at: verifiedAt, updated_at: verifiedAt } },
  );
  await col("email_verify_tokens").updateOne(
    { id: row.id },
    { $set: { used_at: verifiedAt } },
  );
  return { ...user, email_verified_at: verifiedAt };
}

/** Resend for an unverified account. Always returns a generic outcome to avoid email enumeration. */
export async function resendEmailVerification(email: string): Promise<{ issued: boolean }> {
  const address = email.trim().toLowerCase();
  const user = (await col("users").findOne({ email: address })) as Doc | null;
  if (!user || user.is_active === false || isEmailVerified(user)) {
    return { issued: false };
  }
  await issueEmailVerification(user);
  return { issued: true };
}
