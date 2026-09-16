import { getArticleBySlug } from "@/data/articles";

/** Commercial service pages owned by the MTD journey. */
export const MTD_SERVICE_PATHS = [
  "/making-tax-digital",
  "/rental-income-tax",
  "/self-employed-tax-return",
  "/mtd-information",
];

/**
 * Context-aware public "Get Started" / Ask Now destination.
 * - SA / default → /register
 * - MTD commercial + MTD-owned articles → /register?role=MTD
 * - Eligibility (/check-mtd, CHECK articles) → stay on checker journey (not SA)
 */
export function getPublicGetStartedHref(pathname) {
  if (!pathname) return "/register";

  const path = pathname.split("?")[0].replace(/\/$/, "") || "/";

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
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/";
  if (MTD_SERVICE_PATHS.includes(path)) return true;
  if (path.startsWith("/blogs/")) {
    const slug = path.slice("/blogs/".length).split("/")[0];
    return getArticleBySlug(slug)?.ctaType === "MTD";
  }
  return false;
}
