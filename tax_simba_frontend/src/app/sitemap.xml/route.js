import { NextResponse } from "next/server";
import { getAllArticleSlugs } from "@/data/articles";

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const formatDate = (date = new Date()) => date.toISOString().slice(0, 10);

async function getSlugs() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.taxsimba.com/api/";
  const url = new URL("slugs", apiBase).toString();

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json?.data || {};
  } catch (err) {
    console.error("Failed to load sitemap slugs", err);
    return {};
  }
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const today = formatDate();
  const staticUrls = [
    { path: "/", lastmod: today, changefreq: "daily", priority: 1.0 },
    { path: "/about-us", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/contact-us", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/testimonials", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/services", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/faq", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/privacy-policy", lastmod: today, changefreq: "monthly", priority: 0.6 },
    { path: "/cookie-policy", lastmod: today, changefreq: "monthly", priority: 0.5 },
    { path: "/terms-and-conditions", lastmod: today, changefreq: "monthly", priority: 0.5 },
    { path: "/data-policy", lastmod: today, changefreq: "monthly", priority: 0.5 },
    { path: "/tax-filing", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/self-assessment", lastmod: today, changefreq: "weekly", priority: 0.95 },
    { path: "/self-assessment-guide", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/mtd-information", lastmod: today, changefreq: "weekly", priority: 0.95 },
    { path: "/making-tax-digital", lastmod: today, changefreq: "weekly", priority: 0.95 },
    { path: "/check-mtd", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/rental-income-tax", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/self-employed-tax-return", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/tax-for-freelancers", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/pricing", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/blogs", lastmod: today, changefreq: "weekly", priority: 0.9 },
    { path: "/calculators", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/cis-service", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/self-employed-service", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/rental-income-service", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/private-client-service", lastmod: today, changefreq: "weekly", priority: 0.7 },
    { path: "/capital-gains-service", lastmod: today, changefreq: "weekly", priority: 0.7 },
    { path: "/high-net-worth-service", lastmod: today, changefreq: "weekly", priority: 0.7 },
    { path: "/services/self-employed-tax-return-services-uk", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/services/cis-tax-returns", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/services/rental-income-tax-returns", lastmod: today, changefreq: "weekly", priority: 0.8 },
    { path: "/services/private-client-tax-returns", lastmod: today, changefreq: "weekly", priority: 0.7 },
    { path: "/services/capital-gains-tax-returns-advice", lastmod: today, changefreq: "weekly", priority: 0.7 },
    { path: "/services/high-net-worth-individuals-tax-returns", lastmod: today, changefreq: "weekly", priority: 0.7 },
    { path: "/services/non-resident-landlord-taxes-expat-tax-services-uk", lastmod: today, changefreq: "weekly", priority: 0.7 },
    { path: "/calculators/ni", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/combined-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/salary-after-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/income-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/pension-tax-relief", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/child-benefit", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/late-penalty", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/rental-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/cis-rebate", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/ebay-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/stamp-duty", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/uber-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/tax-code", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/mileage-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/dividend-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/crypto-tax", lastmod: today, changefreq: "monthly", priority: 0.7 },
    { path: "/calculators/corporation-tax", lastmod: today, changefreq: "monthly", priority: 0.6 },
  ];

  const slugsData = await getSlugs();
  const subCategories = Array.isArray(slugsData?.subCategories) ? slugsData.subCategories : [];
  const services = Array.isArray(slugsData?.services) ? slugsData.services : [];
  const apiBlogs = Array.isArray(slugsData?.blogs) ? slugsData.blogs : [];
  const curatedBlogs = getAllArticleSlugs();
  const blogSlugs = Array.from(new Set([...curatedBlogs, ...apiBlogs]));

  const dynamicUrls = [
    ...subCategories.map((slug) => ({
      path: `/${slug}`,
      lastmod: today,
      changefreq: "weekly",
      priority: 0.7,
    })),
    ...services.map((slug) => ({
      path: `/services/${slug}`,
      lastmod: today,
      changefreq: "weekly",
      priority: 0.8,
    })),
    ...blogSlugs.map((slug) => ({
      path: `/blogs/${slug}`,
      lastmod: today,
      changefreq: "weekly",
      priority: 0.85,
    })),
  ];

  const byPath = new Map();
  for (const item of [...staticUrls, ...dynamicUrls]) {
    // PPC conversion LPs are noindex and must never enter the sitemap.
    if (item.path === "/lp" || item.path.startsWith("/lp/")) continue;
    byPath.set(item.path, item);
  }

  const sitemapBody = Array.from(byPath.values())
    .map(
      ({ path, lastmod, changefreq, priority }) => `
  <url>
    <loc>${xmlEscape(`${baseUrl}${path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
    )
    .join("");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapBody}
  </urlset>`;

  return new NextResponse(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
