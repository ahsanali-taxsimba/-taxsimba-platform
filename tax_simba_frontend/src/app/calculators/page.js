import React from 'react';
import CalculatorsClient from './page.client';

export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/calculators`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "Free UK Tax Calculators | Estimate Income Tax, NI & CGT | TaxSimba",
    description: "Calculate your UK taxes instantly with TaxSimba's premium calculators. Estimate National Insurance, Salary After Tax, Dividend Tax, Rental Income, and more.",
    robots: "index, follow",
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      locale: "en_GB",
      type: "website",
      siteName: "TaxSimba",
      title: "Free UK Tax Calculators | Estimate Income Tax, NI & CGT | TaxSimba",
      description: "Calculate your UK taxes instantly with TaxSimba's premium calculators. Estimate National Insurance, Salary After Tax, Dividend Tax, Rental Income, and more.",
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 628,
          alt: "TaxSimba Calculators",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@TaxSimba",
      title: "Free UK Tax Calculators | Estimate Income Tax, NI & CGT | TaxSimba",
      description: "Calculate your UK taxes instantly with TaxSimba's premium calculators. Estimate National Insurance, Salary After Tax, Dividend Tax, Rental Income, and more.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}

const CalculatorsPage = () => {
  return <CalculatorsClient />;
};

export default CalculatorsPage;
