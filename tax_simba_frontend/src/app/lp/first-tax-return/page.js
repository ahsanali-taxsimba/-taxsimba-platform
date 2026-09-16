import { Suspense } from "react";
import PpcFirstTaxReturnClient from "./page.client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "First Tax Return | TaxSimba",
  description:
    "First Self Assessment? We guide you through it. Tell us about your situation. Your accountant prepares your tax return for you to review.",
  path: "/lp/first-tax-return",
  robots: { index: false, follow: true },
});

export default function PpcFirstTaxReturnPage() {
  return (
    <Suspense fallback={null}>
      <PpcFirstTaxReturnClient />
    </Suspense>
  );
}
