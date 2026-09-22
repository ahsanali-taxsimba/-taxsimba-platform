/**
 * Compat API media URL helpers + authenticated blob fetch (admin FE).
 */
export function resolveCompatMediaUrl(
  path: string | null | undefined,
  apiBase: string | undefined = process.env.NEXT_PUBLIC_API_URL,
): string {
  if (path == null || path === "") return "";
  const raw = String(path).trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:") || raw.startsWith("data:")) {
    return raw;
  }

  const base = String(apiBase || "").trim();
  if (!base) return raw.startsWith("/") ? raw : `/${raw}`;

  const originAndPath = base.replace(/\/+$/, "");
  const rel = raw.replace(/^\/+/, "");

  if (/^api\/compat\b/i.test(rel)) {
    try {
      const u = new URL(originAndPath.includes("://") ? originAndPath : `https://${originAndPath}`);
      return `${u.protocol}//${u.host}/${rel}`;
    } catch {
      return `/${rel}`;
    }
  }

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

export function isRelativeProtectedMediaPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const raw = String(path).trim();
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:") || raw.startsWith("data:")) {
    return false;
  }
  return true;
}

export async function fetchProtectedMediaObjectUrl(
  path: string,
  accessToken: string,
  apiBase?: string,
): Promise<string> {
  if (!path) {
    const err = new Error("Missing media path") as Error & { code?: string };
    err.code = "MISSING_PATH";
    throw err;
  }
  if (!accessToken) {
    const err = new Error("Missing access token") as Error & { code?: string };
    err.code = "MISSING_TOKEN";
    throw err;
  }
  const url = resolveCompatMediaUrl(path, apiBase);
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;

  const token = accessToken.startsWith("Bearer ") ? accessToken : `Bearer ${accessToken}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: token },
    credentials: "omit",
  });
  if (!res.ok) {
    const err = new Error(`Media fetch failed (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = "FETCH_FAILED";
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
