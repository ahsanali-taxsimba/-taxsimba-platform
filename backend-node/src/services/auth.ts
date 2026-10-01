import { randomUUID } from "crypto";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { required } from "../config/env";
import { col, Doc } from "../db/mongo";
import { httpError } from "../http/errors";

export const JWT_ALGORITHM = "HS256" as const;
export const ROLES = ["CLIENT", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"];

export const ACCESS_TTL_MINUTES = 15;
export const REFRESH_TTL_DAYS = 7;
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(12));
}

export function verifyPassword(plain: string, hashed: string): boolean {
  try {
    return bcrypt.compareSync(plain, hashed);
  } catch {
    return false;
  }
}

function secret(): string {
  return required("JWT_SECRET");
}

export function createAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, type: "access" }, secret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: ACCESS_TTL_MINUTES * 60,
  });
}

/** Create a refresh token and register its jti so it can be rotated/revoked. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const jti = randomUUID();
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 86400000);
  await col("refresh_tokens").insertOne({
    jti,
    user_id: userId,
    created_at: new Date(),
    expires_at: expires,
    revoked_at: null,
    replaced_by: null,
  });
  return jwt.sign({ sub: userId, type: "refresh", jti }, secret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: REFRESH_TTL_DAYS * 86400,
  });
}

function decode(token: string, ignoreExpiration = false): Doc {
  try {
    return jwt.verify(token, secret(), {
      algorithms: [JWT_ALGORITHM],
      ignoreExpiration,
    }) as Doc;
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw httpError(401, "Session expired");
    throw httpError(401, "Invalid session");
  }
}

/**
 * Validate a refresh token, revoke it, and issue a replacement (rotation). A revoked or
 * unknown jti is rejected, so a stolen refresh token stops working as soon as the
 * legitimate session rotates or logs out.
 */
export async function rotateRefreshToken(token: string): Promise<[Doc, string]> {
  const payload = decode(token);
  if (payload.type !== "refresh") throw httpError(401, "Invalid session");
  const record = await col("refresh_tokens").findOne({ jti: payload.jti });
  if (!record || record.revoked_at) throw httpError(401, "Session revoked");
  const user = await col("users").findOne({ id: payload.sub });
  if (!user || user.is_active === false) throw httpError(401, "Not authenticated");
  const newToken = await issueRefreshToken(user.id);
  const newJti = (jwt.decode(newToken) as Doc).jti;
  await col("refresh_tokens").updateOne(
    { jti: payload.jti },
    { $set: { revoked_at: new Date(), replaced_by: newJti } },
  );
  return [user, newToken];
}

export async function revokeRefreshToken(token: string | undefined): Promise<void> {
  if (!token) return;
  let payload: Doc;
  try {
    payload = jwt.verify(token, secret(), {
      algorithms: [JWT_ALGORITHM],
      ignoreExpiration: true,
    }) as Doc;
  } catch {
    return;
  }
  if (payload.jti) {
    await col("refresh_tokens").updateOne({ jti: payload.jti }, { $set: { revoked_at: new Date() } });
  }
}

export function isStaff(user: Doc): boolean {
  return ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"].includes(user.role);
}

export function isAdmin(user: Doc): boolean {
  return ["ADMIN", "SUPER_ADMIN"].includes(user.role);
}
