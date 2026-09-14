/**
 * Bearer / NextAuth compatibility auth bridge (baseline X2 / A2 / A3).
 *
 * Calls the same password verification, lockout, session cookie, and refresh-token
 * services as native auth — does not reimplement login security.
 *
 * Compat responses ALWAYS include `accessToken` for NextAuth server-side clients while
 * still setting httpOnly cookies. Cookie + CSRF + staff TOTP paths remain intact on
 * native `/api/auth/*` routes.
 */

import { randomUUID } from "crypto";

import { Router } from "express";
import { z } from "zod";

import { clean, col, Doc } from "../db/mongo";
import { isTestEmail } from "../domain/testdata";
import { nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { authResponse, clearSessionCookies, isBrowser } from "../http/session";
import { auth, user as authed } from "../middleware/auth";
import { enforceCsrf } from "../middleware/csrf";
import {
  createAccessToken,
  hashPassword,
  REFRESH_COOKIE,
  revokeRefreshToken,
  verifyPassword,
} from "../services/auth";
import { bootstrapClientServices } from "../services/clientServices";
import {
  consumeEmailVerification,
  issueEmailVerification,
  resendEmailVerification,
} from "../services/emailVerification";
import { clearFailures, clientIp, enforceLoginAllowed, recordFailure } from "../services/loginLockout";
import { consumePasswordReset, issuePasswordReset } from "../services/passwordReset";
import { createChallenge } from "../services/security";
import { engagementStatusForUser } from "../services/engagement";
import { keysToCamel, keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import { ownershipForUser } from "./ownership";

const LoginIn = z.object({
  email: z.string().email(),
  password: z.string(),
});
const EmailOnlyIn = z.object({ email: z.string().email() });
const VerifyEmailIn = z.object({ token: z.string().min(1) });
const ResetPasswordIn = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
  confirm_password: z.string().nullish(),
  confirmPassword: z.string().nullish(),
});
const RegisterIn = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().nullish(),
  surname: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  mobile: z.string().nullish(),
  phone: z.string().nullish(),
  confirm_password: z.string().nullish(),
  confirmPassword: z.string().nullish(),
  user_role: z.string().nullish(),
  userRole: z.string().nullish(),
});

/** Split a display name into Toxel firstName / lastName without inventing identity fields. */
export function splitDisplayName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Map a Node user row into the Toxel NextAuth-shaped user object. */
export function toToxelUser(user: Doc): Doc {
  const { firstName, lastName } = splitDisplayName(String(user.name ?? ""));
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName,
    lastName,
    mobile: user.phone ?? null,
    profilePhoto: user.profile_photo ?? null,
    roles: user.role,
    role: user.role,
    isActive: user.is_active !== false,
    emailVerifiedAt: user.email_verified_at ?? null,
  };
}

/**
 * Build the auth payload for compat clients.
 * Always includes accessToken (NextAuth needs it); cookies are still set via authResponse.
 */
export async function compatAuthPayload(
  req: Parameters<typeof authResponse>[0],
  res: Parameters<typeof authResponse>[1],
  user: Doc,
): Promise<Doc> {
  const native = await authResponse(req, res, user);
  const accessToken =
    typeof native.access_token === "string"
      ? native.access_token
      : createAccessToken(user.id, user.email as string);
  const ownership = await ownershipForUser(user);
  const engagement = await engagementStatusForUser(user);
  const isTaxInfoSubmitted = Boolean(user.mtd_tax_info_submitted_at);
  return {
    accessToken,
    user: {
      ...toToxelUser(clean({ ...user }) as Doc),
      hasActiveSa: ownership.hasActiveSa,
      hasActiveMtd: ownership.hasActiveMtd,
      hasActiveService: ownership.hasActiveService,
      ownership: ownership.ownership,
      isEngagementLetterAccepted: engagement.isEngagementLetterAccepted,
      engagementAcceptedAt: engagement.engagementAcceptedAt,
      isTaxInfoSubmitted,
    },
    ownership: ownership.ownership,
    hasActiveSa: ownership.hasActiveSa,
    hasActiveMtd: ownership.hasActiveMtd,
    hasActiveService: ownership.hasActiveService,
    isEngagementLetterAccepted: engagement.isEngagementLetterAccepted,
    engagementAcceptedAt: engagement.engagementAcceptedAt,
    isTaxInfoSubmitted,
    // Explicitly false — NOT a source of truth for entitlements (baseline D7 / D8).
    isSubscriptionBuy: false,
  };
}

