import React from 'react';
import MtdClient from './page.client';

export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/check-mtd`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "Making Tax Digital (MTD) Eligibility Checker | TaxSimba",
    description: "Check if you are eligible for HMRC's Making Tax Digital (MTD) rules for Income Tax. Enter your annual sole trader or landlord income to check in seconds.",
    robots: "index, follow",
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      locale: "en_GB",
      type: "website",
      siteName: "TaxSimba",
      title: "Making Tax Digital (MTD) Eligibility Checker | TaxSimba",
      description: "Check if you are eligible for HMRC's Making Tax Digital (MTD) rules for Income Tax. Enter your annual sole trader or landlord income to check in seconds.",
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 628,
          alt: "MTD Checker",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@TaxSimba",
      title: "Making Tax Digital (MTD) Eligibility Checker | TaxSimba",
      description: "Check if you are eligible for HMRC's Making Tax Digital (MTD) rules for Income Tax. Enter your annual sole trader or landlord income to check in seconds.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}

const MtdPage = () => {
  return <MtdClient />;
};

export default MtdPage;
