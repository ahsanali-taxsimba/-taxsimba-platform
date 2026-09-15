import AboutUsClient from './page.client'

export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/about-us`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "About TaxSimba | Stress-Free UK Tax Returns & Consultancy",
    description: "TaxSimba simplifies UK tax filing with expert guidance and stress-free returns. Trusted by individuals, businesses for fast, accurate, and reliable tax solutions.",
    // keywords: "self-assessment tax returns, self-assessment tax UK",
    robots: "index, follow",
    alternates: {
       canonical: canonicalUrl
    },

    // Open Graph
    openGraph: {
      locale: "en_GB",
      type: "website",
      siteName: "TaxSimba",
      title: "About TaxSimba | Stress-Free UK Tax Returns & Consultancy",
      description: "TaxSimba simplifies UK tax filing with expert guidance and stress-free returns. Trusted by individuals, businesses for fast, accurate, and reliable tax solutions.",
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
      title: "About TaxSimba | Stress-Free UK Tax Returns & Consultancy",
      description: "TaxSimba simplifies UK tax filing with expert guidance and stress-free returns. Trusted by individuals, businesses for fast, accurate, and reliable tax solutions.",
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
      <AboutUsClient/> 
    </>
  )
}

export default page