export const compatAuthRouter = Router();

/** Toxel register (A1): map name/surname/mobile → native register + NOT_ACTIVE bootstrap. */
compatAuthRouter.post(
  "/auth/register",
  handler(async (req, res) => {
    const body = parseBody(RegisterIn, keysToSnake(req.body ?? {}));
    const address = body.email.toLowerCase();
    if (await col("users").findOne({ email: address })) {
      throw httpError(400, "Email already registered");
    }
    const first =
      (body.first_name ?? body.name ?? "").toString().trim() ||
      "";
    const last = (body.last_name ?? body.surname ?? "").toString().trim();
    const displayName = [first, last].filter(Boolean).join(" ") || address;
    const phone = body.phone ?? body.mobile ?? null;
    const record: Doc = {
      id: randomUUID(),
      email: address,
      name: displayName,
      role: "CLIENT",
      password_hash: hashPassword(body.password),
      phone,
      is_active: true,
      email_verified_at: null,
      created_at: nowIso(),
    };
    await col("users").insertOne({ ...record });
    const count = await col("clients").countDocuments({});
    const client: Doc = {
      id: randomUUID(),
      user_id: record.id,
      name: displayName,
      email: address,
      phone,
      is_test: isTestEmail(address),
      created_at: nowIso(),
      client_ref: `CL-${String(42 + count).padStart(4, "0")}`,
    };
    await col("clients").insertOne({ ...client });
    await bootstrapClientServices(client);
    try {
      await issueEmailVerification(record);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`compat register verify issue skipped: ${String(e)}`);
    }
    const data = await compatAuthPayload(req, res, record);
    sendCompatSuccess(res, data, "Registration successful");
  }),
);

compatAuthRouter.post(
  "/auth/login",
  handler(async (req, res) => {
    // Accept camelCase or snake_case bodies via central mapper.
    const body = parseBody(LoginIn, keysToSnake(req.body ?? {}));
    const address = body.email.toLowerCase();
    const ip = clientIp(req);
    await enforceLoginAllowed(ip, address);
    const found = await col("users").findOne({ email: address });
    if (!found || !found.password_hash || !verifyPassword(body.password, found.password_hash)) {
      await recordFailure(ip, address);
      throw httpError(401, "Invalid email or password");
    }
    if (found.status === "PENDING") {
      throw httpError(401, "Your account setup is not complete — use your invitation link");
    }
    if (found.is_active === false) throw httpError(401, "Account disabled");
    await clearFailures(ip, address);
    if (found.totp?.enabled) {
      // Staff TOTP challenge — same native challenge service; envelope-shaped for compat.
      sendCompatSuccess(
        res,
        keysToCamel({
          two_factor_required: true,
          challenge: createChallenge(found.id),
          expires_in: 300,
        }),
        "Two-factor authentication required",
      );
      return;
    }
    const data = await compatAuthPayload(req, res, found as Doc);
    sendCompatSuccess(res, data, "Login successful");
  }),
);

compatAuthRouter.post(
  "/auth/logout",
  handler(async (req, res) => {
    // Bearer-only clients (NextAuth) are non-browser for CSRF purposes when Origin is absent.
    // Cookie browser sessions still require CSRF — same enforceCsrf rules as native logout.
    if (isBrowser(req) && !req.header("authorization")?.startsWith("Bearer ")) {
      enforceCsrf(req);
    }
    const refresh = req.cookies?.[REFRESH_COOKIE];
    if (refresh) await revokeRefreshToken(refresh);
    clearSessionCookies(res);
    sendCompatSuccess(res, { ok: true }, "Logout successful");
  }),
);

