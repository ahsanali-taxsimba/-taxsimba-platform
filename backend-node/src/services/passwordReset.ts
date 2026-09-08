/**
 * Password reset tokens (P0 K.2).
 * Hashed single-use tokens with TTL; raw token returned only for email/tests.
 */
import { createHash, randomBytes, randomUUID } from "crypto";

import { env } from "../config/env";
import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";
import { nowIso } from "../domain/workflow";
import { hashPassword } from "./auth";
import { queueEmail } from "./email";
import { checkPasswordStrength } from "./security";

export const RESET_TTL_HOURS = 2;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function appBase(): string {
  return (env("APP_BASE_URL") ?? "https://taxsimba.co.uk").replace(/\/+$/, "");
}

/**
 * Issue a reset token if the account exists. Response to API callers should stay generic
 * to avoid email enumeration; the raw token is available to the mailer/tests.
 */
export async function issuePasswordReset(
  email: string,
): Promise<{ issued: boolean; token?: string; expires_at?: string }> {
  const address = email.trim().toLowerCase();
  const user = (await col("users").findOne({ email: address })) as Doc | null;
  if (!user || user.is_active === false || !user.password_hash) {
    return { issued: false };
  }
  const now = new Date();
  await col("password_reset_tokens").updateMany(
    { user_id: user.id, used_at: null, revoked_at: null },
    { $set: { revoked_at: now.toISOString() } },
  );
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(now.getTime() + RESET_TTL_HOURS * 3600 * 1000);
  const id = randomUUID();
  await col("password_reset_tokens").insertOne({
    id,
    user_id: user.id,
    email: address,
    token_hash: hashToken(token),
    expires_at: expires.toISOString(),
    used_at: null,
    revoked_at: null,
    created_at: now.toISOString(),
  });
  const link = `${appBase()}/reset-password?token=${encodeURIComponent(token)}`;
  await queueEmail({
    to: address,
    recipientName: String(user.name ?? "there"),
    kind: "PASSWORD_RESET",
    title: "Reset your TaxSimba password",
    body:
      "We received a request to reset your TaxSimba password. If you made this request, use the " +
      "link below. If you did not, you can ignore this email.",
    link,
    callToAction: "Reset password",
    dedupeKey: `password-reset:${id}`,
    userId: user.id as string,
  });
  return { issued: true, token, expires_at: expires.toISOString() };
}

export async function consumePasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  const raw = (token ?? "").trim();
  if (!raw) throw httpError(400, "Reset token is required");
  const row = (await col("password_reset_tokens").findOne({
    token_hash: hashToken(raw),
  })) as Doc | null;
  if (!row || row.used_at || row.revoked_at) {
    throw httpError(400, "Invalid or expired reset link");
  }
  if (String(row.expires_at) < new Date().toISOString()) {
    throw httpError(400, "Invalid or expired reset link");
  }
  const user = (await col("users").findOne({ id: row.user_id })) as Doc | null;
  if (!user || user.is_active === false) throw httpError(400, "Invalid or expired reset link");
  checkPasswordStrength(newPassword, String(user.email ?? ""), String(user.name ?? ""));
  const usedAt = nowIso();
  await col("users").updateOne(
    { id: user.id },
    { $set: { password_hash: hashPassword(newPassword), updated_at: usedAt } },
  );
  await col("password_reset_tokens").updateOne({ id: row.id }, { $set: { used_at: usedAt } });
  // Revoke any other outstanding reset tokens for this user.
  await col("password_reset_tokens").updateMany(
    { user_id: user.id, used_at: null, revoked_at: null },
    { $set: { revoked_at: usedAt } },
  );
}
