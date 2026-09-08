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

import { Router } from "express";
import { z } from "zod";

import { clean, col, Doc } from "../db/mongo";
import { handler, httpError, parseBody } from "../http/errors";
import { authResponse, clearSessionCookies, isBrowser } from "../http/session";
import { auth, user as authed } from "../middleware/auth";
import { enforceCsrf } from "../middleware/csrf";
import {
  createAccessToken,
  REFRESH_COOKIE,
  revokeRefreshToken,
  verifyPassword,
} from "../services/auth";
import { clearFailures, clientIp, enforceLoginAllowed, recordFailure } from "../services/loginLockout";
import { createChallenge } from "../services/security";
import { keysToCamel, keysToSnake } from "./caseMap";
import { sendCompatSuccess } from "./envelope";

const LoginIn = z.object({
  email: z.string().email(),
  password: z.string(),
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
  // Ensure a Bearer token is present even when the caller looks like a browser (Origin header).
  // NextAuth authorize runs server-side; Toxel stores accessToken in the JWT. Cookies remain set.
  const accessToken =
    typeof native.access_token === "string"
      ? native.access_token
      : createAccessToken(user.id, user.email as string);
  return {
    accessToken,
    user: toToxelUser(clean({ ...user }) as Doc),
    // Explicitly false — NOT a source of truth for entitlements (baseline D7 / D8).
    isSubscriptionBuy: false,
  };
}

export const compatAuthRouter = Router();

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
