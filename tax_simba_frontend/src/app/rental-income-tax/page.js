import RentalIncomeTaxClient from "./page.client";
import { buildPageMetadata, breadcrumbJsonLd } from "@/lib/seo";

export function generateMetadata() {
  return buildPageMetadata({
    title: "MTD for Landlords | Making Tax Digital Property Income | TaxSimba",
    description:
      "Making Tax Digital for landlords explained: qualifying property income, digital records, quarterly updates, and how TaxSimba’s accountant-led MTD service can help.",
    path: "/rental-income-tax",
    ogImageAlt: "Making Tax Digital support for UK landlords",
    keywords: [
      "MTD for landlords",
      "Making Tax Digital property income",
      "landlord tax accountant",
      "TaxSimba",
    ],
  });
}

export default function Page() {
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "MTD for Landlords", path: "/rental-income-tax" },
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <RentalIncomeTaxClient />
    </>
  );
}
