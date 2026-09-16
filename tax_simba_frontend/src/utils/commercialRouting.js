import { getArticleBySlug } from "@/data/articles";

/** Commercial service pages owned by the MTD journey. */
export const MTD_SERVICE_PATHS = [
  "/making-tax-digital",
  "/rental-income-tax",
  "/self-employed-tax-return",
  "/mtd-information",
];

/** Commercial / service pages owned by the Self Assessment journey. */
export const SA_SERVICE_PATHS = [
  "/self-assessment",
  "/self-assessment-guide",
  "/self-employed-service",
  "/rental-income-service",
  "/cis-service",
  "/capital-gains-service",
  "/tax-adviser",
  "/tax-filing",
  "/private-client-service",
  "/high-net-worth-service",
  "/tax-for-freelancers",
];

function normalizePath(pathname) {
  if (!pathname) return "/";
  return pathname.split("?")[0].replace(/\/$/, "") || "/";
}

/**
 * Context-aware public "Get Started" / Ask Now destination.
 * - SA / default → /register
 * - MTD commercial + MTD-owned articles → /register?role=MTD
 * - Eligibility (/check-mtd, CHECK articles) → stay on checker journey (not SA)
 */
export function getPublicGetStartedHref(pathname) {
  if (!pathname) return "/register";

  const path = normalizePath(pathname);

  if (path === "/check-mtd") {
    return "/check-mtd#eligibility-checker";
  }

  if (MTD_SERVICE_PATHS.includes(path)) {
    return "/register?role=MTD";
  }

  if (path.startsWith("/blogs/")) {
    const slug = path.slice("/blogs/".length).split("/")[0];
    const article = getArticleBySlug(slug);
    if (article?.ctaType === "MTD") return "/register?role=MTD";
    if (article?.ctaType === "CHECK") return "/check-mtd";
  }

  return "/register";
}

/** True when the current path should treat registration as MTD-scoped. */
export function isMtdCommercialPath(pathname) {
  if (!pathname) return false;
  const path = normalizePath(pathname);
  if (MTD_SERVICE_PATHS.includes(path) || path === "/check-mtd") return true;
  if (path.startsWith("/blogs/")) {
    const slug = path.slice("/blogs/".length).split("/")[0];
    const cta = getArticleBySlug(slug)?.ctaType;
    return cta === "MTD" || cta === "CHECK";
  }
  return false;
}

/** True when the path is clearly Self Assessment commercial ownership. */
export function isSaCommercialPath(pathname) {
  if (!pathname) return false;
  const path = normalizePath(pathname);
  if (SA_SERVICE_PATHS.includes(path)) return true;
  if (path.startsWith("/blogs/")) {
    const slug = path.slice("/blogs/".length).split("/")[0];
    const article = getArticleBySlug(slug);
    return Boolean(article) && article.ctaType === "SA";
  }
  return false;
}

/**
 * Whether the global top announcement bar should show the MTD checker message.
 * Hidden on SA-owned pages so they are not dominated by an unrelated MTD sales push.
 * Shown on MTD / eligibility / neutral contexts (home, pricing, etc.).
 */
export function shouldShowMtdAnnouncementBar(pathname) {
  if (isSaCommercialPath(pathname)) return false;
  return true;
}
