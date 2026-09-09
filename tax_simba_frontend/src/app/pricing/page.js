import React from 'react';
import PricingClient from './page.client';

export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/pricing`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "UK Tax Return Pricing | Fixed Fee Self Assessment | TaxSimba",
    description: "View TaxSimba's transparent, fixed-fee UK tax return packages starting at £119. Dedicated accountants, HMRC-compliant filing, and zero hidden costs.",
    robots: "index, follow",
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      locale: "en_GB",
      type: "website",
      siteName: "TaxSimba",
      title: "UK Tax Return Pricing | Fixed Fee Self Assessment | TaxSimba",
      description: "View TaxSimba's transparent, fixed-fee UK tax return packages starting at £119. Dedicated accountants, HMRC-compliant filing, and zero hidden costs.",
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 628,
          alt: "TaxSimba Pricing",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@TaxSimba",
      title: "UK Tax Return Pricing | Fixed Fee Self Assessment | TaxSimba",
      description: "View TaxSimba's transparent, fixed-fee UK tax return packages starting at £119. Dedicated accountants, HMRC-compliant filing, and zero hidden costs.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}

const PricingPage = () => {
  return <PricingClient />;
};

export default PricingPage;
