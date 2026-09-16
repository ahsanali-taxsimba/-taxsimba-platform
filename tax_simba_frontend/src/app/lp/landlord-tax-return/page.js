import { Suspense } from "react";
import PpcLandlordClient from "./page.client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Landlord Tax Return | TaxSimba",
  description:
    "Accountant-led help with your landlord tax return. Send rental income and property expenses. Your accountant prepares the return for you to review.",
  path: "/lp/landlord-tax-return",
  robots: { index: false, follow: true },
});

export default function PpcLandlordPage() {
  return (
    <Suspense fallback={null}>
      <PpcLandlordClient />
    </Suspense>
  );
}
