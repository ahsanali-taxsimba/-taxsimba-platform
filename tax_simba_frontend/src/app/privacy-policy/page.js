import React from 'react'
import PricacyCLient from './page.client'

export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/privacy-policy`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "Privacy Policy | TaxSimba UK – Data Protection & Security",
    description: "Learn how TaxSimba collects, uses, and protects your personal data. Our Privacy Policy ensures transparency, security, and full compliance with UK data laws.",
    // keywords: "Online Tax Return Filing, File Tax Online",
    robots: "index, follow",
    alternates: {
       canonical: canonicalUrl
    },

    // Open Graph
    openGraph: {
      locale: "en_GB",
      type: "website",
      siteName: "TaxSimba",
      title: "Privacy Policy | TaxSimba UK – Data Protection & Security",
      description: "Learn how TaxSimba collects, uses, and protects your personal data. Our Privacy Policy ensures transparency, security, and full compliance with UK data laws.",
      url: canonicalUrl,
      images: [
        {
        url: ogImageUrl,
        width: 1200,
        height: 628,
        alt: "TaxSimba — Self Assessment Tax UK, online tax consultants",
        },
      ],
    },

    // Twitter
    twitter: {
      card: "summary_large_image",
      site: "@TaxSimba", // Replace with your Twitter handle
      title: "Privacy Policy | TaxSimba UK – Data Protection & Security",
      description: "Learn how TaxSimba collects, uses, and protects your personal data. Our Privacy Policy ensures transparency, security, and full compliance with UK data laws.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}
const Pricacy = () => {
  return (
    <>
    <PricacyCLient />
    </>
  )
}

export default Pricacy
