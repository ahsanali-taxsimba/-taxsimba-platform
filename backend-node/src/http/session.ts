import { randomBytes } from "crypto";

import { CookieOptions, Request, Response } from "express";

import { required } from "../config/env";
import { clean, Doc } from "../db/mongo";
import { CSRF_COOKIE } from "../middleware/csrf";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_MINUTES,
  createAccessToken,
  issueRefreshToken,
  REFRESH_COOKIE,
  REFRESH_TTL_DAYS,
} from "../services/auth";

/**
 * Session cookie security controls. Secure/SameSite are environment-configurable so a
 * same-site production deployment can tighten SameSite without a code change.
 */
function cookieOptions(): CookieOptions {
  const sameSite = required("COOKIE_SAMESITE").toLowerCase() as "lax" | "strict" | "none";
  return {
    httpOnly: true,
    secure: required("COOKIE_SECURE").toLowerCase() === "true",
    sameSite,
    path: "/",
  };
}

export function setSessionCookies(res: Response, access: string, refresh: string): void {
  const opts = cookieOptions();
  res.cookie(ACCESS_COOKIE, access, { ...opts, maxAge: ACCESS_TTL_MINUTES * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refresh, { ...opts, maxAge: REFRESH_TTL_DAYS * 86400 * 1000 });
  // The CSRF token is deliberately readable by page script -- that is how the double-submit
  // pattern works. It is not an authentication credential and grants no access on its own.
  res.cookie(CSRF_COOKIE, randomBytes(32).toString("base64url"), {
    ...opts,
    httpOnly: false,
    maxAge: REFRESH_TTL_DAYS * 86400 * 1000,
  });
}

export function clearSessionCookies(res: Response): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    res.clearCookie(name, { path: "/" });
  }
}

/**
 * Browsers always send Origin on POST and Sec-Fetch-* on fetch/XHR. Non-browser API and CLI
 * clients send neither.
 */
export function isBrowser(req: Request): boolean {
  return !!(req.header("origin") || req.header("sec-fetch-mode"));
}

export async function authResponse(req: Request, res: Response, user: Doc): Promise<Doc> {
  const token = createAccessToken(user.id, user.email);
  const refresh = await issueRefreshToken(user.id);
  setSessionCookies(res, token, refresh);
  const body: Doc = { user: clean({ ...user }) };
  if (!isBrowser(req)) {
    // API/CLI clients have no cookie jar and authenticate with a Bearer token. Browser
    // sign-ins are served entirely by the httpOnly cookies, so no token is ever placed
    // where page JavaScript could read it.
    body.access_token = token;
  }
  return body;
}
