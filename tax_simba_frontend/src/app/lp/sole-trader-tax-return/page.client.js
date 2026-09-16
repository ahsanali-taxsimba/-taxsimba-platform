"use client";

import { useCatalogueFromPrice, formatIntervalSuffix } from "@/hooks/useCatalogueFromPrice";
import PpcSaPackages from "@/components/ppc/PpcSaPackages";
import {
  PpcHero,
  PpcTrustStrip,
  PpcHowItWorks,
  PpcConcerns,
  PpcUsefulSection,
  PpcFaqs,
  PpcFinalCta,
  PpcStickyCta,
} from "@/components/ppc/PpcLandingBits";

const LANDING = "/lp/sole-trader-tax-return";
const PRIMARY_HREF = "/register";
const PRIMARY_LABEL = "Start My Tax Return";

const concerns = [
  {
    q: "Not sure what expenses are relevant?",
    a: "Send us what you have. Your accountant will help sort what may apply to your business.",
  },
  {
    q: "Records feel confusing?",
    a: "You do not need perfect books before you start. We will guide you on what we need.",
  },
  {
    q: "First time doing Self Assessment?",
    a: "That is fine. Many sole traders start here. We keep the process clear.",
  },
  {
    q: "Not sure if MTD applies?",
    a: "You can check eligibility separately. It does not stop you starting your tax return.",
  },
];

const faqs = [
  {
    q: "Do I need to be good with tax software?",
    a: "No. TaxSimba is accountant-led. You send information. Your accountant prepares the return.",
  },
  {
    q: "What do I need to send?",
    a: "Your income details, expense records and any other information needed for your return. We will tell you what is missing.",
  },
  {
    q: "Will I review the return before filing?",
    a: "Yes. Where that step applies, you review and approve before filing.",
  },
  {
    q: "How much does it cost?",
    a: "Live Self Assessment packages and prices are shown on this page from our current catalogue.",
  },
  {
    q: "What if Making Tax Digital also applies?",
    a: "Use Check if I need MTD for guidance. MTD is a separate journey from your Self Assessment return.",
  },
];

export default function PpcSoleTraderClient() {
  const { fromPrice, interval } = useCatalogueFromPrice("taxSimba");

  return (
    <div className="ppc-landing ppc-sa">
      <PpcHero
        service="SA"
        landingPage={LANDING}
        title={
          <>
            You run your business.
            <br />
            We help with your tax.
          </>
        }
        subtitle="Send us your income and expenses. Your accountant will prepare your tax return for you to review."
        primaryHref={PRIMARY_HREF}
        primaryLabel={PRIMARY_LABEL}
        fromPrice={fromPrice}
        fromPriceSuffix={formatIntervalSuffix(interval)}
        secondaryHref="/check-mtd"
        secondaryLabel="Not sure if MTD applies? Check if I need MTD"
      />

      <PpcTrustStrip
        items={["Accountant-led", "You send the records", "You review before filing", "UK-based support"]}
      />

      <PpcConcerns title="Common sole trader concerns" items={concerns} />

      <PpcHowItWorks
        title="What happens next"
        steps={[
          { title: "Create your account", text: "Register and start your Self Assessment journey." },
          { title: "Choose your package", text: "Pick the live package that fits your situation." },
          { title: "Send us what we need", text: "Share your income, expenses and supporting records." },
          { title: "Your accountant gets to work", text: "Your accountant prepares the return for you to review." },
        ]}
      />

      <PpcUsefulSection
        variant="light"
        title="Business expenses"
        intro="Some business expenses may reduce your taxable profit. What you can claim depends on your circumstances and HMRC rules."
        items={[
          "Office costs",
          "Business travel",
          "Staff costs",
          "Business premises",
          "Insurance and relevant financial costs",
          "Advertising",
          "Qualifying business training",
        ]}
        note="Your accountant will review the information relevant to your return. We do not claim every expense is allowable."
      />

      <PpcSaPackages
        service="SA"
        landingPage={LANDING}
        primaryHref={PRIMARY_HREF}
        primaryLabel={PRIMARY_LABEL}
        sectionTitle="Self Assessment packages"
      />

      <PpcFaqs items={faqs} />

      <PpcFinalCta
        service="SA"
        landingPage={LANDING}
        title="Ready to get your tax return done?"
        text="Create your account and send us what we need."
        href={PRIMARY_HREF}
        label={PRIMARY_LABEL}
      />

      <PpcStickyCta service="SA" landingPage={LANDING} href={PRIMARY_HREF} label={PRIMARY_LABEL} />
    </div>
  );
}
