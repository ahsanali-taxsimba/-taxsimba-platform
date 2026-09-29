/**
 * Absolute HTTPS staff-invite setup links.
 *
 * Admin FE is mounted at basePath `/admin`, so the public path is always
 * `/admin/invite/{token}`. Prefer ADMIN_BASE_URL (admin public origin, no path),
 * then the request Origin, then APP_BASE_URL only as a last resort.
 */
import { env } from "../config/env";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Host origin only — strips a trailing `/admin` path if present. */
export function adminPublicOrigin(req?: { get?: (h: string) => string | undefined }): string {
  const configured = (env("ADMIN_BASE_URL") ?? "").trim();
  const fromReq = String(req?.get?.("origin") ?? "").trim();
  const fallback = (env("APP_BASE_URL") ?? "").trim();
  const raw = configured || fromReq || fallback;
  if (!raw) return "";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    // Drop path/query so we never emit /admin/admin/invite…
    return `${u.protocol}//${u.host}`;
  } catch {
    return stripTrailingSlash(raw).replace(/\/admin$/i, "");
  }
}

export function staffInviteSetupLink(
  token: string,
  req?: { get?: (h: string) => string | undefined },
): string {
  const origin = adminPublicOrigin(req);
  if (!origin) return `/admin/invite/${token}`;
  return `${origin}/admin/invite/${encodeURIComponent(token)}`;
}
