import React from 'react'
import CookiePolicyClient from './page.client'

export function generateMetadata() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://taxsimba.co.uk";
    const canonicalUrl = `${baseUrl}/cookie-policy`;
    const ogImageUrl = new URL("/images/logo.png", baseUrl).toString();

    return {
        title: "Cookie Policy | TaxSimba UK – Data Protection & Security",
        description: "Learn how TaxSimba uses cookies to enhance your experience. Our Cookie Policy ensures transparency, security, and full compliance with UK data protection standards.",
        robots: "index, follow",
        alternates: {
            canonical: canonicalUrl
        },

        // Open Graph
        openGraph: {
            locale: "en_GB",
            type: "website",
            siteName: "TaxSimba",
            title: "Cookie Policy | TaxSimba UK – Data Protection & Security",
            description: "Learn how TaxSimba uses cookies to enhance your experience. Our Cookie Policy ensures transparency, security, and full compliance with UK data protection standards.",
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
            site: "@TaxSimba",
            title: "Cookie Policy | TaxSimba UK – Data Protection & Security",
            description: "Learn how TaxSimba uses cookies to enhance your experience. Our Cookie Policy ensures transparency, security, and full compliance with UK data protection standards.",
            images: [
                {
                    url: ogImageUrl,
                    alt: "TaxSimba logo",
                },
            ],
        },
    };
}

const CookiePolicy = () => {
    return (
        <>
            <CookiePolicyClient />
        </>
    )
}

export default CookiePolicy