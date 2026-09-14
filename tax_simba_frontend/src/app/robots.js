import { isStagingEnvironment, getSiteBaseUrl } from "@/lib/seo";

export default function robots() {
  const base = getSiteBaseUrl();

  if (isStagingEnvironment()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      host: base,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/mtd-dashboard",
          "/mtd-dashboard/",
          "/engagement-letter",
          "/my-tax-return",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/frontend-api/",
          "/planlist/",
          "/tax-return-form/payment-complete",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
