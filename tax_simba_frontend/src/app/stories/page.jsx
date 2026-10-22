import stories from "../../../taxsimba-stories/stories.json";
import { listing } from "../../../taxsimba-stories/render.mjs";
import StoriesEnhancer from "./StoriesEnhancer";
import "../../../taxsimba-stories/stories.css";

export const metadata = {
  title: "Client Stories | TaxSimba",
  description: "Everyday tax problems. Clear steps forward.",
  robots: { index: false, follow: false },
};

const renderOptions = {
  // Root layout already supplies the shared site header and footer.
  includeChrome: false,
  // Keep package destinations on the current host (not absolute production URLs).
  siteBase: "",
  saPackagesPath: "/pricing#pricing-section",
  mtdPackagesPath: "/mtd-information#pricing-section",
};

export default function StoriesPage() {
  return <StoriesEnhancer html={listing(stories, renderOptions)} />;
}
