/**
 * Resolve which package catalogue category to show.
 * Prefer server-persisted onboardingIntent / catalogueCategory from the session.
 * Query `category` is allowed as an explicit override for marketing handoff.
 * Legacy `?role=MTD` is only used when unauthenticated (pre-login).
 * Never infer from display name or RBAC role === "CLIENT".
 */
export function resolveCatalogueCategory(session, searchParams) {
  const fromSession =
    session?.catalogueCategory ||
    session?.user?.catalogueCategory ||
    null;
  if (fromSession === "mtd" || fromSession === "taxSimba") return fromSession;

  const intent =
    session?.onboardingIntent ||
    session?.user?.onboardingIntent ||
    null;
  if (intent === "MTD_INCOME_TAX") return "mtd";
  if (intent === "SELF_ASSESSMENT") return "taxSimba";

  const category = searchParams?.get?.("category");
  if (category === "mtd" || category === "taxSimba") return category;

  const authenticated = Boolean(session?.accessToken || session?.user);
  if (!authenticated && searchParams?.get?.("role") === "MTD") return "mtd";

  return "taxSimba";
}

export function pendingPlanlistPath(session) {
  const continuePath =
    session?.continuePath || session?.user?.continuePath || null;
  if (typeof continuePath === "string" && continuePath.startsWith("/planlist")) {
    return continuePath;
  }
  const category = resolveCatalogueCategory(session, null);
  return `/planlist?category=${category}`;
}

/** Safe relative continue paths only (no open redirect). */
export function safeContinuePath(raw) {
  if (typeof raw !== "string") return null;
  const path = raw.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  if (!path.startsWith("/planlist") && path !== "/engagement-letter" && !path.startsWith("/mtd-dashboard") && !path.startsWith("/dashboard")) {
    return null;
  }
  return path;
}
