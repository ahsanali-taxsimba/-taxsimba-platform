import MtdInfoClient from "./page.client";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Making Tax Digital Information | TaxSimba",
  description:
    "What Making Tax Digital for Income Tax means for sole traders and landlords: digital records, quarterly updates, key deadlines, and how TaxSimba’s accountant-led MTD service helps.",
  path: "/mtd-information",
});

export default function MtdInformationPage() {
  return <MtdInfoClient />;
}
