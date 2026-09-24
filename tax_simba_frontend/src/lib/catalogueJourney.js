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
  if (!path.startsWith("/planlist")
    && path !== "/engagement-letter"
    && !path.startsWith("/mtd-dashboard")
    && !path.startsWith("/dashboard")
    && !path.startsWith("/tax-return-form")
    && !path.startsWith("/my-tax-return")
  ) {
    return null;
  }
  return path;
}

/**
 * Post-purchase / active-service dashboard path from fulfilled service type
 * or ownership snapshot. Never hardcode SA /dashboard after an MTD purchase.
 */
export function dashboardPathForService(serviceType) {
  const raw = String(serviceType || "").toUpperCase();
  if (
    raw === "MTD_INCOME_TAX"
    || raw === "MTD"
    || raw.includes("MTD")
  ) {
    return "/mtd-dashboard";
  }
  return "/dashboard";
}

/**
 * Resolve where checkout-success / current-plan CTAs should land.
 * Prefer the fulfilled package serviceType; fall back to ownership flags.
 */
export function postPurchaseDashboardPath({
  serviceType,
  hasActiveMtd,
  hasActiveSa,
  ownership,
} = {}) {
  if (serviceType) return dashboardPathForService(serviceType);
  const own = String(ownership || "").toLowerCase();
  if (own === "mtd" || (hasActiveMtd && !hasActiveSa)) return "/mtd-dashboard";
  if (own === "sa" || (hasActiveSa && !hasActiveMtd)) return "/dashboard";
  if (own === "both" || (hasActiveSa && hasActiveMtd)) {
    // Dual-service: prefer the newly fulfilled service when known; else SA workspace.
    return "/dashboard";
  }
  if (hasActiveMtd) return "/mtd-dashboard";
  return "/dashboard";
}

/** Current-plan CTA for an MTD catalogue card (subscriptions tab). */
export function mtdCurrentPlanPath() {
  return "/mtd-dashboard?tab=subscriptions";
}

/** Current-plan CTA for an SA catalogue card. */
export function saCurrentPlanPath() {
  return "/dashboard/my-subscriptions";
}

/**
 * Marketing "Get Started" for MTD pages when the visitor is already logged in.
 * Active MTD → dashboard; otherwise intended MTD catalogue (never SA /dashboard).
 */
export function mtdAuthenticatedStartPath(session) {
  const hasActiveMtd = Boolean(
    session?.hasActiveMtd ?? session?.user?.hasActiveMtd,
  );
  const ownership = String(
    session?.ownership ?? session?.user?.ownership ?? "",
  ).toLowerCase();
  if (hasActiveMtd || ownership === "mtd" || ownership === "both") {
    return "/mtd-dashboard";
  }
  return "/planlist?category=mtd";
}
