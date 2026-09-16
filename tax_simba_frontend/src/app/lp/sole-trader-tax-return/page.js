import { Suspense } from "react";
import PpcSoleTraderClient from "./page.client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Sole Trader Tax Return | TaxSimba",
  description:
    "Accountant-led help with your sole trader tax return. Send your income and expenses. Your accountant prepares the return for you to review.",
  path: "/lp/sole-trader-tax-return",
  robots: { index: false, follow: true },
});

export default function PpcSoleTraderPage() {
  return (
    <Suspense fallback={null}>
      <PpcSoleTraderClient />
    </Suspense>
  );
}
