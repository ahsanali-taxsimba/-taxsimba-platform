import React from 'react';
import MtdInfoClient from './page.client';

export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/mtd-information`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "Making Tax Digital (MTD) Information | UK Tax Rules | TaxSimba",
    description: "Learn about HMRC's Making Tax Digital (MTD) rules starting April 2026. Find out how MTD affects sole traders and landlords, and get expert guidance.",
    robots: "index, follow",
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      locale: "en_GB",
      type: "website",
      siteName: "TaxSimba",
      title: "Making Tax Digital (MTD) Information | UK Tax Rules | TaxSimba",
      description: "Learn about HMRC's Making Tax Digital (MTD) rules starting April 2026. Find out how MTD affects sole traders and landlords, and get expert guidance.",
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 628,
          alt: "MTD Information",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@TaxSimba",
      title: "Making Tax Digital (MTD) Information | UK Tax Rules | TaxSimba",
      description: "Learn about HMRC's Making Tax Digital (MTD) rules starting April 2026. Find out how MTD affects sole traders and landlords, and get expert guidance.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}

const Page = () => {
  return <MtdInfoClient />;
};

export default Page;