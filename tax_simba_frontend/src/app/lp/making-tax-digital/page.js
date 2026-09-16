import { Suspense } from "react";
import PpcMakingTaxDigitalClient from "./page.client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Making Tax Digital Accountant Support | TaxSimba",
  description:
    "Accountant-led Making Tax Digital for Income Tax support. Provide your records; TaxSimba accountants help manage the MTD workflow — not DIY-only software.",
  path: "/lp/making-tax-digital",
  robots: { index: false, follow: true },
});

export default function PpcMakingTaxDigitalPage() {
  return (
    <Suspense fallback={null}>
      <PpcMakingTaxDigitalClient />
    </Suspense>
  );
}
