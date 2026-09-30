/**
 * Resolve a native `/api/...` URL when NEXT_PUBLIC_API_URL points at `/api/compat/`.
 */
export function nativeApiUrl(path) {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!raw) return normalizedPath;

  const withoutTrailing = raw.replace(/\/+$/, "");
  const origin = withoutTrailing.replace(/\/api\/compat$/i, "");
  if (origin && origin !== withoutTrailing) {
    return `${origin}${normalizedPath}`;
  }

  try {
    const base = raw.endsWith("/") ? raw : `${raw}/`;
    return new URL(normalizedPath.replace(/^\//, ""), base).toString();
  } catch {
    return normalizedPath;
  }
}
