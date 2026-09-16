"use client";

import { useCatalogueFromPrice, formatIntervalSuffix } from "@/hooks/useCatalogueFromPrice";
import PpcSaPackages from "@/components/ppc/PpcSaPackages";
import {
  PpcHero,
  PpcTrustStrip,
  PpcHowItWorks,
  PpcConcerns,
  PpcUsefulSection,
  PpcAudienceTags,
  PpcFaqs,
  PpcFinalCta,
  PpcStickyCta,
} from "@/components/ppc/PpcLandingBits";

const LANDING = "/lp/cis-tax-return";
const PRIMARY_HREF = "/register";
const PRIMARY_LABEL = "Start My CIS Tax Return";

const concerns = [
  {
    q: "Already had CIS tax deducted?",
    a: "Those deductions are taken into account when your final tax position is worked out. We do not assume you are due a refund.",
  },
  {
    q: "Not sure what expenses are relevant?",
    a: "Send what you have. Your accountant will review what may apply to your circumstances.",
  },
  {
    q: "Not sure which CIS statements you need?",
    a: "Payment and deduction statements help. We will tell you if anything else is needed.",
  },
  {
    q: "Tax to pay or a refund?",
    a: "That depends on your full tax position. CIS deductions are only part of the picture.",
  },
];

const faqs = [
  {
    q: "Do you guarantee a CIS refund?",
    a: "No. We do not promise refunds. Your accountant works out your tax position from your records and CIS deductions.",
  },
  {
    q: "Is TaxSimba DIY software?",
    a: "No. It is accountant-led. You send statements and records. Your accountant prepares the return.",
  },
  {
    q: "What do I need to send?",
    a: "CIS payment and deduction statements, income information and relevant expense records. We handle this through the secure customer journey.",
  },
  {
    q: "Will I review before filing?",
    a: "Yes. Where that step applies, you review and approve before filing.",
  },
  {
    q: "How much does it cost?",
    a: "Live Self Assessment packages and prices are shown on this page from our current catalogue.",
  },
];

export default function PpcCisClient() {
  const { fromPrice, interval } = useCatalogueFromPrice("taxSimba");

  return (
    <div className="ppc-landing ppc-sa">
      <PpcHero
        service="SA"
        landingPage={LANDING}
        title={
          <>
            Had tax deducted under CIS?
            <br />
            We can help with your tax return.
          </>
        }
        subtitle="Send us your CIS statements and relevant records. Your accountant will prepare your tax return and account for your CIS deductions."
        primaryHref={PRIMARY_HREF}
        primaryLabel={PRIMARY_LABEL}
        fromPrice={fromPrice}
        fromPriceSuffix={formatIntervalSuffix(interval)}
      />

      <PpcTrustStrip
        items={["Accountant-led", "CIS deductions reviewed", "You review before filing", "UK-based support"]}
      />

      <PpcConcerns title="Common CIS questions" items={concerns} />

      <PpcAudienceTags
        title="Who this is for"
        items={[
          "Builders",
          "Electricians",
          "Plumbers",
          "Carpenters",
          "Plasterers",
          "Decorators",
          "Groundworkers",
          "Other CIS subcontractors",
        ]}
      />

      <PpcUsefulSection
        title="What to send"
        intro="Keep this simple. The secure customer journey is where you share documents."
        items={[
          "CIS payment and deduction statements",
          "Income information",
          "Relevant expense records",
          "Other information needed for the return",
        ]}
        note="Do not send sensitive information by email from this page. Upload through your TaxSimba account after you register."
      />

      <PpcHowItWorks
        title="What happens next"
        steps={[
          { title: "Create your account", text: "Register and start your CIS tax return journey." },
          { title: "Choose your package", text: "Pick the live package that fits your situation." },
          { title: "Send your CIS records", text: "Share statements, income and relevant expenses." },
          { title: "Your accountant gets to work", text: "Your accountant works out your tax position for you to review." },
        ]}
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
        title="Ready to start your CIS tax return?"
        text="Create your account and send your CIS statements."
        href={PRIMARY_HREF}
        label={PRIMARY_LABEL}
      />

      <PpcStickyCta service="SA" landingPage={LANDING} href={PRIMARY_HREF} label={PRIMARY_LABEL} />
    </div>
  );
}
