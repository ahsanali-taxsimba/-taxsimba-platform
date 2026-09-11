import Image from "next/image";
import styles from "./page.module.css";
import PageClient from "./(home)/page.client";
// import fetchJSON from "@/lib/fetchJSON"
// async function getHomePageData() {
//   const url = `${process.env.NEXT_PUBLIC_API_URL}home-page-settings`;
//   try {
//     const data = await fetchJSON(url, { next: { revalidate: 120 } });
//     return data || [];
//   } catch (err) {
//     console.error('Failed to load home page data', err);
//     return [];
//   }
// }
// const homePageData = await getHomePageData();


export function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
  const canonicalUrl = `${baseUrl}`;
  const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

  return {
    title: "Self-Assessment Tax Returns Online (UK) | TaxSimba",
    description: "File your self-assessment tax return online with HMRC-ready support. Trusted tax advisers and the best online tax consultant in the UK. Start today.",
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
      title: "Self Assessment Tax UK — File Online with Trusted Advisers | TaxSimba",
      description: "Self-assessment tax returns made simple. HMRC-ready filing with trusted online tax consultants in the UK. Fixed-fee, fast turnaround, human support.",
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
      title: "Self Assessment Tax UK — File Online with Trusted Advisers | TaxSimba",
      description: "Self-assessment tax returns made simple. HMRC-ready filing with trusted online tax consultants in the UK.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}
export default function Home() {
  // console.log("home page data",homePageData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
                },
                "sameAs": [
                  "https://taxsimba.co.uk"
                ]
              },
              {
                "@type": "WebSite",
                "@id": "https://taxsimba.co.uk/#website",
                "url": "https://taxsimba.co.uk",
                "name": "TaxSimba - Self Assessment Tax Returns Online UK",
                "description": "A simplified online tax filing platform for individuals, offering fast processing, guided support, and complete accuracy.",
                "publisher": {
                  "@id": "https://taxsimba.co.uk/#organization"
                }
              },
              {
                "@type": "Service",
                "@id": "https://taxsimba.co.uk/#service",
                "serviceType": "Tax Return Filing Service",
                "name": "Self Assessment Tax Returns",
                "description": "Professional tax return filing in the UK from certified experts. Complete HMRC Tax Return Submission with expert review and personal support.",
                "provider": {
                  "@id": "https://taxsimba.co.uk/#organization"
                },
                "areaServed": {
                  "@type": "Country",
                  "name": "United Kingdom"
                },
                "hasOfferCatalog": {
                  "@type": "OfferCatalog",
                  "name": "Tax Filing Services",
                  "itemListElement": [
                    {
                      "@type": "Offer",
                      "itemOffered": {
                        "@type": "Service",
                        "name": "Self Assessment Tax Return Filing",
                        "description": "Complete HMRC submission with professional review by certified accountants"
                      },
                      "price": "120",
                      "priceCurrency": "GBP",
                      "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "120",
                        "priceCurrency": "GBP",
                        "valueAddedTaxIncluded": true
                      }
                    }
                  ]
                },
                "termsOfService": "https://taxsimba.co.uk/privacy-policy",
                "audience": {
                  "@type": "Audience",
                  "audienceType": "Self-employed, Freelancers, Landlords, Property Owners, Company Directors, Pensioners, Non-UK Residents with UK Income"
                }
              },
              {
                "@type": "Product",
                "@id": "https://taxsimba.co.uk/#product",
                "name": "Self Assessment Tax Return Service",
                "description": "Fixed £120 all-inclusive tax return filing service including HMRC submission, expert review, and email/chat support",
                "brand": {
                  "@id": "https://taxsimba.co.uk/#organization"
                },
                "offers": {
                  "@type": "Offer",
                  "price": "120",
                  "priceCurrency": "GBP",
                  "availability": "https://schema.org/InStock",
                  "url": "https://taxsimba.co.uk/tax-return-form",
                  "priceValidUntil": "2027-04-05",
                  "itemCondition": "https://schema.org/NewCondition"
                }
              },
              {
                "@type": "FAQPage",
                "@id": "https://taxsimba.co.uk/#faqpage",
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
                      "text": "You'll probably have to submit a Self Assessment tax return to HMRC if you're self-employed, a company director, a landlord, or have untaxed income (such as from investments)."
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
              },
              {
                "@type": "WebPage",
                "@id": "https://taxsimba.co.uk/#webpage",
                "url": "https://taxsimba.co.uk",
                "name": "Self Assessment Tax Returns for £120 | TaxSimba",
                "isPartOf": {
                  "@id": "https://taxsimba.co.uk/#website"
                },
                "about": {
                  "@id": "https://taxsimba.co.uk/#organization"
                },
                "description": "Simple, fast, and affordable self-assessment tax returns for £120. Get professional tax return filing in the UK from certified experts.",
                "breadcrumb": {
                  "@id": "https://taxsimba.co.uk/#breadcrumb"
                }
              },
              {
                "@type": "BreadcrumbList",
                "@id": "https://taxsimba.co.uk/#breadcrumb",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://taxsimba.co.uk"
                  }
                ]
              },
              {
                "@type": "ItemList",
                "name": "Tax Filing Process Steps",
                "itemListElement": [
                  {
                    "@type": "HowToStep",
                    "position": 1,
                    "name": "User Registration",
                    "text": "Get started by signing up with us. Provide a few details and register your account. The process is secure, fast and hassle-free."
                  },
                  {
                    "@type": "HowToStep",
                    "position": 2,
                    "name": "Upload Documents with Details",
                    "text": "Upload your tax files and inform us of the type of tax that you need assistance with. Our experts will handle the rest."
                  },
                  {
                    "@type": "HowToStep",
                    "position": 3,
                    "name": "Make Payment",
                    "text": "Choose the payment plan and the mode of payment. We support multiple online payment solutions. It's secure and fast, and there are absolutely no hidden charges."
                  },
                  {
                    "@type": "HowToStep",
                    "position": 4,
                    "name": "Get Paired with an Accountant",
                    "text": "We'll pair you with a certified accountant who'll take care of your filing and keep you updated. They will be available for any queries whenever you need them."
                  }
                ]
              }
            ]
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            {
              "@context": "https://schema.org",
              "@type": "ProfessionalService",
              "@id": "https://taxsimba.co.uk/#localbusiness",
              "name": "TaxSimba",
              "alternateName": "TaxSimba - Self Assessment Tax Returns UK",
              "description": "A simplified online tax filing platform for individuals, offering fast processing, guided support, and complete accuracy. Professional tax return filing services in the UK from certified experts.",
              "url": "https://taxsimba.co.uk",
              "logo": {
                "@type": "ImageObject",
                "url": "https://taxsimba.co.uk/images/logo.png",
                "width": "200",
                "height": "60"
              },
              "image": [
                "https://taxsimba.co.uk/images/logo.png",
                "https://taxsimba.co.uk/images/standing.png"
              ],
              "telephone": "+44-20-8087-4308",
              "email": "contact@taxsimba.com",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "4-4A Bloomsbury Square",
                "addressLocality": "London",
                "addressRegion": "Greater London",
                "postalCode": "WC1A 2RP",
                "addressCountry": "GB"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "51.5187",
                "longitude": "-0.1224"
              },
              "openingHoursSpecification": [
                {
                  "@type": "OpeningHoursSpecification",
                  "dayOfWeek": [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday"
                  ],
                  "opens": "09:00",
                  "closes": "18:00"
                }
              ],
              "priceRange": "£120",
              "currenciesAccepted": "GBP",
              "paymentAccepted": "Credit Card, Debit Card, Online Payment",
              "areaServed": {
                "@type": "Country",
                "name": "United Kingdom"
              },
              "serviceArea": {
                "@type": "GeoCircle",
                "geoMidpoint": {
                  "@type": "GeoCoordinates",
                  "latitude": "51.5187",
                  "longitude": "-0.1224"
                },
                "geoRadius": "500000"
              },
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Tax Filing Services",
                "itemListElement": [
                  {
                    "@type": "OfferCatalog",
                    "name": "Self Assessment Tax Returns",
                    "itemListElement": [
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Complete HMRC Tax Return Submission"
                        }
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Professional Review by Certified Accountants"
                        }
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Customised Tax Consultancy"
                        }
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Breakdown of Income & Expenses"
                        }
                      }
                    ]
                  }
                ]
              },
              "sameAs": [
                "https://taxsimba.co.uk"
              ],
              "slogan": "Self Assessment Tax Returns for £120 - Simple, Fast, Affordable",
              "knowsAbout": [
                "Self Assessment Tax Returns",
                "HMRC Tax Filing",
                "Tax Returns for Self-Employed",
                "Tax Returns for Landlords",
                "Tax Returns for Company Directors",
                "CIS Tax Returns",
                "Rental Income Tax Returns",
                "Capital Gains Tax",
                "Non-Resident Landlord Taxes",
                "Expat Tax Services UK"
              ],
              "makesOffer": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Self Assessment Tax Return Filing",
                    "description": "Complete HMRC submission with professional review, email/chat support"
                  },
                  "price": "120",
                  "priceCurrency": "GBP",
                  "availability": "https://schema.org/InStock",
                  "url": "https://taxsimba.co.uk/tax-return-form",
                  "priceValidUntil": "2026-01-31"
                }
              ],
              "additionalType": [
                "https://schema.org/AccountingService",
                "https://schema.org/FinancialService"
              ]
            }

          )
        }}
      />
      <script dangerouslySetInnerHTML=
        {{
          __html: JSON.stringify(
            {
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "@id": "https://taxsimba.co.uk/#localbusiness",
              "name": "TaxSimba",
              "alternateName": "Tax Simba UK",
              "description": "Professional tax filing and self-assessment services in London, UK. Expert accountants helping individuals, freelancers, landlords, and company directors with HMRC tax returns.",
              "url": "https://taxsimba.co.uk",
              "telephone": "+44-2080874308",
              "email": "contact@taxsimba.com",
              "priceRange": "£120",

              "image": [
                "https://taxsimba.co.uk/images/logo.png",
                "https://taxsimba.co.uk/images/office-photo.jpg"
              ],

              "logo": {
                "@type": "ImageObject",
                "url": "https://taxsimba.co.uk/images/logo.png",
                "width": "250",
                "height": "60"
              },

              "address": {
                "@type": "PostalAddress",
                "streetAddress": "4-4A Bloomsbury Square",
                "addressLocality": "London",
                "addressRegion": "Greater London",
                "postalCode": "WC1A 2RP",
                "addressCountry": "GB"
              },

              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "51.5176",
                "longitude": "-0.1224"
              },

              "hasMap": "https://www.google.com/maps/place/4-4A+Bloomsbury+Square,+London+WC1A+2RP,+UK",

              "openingHoursSpecification": [
                {
                  "@type": "OpeningHoursSpecification",
                  "dayOfWeek": "Monday",
                  "opens": "09:00",
                  "closes": "17:00"
                },
                {
                  "@type": "OpeningHoursSpecification",
                  "dayOfWeek": "Tuesday",
                  "opens": "09:00",
                  "closes": "17:00"
                },
                {
                  "@type": "OpeningHoursSpecification",
                  "dayOfWeek": "Wednesday",
                  "opens": "09:00",
                  "closes": "17:00"
                },
                {
                  "@type": "OpeningHoursSpecification",
                  "dayOfWeek": "Thursday",
                  "opens": "09:00",
                  "closes": "17:00"
                },
                {
                  "@type": "OpeningHoursSpecification",
                  "dayOfWeek": "Friday",
                  "opens": "09:00",
                  "closes": "17:00"
                }
              ],

              "paymentAccepted": [
                "Cash",
                "Credit Card",
                "Debit Card",
                "Bank Transfer"
              ],

              "currenciesAccepted": "GBP",

              "areaServed": [
                {
                  "@type": "City",
                  "name": "London"
                },
                {
                  "@type": "Country",
                  "name": "United Kingdom"
                }
              ],

              "serviceArea": {
                "@type": "GeoCircle",
                "geoMidpoint": {
                  "@type": "GeoCoordinates",
                  "latitude": "51.5176",
                  "longitude": "-0.1224"
                },
                "geoRadius": "50000"
              },

              "sameAs": [
                "https://www.facebook.com/taxsimba",
                "https://twitter.com/taxsimba",
                "https://www.linkedin.com/company/taxsimba",
                "https://www.instagram.com/taxsimba",
                "https://www.youtube.com/@TaxSimba"
              ],

              "contactPoint": [
                {
                  "@type": "ContactPoint",
                  "telephone": "+44-2080874308",
                  "contactType": "customer service",
                  "areaServed": "GB",
                  "availableLanguage": ["English"],
                  "contactOption": "TollFree",
                  "hoursAvailable": {
                    "@type": "OpeningHoursSpecification",
                    "dayOfWeek": [
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday"
                    ],
                    "opens": "09:00",
                    "closes": "17:00"
                  }
                },
                {
                  "@type": "ContactPoint",
                  "contactType": "sales",
                  "telephone": "+44-2080874308",
                  "email": "admin@taxsimba.co.uk",
                  "areaServed": "GB",
                  "availableLanguage": ["English"]
                },
                {
                  "@type": "ContactPoint",
                  "contactType": "technical support",
                  "telephone": "+44-2080874308",
                  "email": "admin@taxsimba.co.uk",
                  "areaServed": "GB",
                  "availableLanguage": ["English"]
                }
              ],

              "makesOffer": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Self-Assessment Tax Return Filing",
                    "description": "Complete HMRC tax return submission with expert review"
                  },
                  "price": "120",
                  "priceCurrency": "GBP",
                  "availability": "https://schema.org/InStock",
                  "validFrom": "2025-01-01",
                  "priceValidUntil": "2027-04-05"
                }
              ],

              "potentialAction": {
                "@type": "ReserveAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://taxsimba.co.uk/tax-return-form",
                  "actionPlatform": [
                    "http://schema.org/DesktopWebPlatform",
                    "http://schema.org/MobileWebPlatform"
                  ]
                },
                "result": {
                  "@type": "Reservation",
                  "name": "Book Tax Filing Service"
                }
              },

              "keywords": "tax filing UK, self assessment, HMRC tax return, accountant London, tax services, self employed tax, landlord tax return, company director tax",

              "slogan": "Taxes Made Simple. Fast. Affordable. Expert-Handled.",

              "foundingDate": "2011",

              "numberOfEmployees": {
                "@type": "QuantitativeValue",
                "value": "10"
              },

              "knowsAbout": [
                "Self-Assessment Tax Returns",
                "HMRC Tax Filing",
                "Tax Consultancy",
                "Self-Employed Tax",
                "Landlord Tax Returns",
                "UK Tax Law"
              ],

              "additionalType": [
                "https://schema.org/AccountingService",
                "https://schema.org/FinancialService",
                "https://schema.org/ProfessionalService"
              ]
            }
          )
        }} />


    <div className={styles.page}>
      <main className={styles.main}>
        <PageClient />
      </main>
    </div>
    </>
  );
}