compatAuthRouter.get(
  "/auth/me",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    sendCompatSuccess(res, toToxelUser(me), "OK");
  }),
);

compatAuthRouter.post(
  "/auth/verify-email",
  handler(async (req, res) => {
    const snake = keysToSnake(req.body ?? {});
    const token =
      typeof req.query.token === "string" && req.query.token
        ? req.query.token
        : parseBody(VerifyEmailIn, snake).token;
    const user = await consumeEmailVerification(token);
    sendCompatSuccess(
      res,
      keysToCamel({ ok: true, email_verified_at: user.email_verified_at }),
      "Email verified",
    );
  }),
);

compatAuthRouter.post(
  "/auth/re-verify-email",
  handler(async (req, res) => {
    const body = parseBody(EmailOnlyIn, keysToSnake(req.body ?? {}));
    await resendEmailVerification(body.email);
    sendCompatSuccess(
      res,
      { ok: true },
      "If an unverified account exists for that email, a verification link has been sent.",
    );
  }),
);

compatAuthRouter.post(
  "/auth/forget-password",
  handler(async (req, res) => {
    const body = parseBody(EmailOnlyIn, keysToSnake(req.body ?? {}));
    await issuePasswordReset(body.email);
    sendCompatSuccess(
      res,
      { ok: true },
      "If an account exists for that email, a password reset link has been sent.",
    );
  }),
);

compatAuthRouter.post(
  "/auth/reset-password",
  handler(async (req, res) => {
    const body = parseBody(ResetPasswordIn, keysToSnake(req.body ?? {}));
    const confirm = body.confirm_password ?? body.confirmPassword ?? null;
    if (confirm != null && confirm !== body.password) {
      throw httpError(400, "Passwords do not match");
    }
    await consumePasswordReset(body.token, body.password);
    sendCompatSuccess(res, { ok: true }, "Password updated");
  }),
);

/** A8 — change password (maps Toxel auth/change-password → native my-profile/change-password semantics). */
compatAuthRouter.post(
  "/auth/change-password",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const snake = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const current = String(snake.current_password ?? "");
    const next = String(snake.new_password ?? "");
    const confirm = snake.confirm_new_password ?? snake.confirm_password ?? null;
    if (!current || !next) throw httpError(400, "currentPassword and newPassword are required");
    if (confirm != null && String(confirm) !== next) {
      throw httpError(400, "Passwords do not match");
    }
    const full = (await col("users").findOne({ id: me.id })) as Doc | null;
    if (!full || !verifyPassword(current, full.password_hash)) {
      throw httpError(400, "Your current password is not correct");
    }
    if (next.length < 8) throw httpError(400, "Choose a password of at least 8 characters");
    const { checkPasswordStrength } = await import("../services/security");
    checkPasswordStrength(next, me.email ?? "", me.name ?? "");
    await col("users").updateOne(
      { id: me.id },
      { $set: { password_hash: hashPassword(next) } },
    );
    await col("refresh_tokens").updateMany(
      { user_id: me.id, revoked_at: null },
      { $set: { revoked_at: new Date() } },
    );
    await col("activity_logs").insertOne({
      id: randomUUID(),
      case_id: null,
      action: "Password changed",
      user_id: me.id,
      user_name: me.name,
      role: me.role,
      meta: {},
      created_at: nowIso(),
    });
    sendCompatSuccess(res, { ok: true }, "Password changed");
  }),
);

/**
 * P1 — update account settings.
 * CLIENT: maps onto native my-profile fields (name/phone/address).
 * Staff: name/phone only (staff photo/UTR edit remains HIDE per baseline P3).
 */
