import React from 'react'
import ServicesClient from './page.client'
import fetchJSON from '@/lib/fetchJSON';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://taxsimba.co.uk';

// Fetch all services from API
async function getAllServices() {
  const url = `${process.env.NEXT_PUBLIC_API_URL}services`;
  try {
    const data = await fetchJSON(url, { next: { revalidate: 0 } });
    return data?.data || [];
  } catch (err) {
    console.error('Failed to load services list', err);
    return [];
  }
  
  // Old db.json implementation (commented out)
  // const url = new URL('/db.json', baseUrl).toString();
  // try {
  //   const data = await fetchJSON(url, { next: { revalidate: 120 } });
  //   return data?.services || [];
  // } catch (err) {
  //   console.error('Failed to load services list', err);
  //   return [];
  // }
}

export function generateMetadata() {
  const baseUrlEnv = process.env.NEXT_PUBLIC_BASE_URL || baseUrl;
  const canonicalUrl = `${baseUrlEnv}/services`;
  const ogImageUrl = new URL("/images/logo.png", baseUrlEnv).toString();

  return {
    title: "Tax Services in the UK | Self Assessment & More | TaxSimba",
    description: "TaxSimba offers complete UK tax and accounting services—tax filing, VAT, payroll, bookkeeping, and expert advice to help you stay compliant and save time.",
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
      title: "Tax Services in the UK | Self Assessment & More | TaxSimba",
      description: "TaxSimba offers complete UK tax and accounting services—tax filing, VAT, payroll, bookkeeping, and expert advice to help you stay compliant and save time.",
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
      title: "Tax Services in the UK | Self Assessment & More | TaxSimba",
      description: "TaxSimba offers complete UK tax and accounting services—tax filing, VAT, payroll, bookkeeping, and expert advice to help you stay compliant and save time.",
      images: [
        {
          url: ogImageUrl,
          alt: "TaxSimba logo",
        },
      ],
    },
  };
}
 
