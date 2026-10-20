/**
 * Shared SEO helpers for the public TaxSimba frontend.
 * Keep facts conservative — do not invent ratings, awards or credentials.
 */

export const SITE_NAME = "TaxSimba";
export const DEFAULT_OG_IMAGE = "/images/logo.png";

export function getSiteBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk").replace(/\/+$/, "");
}

export function absoluteUrl(path = "/") {
  const base = getSiteBaseUrl();
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isStagingEnvironment() {
  return (
    process.env.NEXT_PUBLIC_IS_STAGING === "true" ||
    process.env.NODE_ENV === "staging"
  );
}

export function buildPageMetadata({
  title,
  description,
  path,
  ogImage = DEFAULT_OG_IMAGE,
  ogImageAlt = "TaxSimba",
  robots = "index, follow",
  type = "website",
  keywords,
}) {
  const canonicalUrl = absoluteUrl(path);
  const ogImageUrl = ogImage.startsWith("http")
    ? ogImage
    : absoluteUrl(ogImage);

  return {
    title,
    description,
    robots: isStagingEnvironment() ? { index: false, follow: false } : robots,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      locale: "en_GB",
      type,
      siteName: SITE_NAME,
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 628,
          alt: ogImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@TaxSimba",
      title,
      description,
      images: [{ url: ogImageUrl, alt: ogImageAlt }],
    },
    ...(keywords ? { keywords } : {}),
  };
}

export function articleJsonLd(article) {
  const url = absoluteUrl(`/blogs/${article.slug}`);
  const image = article.featuredImage
    ? article.featuredImage.startsWith("http")
      ? article.featuredImage
      : absoluteUrl(article.featuredImage)
    : absoluteUrl(DEFAULT_OG_IMAGE);

  const payload = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    author: {
      "@type": "Organization",
      name: article.authorName || SITE_NAME,
      url: getSiteBaseUrl(),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: getSiteBaseUrl(),
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/images/logo.svg"),
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    image: [image],
    articleSection: article.category || "Tax guides",
    inLanguage: "en-GB",
    isAccessibleForFree: true,
  };

  // Only emit dates that are real and present on the visible page.
  if (article.publishedAt && !Number.isNaN(new Date(article.publishedAt).getTime())) {
    payload.datePublished = article.publishedAt;
  }
  const modified = article.reviewedAt || article.publishedAt;
  if (modified && !Number.isNaN(new Date(modified).getTime())) {
    payload.dateModified = modified;
  }

  return payload;
}

export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * Conservative Service schema for commercial SEO pages.
 * Do not invent aggregateRating, awards, or credentials.
 */
export function serviceJsonLd({
  name,
  description,
  path,
  serviceType = "Tax preparation service",
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    serviceType,
    url: absoluteUrl(path),
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: getSiteBaseUrl(),
    },
    areaServed: {
      "@type": "Country",
      name: "United Kingdom",
    },
  };
}