compatAuthRouter.put(
  "/auth/update-account-settings",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const snake = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const first = typeof snake.first_name === "string" ? snake.first_name.trim() : "";
    const last = typeof snake.last_name === "string" ? snake.last_name.trim() : "";
    const surname = typeof snake.surname === "string" ? snake.surname.trim() : "";
    const nameFromParts = [first, last || surname].filter(Boolean).join(" ").trim();
    const name =
      (typeof snake.name === "string" && snake.name.trim()) || nameFromParts || null;
    const phone =
      typeof snake.phone === "string"
        ? snake.phone
        : typeof snake.mobile === "string"
          ? snake.mobile
          : undefined;
    const address = typeof snake.address === "string" ? snake.address : undefined;

    if (name) await col("users").updateOne({ id: me.id }, { $set: { name } });
    if (me.role === "CLIENT") {
      const updates: Doc = {};
      if (phone !== undefined) updates.phone = phone;
      if (address !== undefined) updates.address = address;
      if (name) updates.name = name;
      if (Object.keys(updates).length) {
        await col("clients").updateOne({ user_id: me.id }, { $set: updates });
      }
      if (name) {
        await col("cases").updateMany(
          { client_user_id: me.id },
          { $set: { client_name: name } },
        );
      }
    } else if (phone !== undefined) {
      await col("users").updateOne({ id: me.id }, { $set: { phone } });
    }
    const fresh = clean(
      ((await col("users").findOne({ id: me.id })) ?? me) as Doc,
    ) as Doc;
    const { firstName, lastName } = splitDisplayName(String(fresh.name ?? ""));
    sendCompatSuccess(
      res,
      keysToCamel({
        ...toToxelUser(fresh),
        first_name: firstName,
        last_name: lastName,
        phone: fresh.phone ?? null,
      }),
      "Updated",
    );
  }),
);

/** Some Toxel clients POST the same profile update path. */
compatAuthRouter.post(
  "/auth/update-account-settings",
  auth(),
  handler(async (req, res) => {
    // Reuse PUT handler by forwarding — express doesn't allow easy reuse; duplicate thin call.
    const me = authed(req);
    const snake = keysToSnake(req.body ?? {}) as Record<string, unknown>;
    const first = typeof snake.first_name === "string" ? snake.first_name.trim() : "";
    const last = typeof snake.last_name === "string" ? snake.last_name.trim() : "";
    const surname = typeof snake.surname === "string" ? snake.surname.trim() : "";
    const nameFromParts = [first, last || surname].filter(Boolean).join(" ").trim();
    const name =
      (typeof snake.name === "string" && snake.name.trim()) || nameFromParts || null;
    const phone =
      typeof snake.phone === "string"
        ? snake.phone
        : typeof snake.mobile === "string"
          ? snake.mobile
          : undefined;
    const address = typeof snake.address === "string" ? snake.address : undefined;
    if (name) await col("users").updateOne({ id: me.id }, { $set: { name } });
    if (me.role === "CLIENT") {
      const updates: Doc = {};
      if (phone !== undefined) updates.phone = phone;
      if (address !== undefined) updates.address = address;
      if (name) updates.name = name;
      if (Object.keys(updates).length) {
        await col("clients").updateOne({ user_id: me.id }, { $set: updates });
      }
      if (name) {
        await col("cases").updateMany(
          { client_user_id: me.id },
          { $set: { client_name: name } },
        );
      }
    } else if (phone !== undefined) {
      await col("users").updateOne({ id: me.id }, { $set: { phone } });
    }
    const fresh = clean(
      ((await col("users").findOne({ id: me.id })) ?? me) as Doc,
    ) as Doc;
    const { firstName, lastName } = splitDisplayName(String(fresh.name ?? ""));
    sendCompatSuccess(
      res,
      keysToCamel({
        ...toToxelUser(fresh),
        first_name: firstName,
        last_name: lastName,
        phone: fresh.phone ?? null,
      }),
      "Updated",
    );
  }),
);
