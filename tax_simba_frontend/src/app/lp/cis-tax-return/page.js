import { Suspense } from "react";
import PpcCisClient from "./page.client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "CIS Tax Return | TaxSimba",
  description:
    "Accountant-led help with your CIS tax return. Send CIS statements and records. Your accountant prepares the return and accounts for CIS deductions.",
  path: "/lp/cis-tax-return",
  robots: { index: false, follow: true },
});

export default function PpcCisPage() {
  return (
    <Suspense fallback={null}>
      <PpcCisClient />
    </Suspense>
  );
}
