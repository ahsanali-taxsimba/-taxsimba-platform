import { Suspense } from "react";
import PpcSelfAssessmentClient from "./page.client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Accountant-led Self Assessment | TaxSimba",
  description:
    "Accountant-led online Self Assessment for UK sole traders, landlords and freelancers. Provide your records, your accountant prepares the return, you review before filing.",
  path: "/lp/self-assessment",
  robots: { index: false, follow: true },
});

export default function PpcSelfAssessmentPage() {
  return (
    <Suspense fallback={null}>
      <PpcSelfAssessmentClient />
    </Suspense>
  );
}
