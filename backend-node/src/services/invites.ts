/**
 * Secure one-time staff invitations.
 *
 * A Super Admin creates the staff account without a password. A single-use setup token is
 * generated, stored only as a hash, expires after INVITE_TTL_HOURS, and is invalidated when it
 * is used or when a new invite is issued. No password is ever chosen or seen by the Super Admin.
 */
import { createHash, randomBytes, randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";

export const INVITE_TTL_HOURS = 72;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Invalidate any previous invite for this user and issue a fresh single-use token. */
export async function issueInvite(
  userId: string,
  email: string,
  invitedBy: string,
): Promise<{ id: string; token: string; expires_at: string }> {
  const now = new Date();
  await col("staff_invites").updateMany(
    { user_id: userId, used_at: null, revoked_at: null },
    { $set: { revoked_at: now.toISOString() } },
  );
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(now.getTime() + INVITE_TTL_HOURS * 3600 * 1000);
  const id = randomUUID();
  await col("staff_invites").insertOne({
    id,
    user_id: userId,
    email,
    token_hash: hashToken(token),
    invited_by: invitedBy,
    expires_at: expires.toISOString(),
    used_at: null,
    revoked_at: null,
    created_at: now.toISOString(),
  });
  return { id, token, expires_at: expires.toISOString() };
}

export async function findValidInvite(token: string): Promise<Doc | null> {
  const invite = (await col("staff_invites").findOne({ token_hash: hashToken(token) })) as Doc | null;
  if (!invite || invite.used_at || invite.revoked_at) return null;
  if (invite.expires_at < new Date().toISOString()) return null;
  return invite;
}

export async function consumeInvite(inviteId: string): Promise<void> {
  await col("staff_invites").updateOne(
    { id: inviteId },
    { $set: { used_at: new Date().toISOString() } },
  );
}
