"use client";

import Link from "next/link";
import { Accordion, Col, Container, Row } from "react-bootstrap";
import {
  SeoBreadcrumbHero,
  SeoCtaBand,
  SeoLinkList,
  SeoSources,
} from "@/components/seo/SeoLandingBits";

const faqs = [
  {
    q: "Does every landlord need MTD?",
    a: "No. MTD for Income Tax is being phased in based on HMRC’s rules for qualifying income and start dates. Check GOV.UK and our MTD checker for whether you appear to be in scope.",
  },
  {
    q: "What counts as property income for MTD?",
    a: "HMRC uses the idea of qualifying income from property (and/or self-employment). The official definition and thresholds are on GOV.UK — do not rely on informal estimates alone.",
  },
  {
    q: "What records should landlords keep?",
    a: "Keep clear digital records of rents received and allowable property expenses, with supporting evidence such as statements and invoices. Your accountant will tell you what is needed for your situation.",
  },
  {
    q: "Can TaxSimba help if I also have self-employment income?",
    a: "Yes. Many clients have mixed income. Tell us about both property and trading activity so the MTD workflow covers what applies to you.",
  },
  {
    q: "Self Assessment only or MTD — how do I choose?",
    a: "If MTD for Income Tax applies, you need the MTD journey (digital records and quarterly updates). If you only need an annual Self Assessment return prepared, start with our Self Assessment accountant service. Use the MTD checker if you are unsure.",
  },
];

export default function RentalIncomeTaxClient() {
  return (
    <>
      <SeoBreadcrumbHero
        title="MTD for landlords"
        subtitle="Making Tax Digital for Income Tax help for UK landlords who want accountant-led support with digital records and quarterly updates."
        imageSrc="/images/breadcrum-img.png"
        imageAlt="Making Tax Digital guidance for UK landlords"
      />

      <section className="ptb-80">
        <Container>
          <div className="common-title mb-3">
            <h2>Immediate answer</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            If you are a landlord looking for <strong>MTD help</strong>, the core duties are digital record-keeping for qualifying property income and sending quarterly updates to HMRC when you are in scope. An accountant-led service like TaxSimba can manage that process with you — you still need to supply accurate letting records.
          </p>

          <Row className="g-4 mt-2">
            <Col lg={6}>
              <div className="connect-box-card p-4 h-100">
                <h2 className="h4">What the rule means for landlords</h2>
                <p className="mb-0">
                  Making Tax Digital for Income Tax is not only a “business owner” topic. Property income can bring landlords into scope. That usually means keeping digital records of rents and allowable property expenses, then reporting through compatible software or an authorised agent on a quarterly rhythm.
                </p>
              </div>
            </Col>
            <Col lg={6}>
              <div className="connect-box-card p-4 h-100">
                <h2 className="h4">Who it can affect</h2>
                <ul className="mb-0">
                  <li>Individual landlords with qualifying property income</li>
                  <li>Landlords who also trade as sole traders</li>
                  <li>People who received an HMRC MTD notice</li>
                  <li>Hosts with taxable property-style letting income (check your facts against GOV.UK)</li>
                </ul>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="ptb-80 bg-grey">
        <Container>
          <div className="common-title mb-4">
            <h2>Landlord scenarios we commonly see</h2>
          </div>
          <Row className="g-4">
            {[
              {
                t: "Single buy-to-let",
                d: "One property, straightforward rents and expenses — still needs organised digital records if MTD applies.",
              },
              {
                t: "Portfolio landlord",
                d: "Multiple properties increase the value of consistent digital bookkeeping and accountant oversight.",
              },
              {
                t: "Landlord + side trade",
                d: "Property income plus self-employment can both feed into MTD qualifying income checks.",
              },
              {
                t: "First HMRC letter",
                d: "You have been told MTD applies and need a clear next-step plan rather than software jargon.",
              },
            ].map((item) => (
              <Col md={6} key={item.t}>
                <div className="bg-white p-4 h-100 rounded-3">
                  <h3 className="h5">{item.t}</h3>
                  <p className="mb-0">{item.d}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="ptb-80">
        <Container>
          <div className="common-title mb-3">
            <h2>Example</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            Jordan lets two flats. Rental income sits above the relevant HMRC threshold for their start date. Jordan keeps rent statements and repair invoices, appoints TaxSimba for MTD support, and works with an accountant-led process for quarterly updates instead of rebuilding everything each January.
          </p>

          <div className="common-title mt-5 mb-3">
            <h2>Common mistake</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            Treating MTD as “just another Self Assessment reminder.” Quarterly updates and digital records are part of the design. Leaving property paperwork in email threads and paper folders until year end makes MTD harder than it needs to be.
          </p>

          <div className="common-title mt-5 mb-3">
            <h2>What landlords should do next</h2>
          </div>
          <ol>
            <li>Check whether MTD applies using GOV.UK and our <Link href="/check-mtd">MTD checker</Link>.</li>
            <li>List each property and how rent is received.</li>
            <li>Collect expense evidence (repairs, agent fees, insurance, and similar allowable costs).</li>
            <li>Decide whether you want an accountant/agent to help.</li>
            <li>Review <Link href="/making-tax-digital">TaxSimba’s MTD accountant service</Link> and register if it fits.</li>
          </ol>
        </Container>
      </section>

      <section className="ptb-80 bg-grey">
        <Container>
          <div className="common-title mb-3">
            <h2>How TaxSimba helps landlords with MTD</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            TaxSimba is accountant-led. We help you organise property income information, manage the MTD workflow, and keep quarterly reporting on track. We do not describe ourselves as DIY landlord accounting software or promise guaranteed outcomes.
          </p>
        </Container>
      </section>

      <section className="faq-section ptb-80">
        <Container>
          <div className="common-title mb-4 text-center">
            <h2>Landlord MTD FAQs</h2>
          </div>
          <Accordion>
            {faqs.map((item, idx) => (
              <Accordion.Item eventKey={String(idx)} key={item.q}>
                <Accordion.Header>{item.q}</Accordion.Header>
                <Accordion.Body>{item.a}</Accordion.Body>
              </Accordion.Item>
            ))}
          </Accordion>
        </Container>
      </section>

      <SeoCtaBand
        title="Get landlord MTD support"
        text="Register for TaxSimba’s Making Tax Digital service and work with an accountant-led team."
        href="/register?role=MTD"
        label="Register for MTD"
      />

      <SeoLinkList
        heading="Related pages"
        links={[
          { href: "/making-tax-digital", label: "Making Tax Digital accountant overview" },
          { href: "/mtd-information", label: "MTD packages" },
          { href: "/self-employed-tax-return", label: "MTD for sole traders" },
          { href: "/rental-income-service", label: "Rental income Self Assessment service" },
          { href: "/blogs/hmrc-signed-me-up-for-making-tax-digital", label: "HMRC signed me up for MTD" },
          { href: "/self-assessment", label: "Online Self Assessment accountant" },
        ]}
      />

      <SeoSources
        sources={[
          {
            label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
            url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          },
          {
            label: "GOV.UK — Income Tax when you rent out a property: working out your rental income",
            url: "https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income",
          },
          {
            label: "GOV.UK — Work out your qualifying income for Making Tax Digital for Income Tax",
            url: "https://www.gov.uk/guidance/work-out-your-qualifying-income-for-making-tax-digital-for-income-tax",
          },
        ]}
      />
    </>
  );
}