const Services = async () => {
  const services = await getAllServices();
  console.log("services server page",services);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
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
                    "email": "contact@taxsimba.com",
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
                  "@id": "https://taxsimba.co.uk/services#webpage",
                  "url": "https://taxsimba.co.uk/services",
                  "name": "Tax Services in the UK | Self Assessment & More | TaxSimba",
                  "description": "Fast, simple & affordable tax filing in the UK. Expert tax services including CIS returns, self-employed returns, rental income, and more. Only £120 per return.",
                  "isPartOf": {
                    "@type": "WebSite",
                    "url": "https://taxsimba.co.uk",
                    "name": "TaxSimba"
                  },
                  "breadcrumb": {
                    "@id": "https://taxsimba.co.uk/services#breadcrumb"
                  },
                  "about": {
                    "@id": "https://taxsimba.co.uk/#organization"
                  }
                },
                {
                  "@type": "BreadcrumbList",
                  "@id": "https://taxsimba.co.uk/services#breadcrumb",
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
                      "name": "Services",
                      "item": "https://taxsimba.co.uk/services"
                    }
                  ]
                },
                {
                  "@type": "Service",
                  "@id": "https://taxsimba.co.uk/services#service",
                  "name": "TaxSimba Tax Filing Services",
                  "description": "Fast, simple & affordable tax filing services in the UK. Dedicated tax professionals providing accurate, hassle-free personal tax return services.",
                  "provider": {
                    "@id": "https://taxsimba.co.uk/#organization"
                  },
                  "areaServed": {
                    "@type": "Country",
                    "name": "United Kingdom"
                  },
                  "category": "Tax Preparation and Filing Services",
                  "hasOfferCatalog": {
                    "@type": "OfferCatalog",
                    "name": "Tax Filing Services",
                    "itemListElement": [
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "CIS Tax Returns",
                          "description": "Construction Industry Scheme (CIS) tax return services for contractors and subcontractors",
                          "url": "https://taxsimba.co.uk/services/cis-tax-returns"
                        },
                        "price": "120",
                        "priceCurrency": "GBP"
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Self-Employed Tax Return Services UK",
                          "description": "Comprehensive tax return services for self-employed individuals and freelancers in the UK",
                          "url": "https://taxsimba.co.uk/services/self-employed-tax-return-services-uk"
                        },
                        "price": "120",
                        "priceCurrency": "GBP"
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Rental Income Tax Returns",
                          "description": "Tax return services for landlords and property owners with rental income",
                          "url": "https://taxsimba.co.uk/services/rental-income-tax-returns"
                        },
                        "price": "120",
                        "priceCurrency": "GBP"
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Private Client Tax Returns",
                          "description": "Personalized tax return services for private clients with various income sources",
                          "url": "https://taxsimba.co.uk/services/private-client-tax-returns"
                        },
                        "price": "120",
                        "priceCurrency": "GBP"
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Capital Gains Tax Returns & Advice",
                          "description": "Expert capital gains tax return filing and advisory services",
                          "url": "https://taxsimba.co.uk/services/capital-gains-tax-returns-advice"
                        },
                        "price": "120",
                        "priceCurrency": "GBP"
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "High Net Worth Individuals Tax Returns",
                          "description": "Specialized tax return services for high net worth individuals with complex financial portfolios",
                          "url": "https://taxsimba.co.uk/services/high-net-worth-individuals-tax-returns"
                        },
                        "price": "120",
                        "priceCurrency": "GBP"
                      },
                      {
                        "@type": "Offer",
                        "itemOffered": {
                          "@type": "Service",
                          "name": "Non-Resident Landlord Taxes & Expat Tax Services UK",
                          "description": "Tax services for non-resident landlords and UK expats with UK-based income",
                          "url": "https://taxsimba.co.uk/services/non-resident-landlord-taxes-expat-tax-services-uk"
                        },
                        "price": "120",
                        "priceCurrency": "GBP"
                      }
                    ]
                  }
                },
                {
                  "@type": "ItemList",
                  "@id": "https://taxsimba.co.uk/services#servicelist",
                  "name": "TaxSimba Tax Services",
                  "itemListElement": [
                    {
                      "@type": "ListItem",
                      "position": 1,
                      "item": {
                        "@type": "Service",
                        "name": "CIS Tax Returns",
                        "url": "https://taxsimba.co.uk/services/cis-tax-returns"
                      }
                    },
                    {
                      "@type": "ListItem",
                      "position": 2,
                      "item": {
                        "@type": "Service",
                        "name": "Self-Employed Tax Return Services UK",
                        "url": "https://taxsimba.co.uk/services/self-employed-tax-return-services-uk"
                      }
                    },
                    {
                      "@type": "ListItem",
                      "position": 3,
                      "item": {
                        "@type": "Service",
                        "name": "Rental Income Tax Returns",
                        "url": "https://taxsimba.co.uk/services/rental-income-tax-returns"
                      }
                    },
                    {
                      "@type": "ListItem",
                      "position": 4,
                      "item": {
                        "@type": "Service",
                        "name": "Private Client Tax Returns",
                        "url": "https://taxsimba.co.uk/services/private-client-tax-returns"
                      }
                    },
                    {
                      "@type": "ListItem",
                      "position": 5,
                      "item": {
                        "@type": "Service",
                        "name": "Capital Gains Tax Returns & Advice",
                        "url": "https://taxsimba.co.uk/services/capital-gains-tax-returns-advice"
                      }
                    },
                    {
                      "@type": "ListItem",
                      "position": 6,
                      "item": {
                        "@type": "Service",
                        "name": "High Net Worth Individuals Tax Returns",
                        "url": "https://taxsimba.co.uk/services/high-net-worth-individuals-tax-returns"
                      }
                    },
                    {
                      "@type": "ListItem",
                      "position": 7,
                      "item": {
                        "@type": "Service",
                        "name": "Non-Resident Landlord Taxes & Expat Tax Services UK",
                        "url": "https://taxsimba.co.uk/services/non-resident-landlord-taxes-expat-tax-services-uk"
                      }
                    }
                  ]
                },
                {
                  "@type": "Product",
                  "@id": "https://taxsimba.co.uk/services#product",
                  "name": "Tax Return Filing Service",
                  "description": "Professional tax filing services with transparent pricing at £120 per return. Fast, hassle-free, and paper-free tax filing with dedicated tax professionals.",
                  "brand": {
                    "@id": "https://taxsimba.co.uk/#organization"
                  },
                  "offers": {
                    "@type": "Offer",
                    "price": "120",
                    "priceCurrency": "GBP",
                    "availability": "https://schema.org/InStock",
                    "url": "https://taxsimba.co.uk/services",
                    "itemCondition": "https://schema.org/NewCondition"
                  }
                }
              ]
            }

          )
        }}
    />
    <ServicesClient services={services} />
    </>
  )
}

export default Services;
