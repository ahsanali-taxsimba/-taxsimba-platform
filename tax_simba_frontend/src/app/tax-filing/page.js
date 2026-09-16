import React from 'react'
import TaxFilling from './page.client'

export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/tax-filing`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "Online Tax Return Filing (UK) | TaxSimba",
    description: "Get fast, accurate UK tax filing with TaxSimba. Expert accountants handle your returns, maximise refunds, and ensure full HMRC compliance.",
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
      title: "Online Tax Return Filing (UK) | TaxSimba",
      description: "Get fast, accurate UK tax filing with TaxSimba. Expert accountants handle your returns, maximise refunds, and ensure full HMRC compliance.",
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
      title: "Online Tax Return Filing (UK) | TaxSimba",
      description: "Get fast, accurate UK tax filing with TaxSimba. Expert accountants handle your returns, maximise refunds, and ensure full HMRC compliance.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}

const page = () => {
  return (
    <>
    <TaxFilling />
    </>
  )
}

export default page;
