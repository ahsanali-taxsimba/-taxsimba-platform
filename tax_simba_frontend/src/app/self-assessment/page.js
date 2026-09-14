import SelfAssessmentClient from "./page.client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Online Self Assessment Accountant | TaxSimba",
  description:
    "Accountant-led online Self Assessment for sole traders, landlords and freelancers. Upload your information, your accountant prepares the return, and you review before filing.",
  path: "/self-assessment",
});

export default function SelfAssessmentPage() {
  return <SelfAssessmentClient />;
}
