import ContactUsClient from "./page.client"

export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/contact-us`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "Contact TaxSimba | Speak to a UK Tax Adviser",
    description: "Contact TaxSimba for expert UK tax and accounting support. Reach our team for queries on tax filing, VAT, payroll, and financial guidance.",
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
      title: "Contact TaxSimba | Speak to a UK Tax Adviser",
      description: "Contact TaxSimba for expert UK tax and accounting support. Reach our team for queries on tax filing, VAT, payroll, and financial guidance.",
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
      title: "Contact TaxSimba | Speak to a UK Tax Adviser",
      description: "Contact TaxSimba for expert UK tax and accounting support. Reach our team for queries on tax filing, VAT, payroll, and financial guidance.",
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
      <ContactUsClient/> 
    </>
  )
}

export default page
