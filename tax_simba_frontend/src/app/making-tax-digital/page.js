import MakingTaxDigitalClient from "./page.client";
import { buildPageMetadata, breadcrumbJsonLd } from "@/lib/seo";

export function generateMetadata() {
  return buildPageMetadata({
    title: "Making Tax Digital Accountant | Accountant-Led MTD Service | TaxSimba",
    description:
      "Need a Making Tax Digital accountant? TaxSimba’s accountant-led MTD service helps sole traders and landlords with digital records, quarterly updates and ongoing support — without DIY software stress.",
    path: "/making-tax-digital",
    ogImageAlt: "TaxSimba Making Tax Digital accountant service",
    keywords: [
      "Making Tax Digital accountant",
      "MTD accountant",
      "MTD for Income Tax",
      "TaxSimba",
    ],
  });
}

export default function Page() {
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Making Tax Digital Accountant", path: "/making-tax-digital" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <MakingTaxDigitalClient />
    </>
  );
}
