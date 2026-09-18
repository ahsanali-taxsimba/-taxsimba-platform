/**
 * Resolve a native `/api/...` URL when NEXT_PUBLIC_API_URL points at `/api/compat/`.
 * Axios concatenates relative paths onto the compat base, which wrongly yields
 * `/api/compat/api/...`. Native Super Admin package routes live on `/api/packages*`.
 */
export function nativeApiUrl(path: string): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!raw) return normalizedPath;

  const withoutTrailing = raw.replace(/\/+$/, "");
  const origin = withoutTrailing.replace(/\/api\/compat$/i, "");
  if (origin && origin !== withoutTrailing) {
    return `${origin}${normalizedPath}`;
  }

  // Fallback: if base is already a host root or plain /api, join carefully.
  try {
    const base = raw.endsWith("/") ? raw : `${raw}/`;
    return new URL(normalizedPath.replace(/^\//, ""), base).toString();
  } catch {
    return normalizedPath;
  }
}
