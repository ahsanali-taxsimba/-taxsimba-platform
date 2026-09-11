import React from 'react';
import CalculatorClientPage from './page.client';
import { calculators } from "@/lib/calculators/metadata";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const calc = calculators.find((c) => c.slug === slug);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/calculators/${slug}`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  if (!calc) {
    return {
      title: "Calculator Not Found | TaxSimba",
      description: "The requested tax calculator was not found.",
    };
  }

  const title = `${calc.name} Calculator | UK Tax Calculator | TaxSimba`;
  const description = `${calc.description || ""} Estimate your UK tax liability quickly and accurately using TaxSimba's premium HMRC-compliant calculator.`;

  return {
    title,
    description,
    robots: "index, follow",
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      locale: "en_GB",
      type: "website",
      siteName: "TaxSimba",
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 628,
          alt: `${calc.name} Calculator`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@TaxSimba",
      title,
      description,
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
  return <CalculatorClientPage />;
};

export default Page;
