"use client";

import Link from "next/link";
import { Container } from "react-bootstrap";
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

const LANDING = "/lp/landlord-tax-return";
const PRIMARY_HREF = "/register";
const PRIMARY_LABEL = "Start My Landlord Tax Return";

const concerns = [
  {
    q: "What property expenses are relevant?",
    a: "It depends on the cost and your circumstances. Send what you have. Your accountant will review it.",
  },
  {
    q: "What records do I need?",
    a: "Rental income, property costs and supporting documents. We will tell you if anything is missing.",
  },
  {
    q: "Is this my first landlord tax return?",
    a: "That is fine. We keep the steps clear so you know what to send.",
  },
  {
    q: "Does MTD apply to my rental income?",
    a: "It may do. Use Check if I need MTD for guidance. Do not guess from one property alone.",
  },
];

const faqs = [
  {
    q: "Is this DIY tax software?",
    a: "No. TaxSimba is accountant-led. You send records. Your accountant prepares the return.",
  },
  {
    q: "Can you tell me what I can claim?",
    a: "Not from a landing page. The tax treatment depends on the type of cost and your circumstances. Your accountant reviews what is relevant to your return.",
  },
  {
    q: "Do I review before filing?",
    a: "Yes. Where that step applies, you review and approve before filing.",
  },
  {
    q: "How much does it cost?",
    a: "Live Self Assessment packages and prices are shown on this page from our current catalogue.",
  },
  {
    q: "How does MTD relate to rental income?",
    a: "MTD for Income Tax uses qualifying income rules set by HMRC. Use the MTD checker for a guidance-only indication.",
  },
];

export default function PpcLandlordClient() {
  const { fromPrice, interval } = useCatalogueFromPrice("taxSimba");

  return (
    <div className="ppc-landing ppc-sa">
      <PpcHero
        service="SA"
        landingPage={LANDING}
        title={
          <>
            Rental income can make tax complicated.
            <br />
            We make it simple.
          </>
        }
        subtitle="Send us your rental income and property expenses. Your accountant will prepare your tax return for you to review."
        primaryHref={PRIMARY_HREF}
        primaryLabel={PRIMARY_LABEL}
        fromPrice={fromPrice}
        fromPriceSuffix={formatIntervalSuffix(interval)}
        secondaryHref="/check-mtd"
        secondaryLabel="Not sure if MTD applies to you? Check if I need MTD"
      />

      <PpcTrustStrip
        items={["Accountant-led", "Rental income focused", "You review before filing", "UK-based support"]}
      />

      <PpcConcerns title="Common landlord concerns" items={concerns} />

      <section className="ppc-section py-4">
        <Container>
          <h2 className="ppc-section-title text-center mb-3">MTD and rental income</h2>
          <p className="ppc-mtd-note mb-2">
            Qualifying income is relevant gross self-employment and property income before expenses under HMRC rules. It is not assessed separately for each property.
          </p>
          <p className="ppc-mtd-note mb-3">
            From 6 April 2026: over £50,000. From 6 April 2027: over £30,000. From 6 April 2028: over £20,000.
          </p>
          <p className="text-center mb-0">
            <Link href="/check-mtd" className="ppc-secondary-link">
              Check if I need MTD
            </Link>
          </p>
        </Container>
      </section>

      <PpcHowItWorks
        title="What happens next"
        steps={[
          { title: "Create your account", text: "Register and start your landlord tax return journey." },
          { title: "Choose your package", text: "Pick the live package that fits your situation." },
          { title: "Send your rental records", text: "Share rental income, property costs and supporting documents." },
          { title: "Your accountant gets to work", text: "Your accountant prepares the return for you to review." },
        ]}
      />

      <PpcUsefulSection
        variant="light"
        title="Property costs"
        intro="Some property costs may be relevant to your return. The tax treatment depends on the type of cost and your circumstances."
        items={[
          "Repairs and maintenance",
          "Letting or management fees",
          "Insurance",
          "Relevant service costs",
          "Other allowable property expenses",
        ]}
        note="Mortgage interest, finance costs, capital improvements and purchase costs need careful treatment. Your accountant will review the information relevant to your return."
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
        title="Ready to start your landlord tax return?"
        text="Create your account and send your rental records."
        href={PRIMARY_HREF}
        label={PRIMARY_LABEL}
      />

      <PpcStickyCta service="SA" landingPage={LANDING} href={PRIMARY_HREF} label={PRIMARY_LABEL} />
    </div>
  );
}
