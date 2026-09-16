"use client";

import { useCatalogueFromPrice, formatIntervalSuffix } from "@/hooks/useCatalogueFromPrice";
import PpcSaPackages from "@/components/ppc/PpcSaPackages";
import {
  PpcHero,
  PpcTrustStrip,
  PpcHowItWorks,
  PpcConcerns,
  PpcFaqs,
  PpcFinalCta,
  PpcStickyCta,
} from "@/components/ppc/PpcLandingBits";

const LANDING = "/lp/first-tax-return";
const PRIMARY_HREF = "/register";
const PRIMARY_LABEL = "Start My First Tax Return";

const concerns = [
  {
    q: "Do I need Self Assessment?",
    a: "It depends on your situation. Many people with self-employment, rental income or other untaxed income need to file. If you are unsure, start an account and tell us your situation.",
  },
  {
    q: "What information will I need?",
    a: "Income details, expense records and personal tax information. We will show you what we need after you start.",
  },
  {
    q: "Do I need to register with HMRC?",
    a: "Some people need to register for Self Assessment with HMRC. Your accountant can help you understand what applies to you.",
  },
  {
    q: "What happens after I start?",
    a: "You choose a package, tell us about your situation and send what we need. Your accountant prepares the return for you to review.",
  },
];

const faqs = [
  {
    q: "I feel nervous about my first return. Is that normal?",
    a: "Yes. Many people feel that way. We keep the steps clear and your accountant prepares the return.",
  },
  {
    q: "Is this DIY tax software?",
    a: "No. TaxSimba is accountant-led. You are not left to figure it out alone.",
  },
  {
    q: "Will I understand what I am reviewing?",
    a: "Your accountant prepares the return. Where review applies, you check it before filing. Ask questions if anything is unclear.",
  },
  {
    q: "How much does it cost?",
    a: "Live Self Assessment packages and prices are shown on this page from our current catalogue.",
  },
  {
    q: "How long does it take?",
    a: "Timing depends on how quickly you can send complete information. We do not promise fixed turnaround times on this page.",
  },
];

export default function PpcFirstTaxReturnClient() {
  const { fromPrice, interval } = useCatalogueFromPrice("taxSimba");

  return (
    <div className="ppc-landing ppc-sa">
      <PpcHero
        service="SA"
        landingPage={LANDING}
        title={
          <>
            First tax return?
            <br />
            We will guide you through it.
          </>
        }
        subtitle="Tell us about your situation. We will show you what we need. Your accountant will prepare your tax return for you to review."
        primaryHref={PRIMARY_HREF}
        primaryLabel={PRIMARY_LABEL}
        fromPrice={fromPrice}
        fromPriceSuffix={formatIntervalSuffix(interval)}
      />

      <PpcTrustStrip
        items={["Clear guidance", "Accountant-led", "You review before filing", "UK-based support"]}
      />

      <PpcConcerns title="Questions first-time filers ask" items={concerns} />

      <PpcHowItWorks
        title="What happens next"
        steps={[
          { title: "Create your account", text: "Register and start your first tax return journey." },
          { title: "Choose your package", text: "Pick the live package that fits your situation." },
          { title: "Tell us about your situation", text: "Share the income and records we ask for." },
          { title: "Your accountant prepares your return", text: "You review before filing where that step applies." },
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
        title="Ready to start your first tax return?"
        text="Create your account. We will guide you from there."
        href={PRIMARY_HREF}
        label={PRIMARY_LABEL}
      />

      <PpcStickyCta service="SA" landingPage={LANDING} href={PRIMARY_HREF} label={PRIMARY_LABEL} />
    </div>
  );
}
