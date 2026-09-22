/**
 * Compat API media URL helpers + authenticated blob fetch for protected profile photos.
 * NEXT_PUBLIC_API_URL is expected to be the compat base ending in /api/compat/
 * (with or without trailing slash). Paths like `auth/profile-photo/:id` are relative to it.
 */

/**
 * Resolve a relative or absolute media path against the configured compat API base.
 * Never strips /api/compat. Never produces /api/compat/api/...
 */
export function resolveCompatMediaUrl(path, apiBase = process.env.NEXT_PUBLIC_API_URL) {
  if (path == null || path === "") return "";
  const raw = String(path).trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:") || raw.startsWith("data:")) {
    return raw;
  }

  const base = String(apiBase || "").trim();
  if (!base) return raw.startsWith("/") ? raw : `/${raw}`;

  let originAndPath = base.replace(/\/+$/, "");
  // If someone set base to host-only, still allow relative join without inventing /api/compat twice.
  const rel = raw.replace(/^\/+/, "");

  // Guard: if relative already starts with api/compat, do not prefix again.
  if (/^api\/compat\b/i.test(rel)) {
    try {
      const u = new URL(originAndPath.includes("://") ? originAndPath : `https://${originAndPath}`);
      return `${u.protocol}//${u.host}/${rel}`;
    } catch {
      return `/${rel}`;
    }
  }

  // Guard: if relative starts with api/ and base already ends with /api/compat, do not create
  // /api/compat/api/...
  if (/^api\//i.test(rel) && /\/api\/compat$/i.test(originAndPath)) {
    try {
      const u = new URL(originAndPath);
      return `${u.protocol}//${u.host}/${rel}`;
    } catch {
      return `${originAndPath.replace(/\/api\/compat$/i, "")}/${rel}`;
    }
  }

  return `${originAndPath}/${rel}`;
}

/**
 * Fetch a protected media URL with Bearer auth and return an object URL.
 * Caller MUST revokeObjectURL when done.
 */
export async function fetchProtectedMediaObjectUrl(path, accessToken, apiBase) {
  if (!path) {
    const err = new Error("Missing media path");
    err.code = "MISSING_PATH";
    throw err;
  }
  if (!accessToken) {
    const err = new Error("Missing access token");
    err.code = "MISSING_TOKEN";
    throw err;
  }
  const url = resolveCompatMediaUrl(path, apiBase);
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const token = String(accessToken).startsWith("Bearer ")
    ? String(accessToken)
    : `Bearer ${accessToken}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: token },
    credentials: "omit",
  });
  if (!res.ok) {
    const err = new Error(`Media fetch failed (${res.status})`);
    err.code = "FETCH_FAILED";
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(blob);
  }
  throw new Error("createObjectURL unavailable");
}

/** True when a path looks like a relative compat media key (not a public CDN URL). */
export function isRelativeProtectedMediaPath(path) {
  if (!path) return false;
  const raw = String(path).trim();
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:") || raw.startsWith("data:")) {
    return false;
  }
  return true;
}
