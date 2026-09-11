import React from 'react'
import FaqClient from './page.client'
export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}/faq`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "FAQs: Tax Simba | UK Tax Filing & Self Assessment",
    description: "Find answers to commonly asked questions about UK tax filing, Self Assessment, and how Taxsimba can help you stay compliant.",
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
      title: "FAQs: Self Assessment & Tax Filing | TaxSimba",
      description: "Answers to common UK Self Assessment questions—deadlines, penalties, refunds, documents needed, and how to file online with TaxSimba’s trusted advisers.",
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
      title: "FAQs: Self Assessment & Tax Filing | TaxSimba",
      description: "Answers to common UK Self Assessment questions—deadlines, penalties, refunds, documents needed, and how to file online with TaxSimba’s trusted advisers.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}

const FaqPage = () => {
  return (
    <>
      <script dangerouslySetInnerHTML=
        {{
          __html: JSON.stringify(
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://taxsimba.co.uk/#organization",
                  "name": "TaxSimba",
                  "url": "https://taxsimba.co.uk",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://taxsimba.co.uk/images/logo.png"
                  },
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "+44-20-8087-4308",
                    "contactType": "Customer Service",
                    "areaServed": "GB",
                    "availableLanguage": "English"
                  },
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "4-4A Bloomsbury Square",
                    "addressLocality": "London",
                    "postalCode": "WC1A 2RP",
                    "addressCountry": "GB"
                  }
                },
                {
                  "@type": "WebPage",
                  "@id": "https://taxsimba.co.uk/faq#webpage",
                  "url": "https://taxsimba.co.uk/faq",
                  "name": "FAQs: Tax Simba | UK Tax Filing & Self Assessment",
                  "description": "Find answers to commonly asked questions about UK tax filing, Self Assessment, and how Taxsimba can help you stay compliant.",
                  "isPartOf": {
                    "@type": "WebSite",
                    "url": "https://taxsimba.co.uk",
                    "name": "TaxSimba"
                  },
                  "breadcrumb": {
                    "@id": "https://taxsimba.co.uk/faq#breadcrumb"
                  },
                  "about": {
                    "@id": "https://taxsimba.co.uk/#organization"
                  },
                  "mainEntity": {
                    "@id": "https://taxsimba.co.uk/faq#faqpage"
                  }
                },
                {
                  "@type": "BreadcrumbList",
                  "@id": "https://taxsimba.co.uk/faq#breadcrumb",
                  "itemListElement": [
                    {
                      "@type": "ListItem",
                      "position": 1,
                      "name": "Home",
                      "item": "https://taxsimba.co.uk"
                    },
                    {
                      "@type": "ListItem",
                      "position": 2,
                      "name": "FAQ",
                      "item": "https://taxsimba.co.uk/faq"
                    }
                  ]
                },
                {
                  "@type": "FAQPage",
                  "@id": "https://taxsimba.co.uk/faq#faqpage",
                  "mainEntity": [
                    {
                      "@type": "Question",
                      "name": "What form do I need for tax filing in UK, and how do I get it?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Normally, you'll need your National Insurance number, UTR (Unique Taxpayer Reference), records of income (e.g. payslips, invoices, rent statements), and information on any expenses, pensions, or investments. We'll walk you through it, bit by bit."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Who must submit a Self-Assessment tax return?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "You'll probably have to submit a Self Assessment tax return to HMRC if you're self-employed, a company director, a landlord, or have untaxed income (such as from investments). Not sure? We can assist you with checking."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "What if I miss the tax return deadline?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Delaying beyond the 31 January deadline can accelerate HMRC penalties to a minimum of £100, along with fines and interest on a daily basis. If you're late, move quickly. We can submit for you as soon as possible and minimize penalties by doing so."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Can you submit my return if I've never prepared one before?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. If you're a beginner at Self Assessment or don't know where to start, we cover all that is required, from reporting to HMRC to filling in your return correctly and promptly."
                      }
                    }
                  ]
                }
              ]
            }

          )
        }} />
      <FaqClient />
    </>
  )
}

export default FaqPage
