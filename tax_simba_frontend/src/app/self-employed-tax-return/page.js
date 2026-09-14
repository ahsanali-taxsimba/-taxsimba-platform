import SelfEmployedTaxReturnClient from "./page.client";
import { buildPageMetadata, breadcrumbJsonLd } from "@/lib/seo";

export function generateMetadata() {
  return buildPageMetadata({
    title: "MTD for Sole Traders | Making Tax Digital Self-Employment | TaxSimba",
    description:
      "Making Tax Digital for sole traders: who may be in scope, qualifying income, digital records, quarterly updates, and TaxSimba’s accountant-led MTD service.",
    path: "/self-employed-tax-return",
    ogImageAlt: "Making Tax Digital support for UK sole traders",
    keywords: [
      "MTD for sole traders",
      "Making Tax Digital self-employed",
      "sole trader MTD accountant",
      "TaxSimba",
    ],
  });
}

export default function Page() {
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "MTD for Sole Traders", path: "/self-employed-tax-return" },
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <SelfEmployedTaxReturnClient />
    </>
  );
}
