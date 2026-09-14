import SelfAssessmentClient from "./page.client";
import {
  buildPageMetadata,
  breadcrumbJsonLd,
  serviceJsonLd,
} from "@/lib/seo";

const title = "Online Self Assessment Accountant | TaxSimba";
const description =
  "Accountant-led online Self Assessment for sole traders, landlords and freelancers. Upload your information, your accountant prepares the return, and you review before filing.";

export const metadata = buildPageMetadata({
  title,
  description,
  path: "/self-assessment",
});

export default function SelfAssessmentPage() {
  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Self Assessment Accountant", path: "/self-assessment" },
    ]),
    serviceJsonLd({
      name: "Online Self Assessment accountant service",
      description,
      path: "/self-assessment",
      serviceType: "Self Assessment tax return preparation",
    }),
  ];

  return (
    <>
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
      <SelfAssessmentClient />
    </>
  );
}
