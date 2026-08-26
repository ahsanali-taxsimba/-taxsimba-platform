/**
 * Staff two-factor authentication (TOTP) and shared security controls.
 *
 * TOTP secrets are encrypted at rest with Fernet, never hashed (the server must derive future
 * codes) and never logged. Recovery codes are bcrypt-hashed and single use.
 */
import { randomBytes } from "crypto";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";

import { env, required } from "../config/env";
import { col } from "../db/mongo";
import { httpError } from "../http/errors";
import { decrypt, encrypt, InvalidToken } from "./fernet";

export const CHALLENGE_TTL_MINUTES = 5;
export const STAFF_ROLES = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"];
export const MFA_REQUIRED_ROLES = ["ADMIN", "SUPER_ADMIN"];

function issuer(): string {
  return env("TOTP_ISSUER") ?? "TaxSimba";
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newSecret(email: string): { secret: string; uri: string } {
  const bytes = randomBytes(32);
  const secret = Array.from(bytes)
    .map((b) => BASE32[b % 32])
    .join("");
  const uri = authenticator.keyuri(email, issuer(), secret);
  return { secret, uri };
}

export function encryptSecret(secret: string): string {
  return encrypt(required("TOTP_FERNET_KEY"), secret);
}

export function decryptSecret(ciphertext: string): string {
  try {
    return decrypt(required("TOTP_FERNET_KEY"), ciphertext);
  } catch (e) {
    if (e instanceof InvalidToken) throw httpError(500, "Two-factor configuration unavailable");
    throw e;
  }
}

/** Returns [ok, step]. A step is never accepted twice, so a code cannot be replayed. */
export function verifyCode(
  secret: string,
  code: string,
  lastStep: number | null | undefined,
): [boolean, number | null] {
  const trimmed = (code ?? "").trim();
  if (!/^\d{6}$/.test(trimmed)) return [false, null];
  const nowStep = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [-1, 0, 1]) {
    // one step of clock skew either side
    const step = nowStep + offset;
    if (step === lastStep) continue;
    const generated = authenticator
      .clone({ epoch: step * 30000, step: 30, digits: 6, window: 0 })
      .generate(secret);
    if (generated === trimmed) return [true, step];
  }
  return [false, null];
}

export function generateRecoveryCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: count }, () => randomBytes(16).toString("base64url"));
  return { codes, hashes: codes.map((c) => bcrypt.hashSync(c, bcrypt.genSaltSync(12))) };
}

export function matchRecoveryCode(code: string, hashes: string[] | undefined | null): number | null {
  const list = hashes ?? [];
  for (let i = 0; i < list.length; i += 1) {
    try {
      if (bcrypt.compareSync(code ?? "", list[i])) return i;
    } catch {
      continue;
    }
  }
  return null;
}

export function createChallenge(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "2fa_challenge", jti: randomBytes(16).toString("base64url") },
    required("JWT_SECRET"),
    { algorithm: "HS256", expiresIn: CHALLENGE_TTL_MINUTES * 60 },
  );
}

/** Validates a challenge and claims its jti so it can only ever be used once. */
export async function consumeChallenge(token: string): Promise<string> {
  let payload: Record<string, any>;
  try {
    payload = jwt.verify(token, required("JWT_SECRET"), { algorithms: ["HS256"] }) as Record<
      string,
      any
    >;
  } catch {
    throw httpError(401, "This sign-in attempt has expired");
  }
  if (payload.type !== "2fa_challenge" || !payload.jti) {
    throw httpError(401, "Invalid sign-in attempt");
  }
  try {
    await col("used_2fa_challenges").insertOne({
      jti: payload.jti,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60000),
    });
  } catch {
    throw httpError(401, "This sign-in attempt has already been used");
  }
  return payload.sub as string;
}

export async function ensureMfaIndexes(): Promise<void> {
  await col("used_2fa_challenges").createIndex({ jti: 1 }, { unique: true });
  await col("used_2fa_challenges").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
}

// ------------------------------------------------------------------ password policy
const COMMON = [
  "password",
  "password1",
  "12345678",
  "qwerty123",
  "letmein1",
  "taxsimba",
  "welcome1",
  "admin123",
  "changeme",
];

/** Raises 400 when a password is too weak. Applied wherever a password is set. */
export function checkPasswordStrength(password: string, email = "", name = ""): void {
  const pw = password ?? "";
  if (pw.length < 12) throw httpError(400, "Password must be at least 12 characters long");
  const classes = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\p{N}]/u].filter((r) => r.test(pw)).length;
  if (classes < 3) {
    throw httpError(
      400,
      "Password must combine at least three of: lower case, upper case, numbers and symbols",
    );
  }
  const lowered = pw.toLowerCase();
  if (COMMON.some((w) => lowered.includes(w))) {
    throw httpError(400, "This password is too easy to guess");
  }
  const local = (email ?? "").split("@")[0].toLowerCase();
  if (local && local.length > 2 && lowered.includes(local)) {
    throw httpError(400, "Password must not contain your email address");
  }
  for (const part of (name ?? "").toLowerCase().split(/\s+/)) {
    if (part.length > 2 && lowered.includes(part)) {
      throw httpError(400, "Password must not contain your name");
    }
  }
}
