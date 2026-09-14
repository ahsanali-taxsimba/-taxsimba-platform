"use client";

import Link from "next/link";
import { Accordion, Col, Container, Row } from "react-bootstrap";
import { MdOutlineCheckCircle } from "react-icons/md";
import {
  SeoBreadcrumbHero,
  SeoCtaBand,
  SeoLinkList,
  SeoSources,
} from "@/components/seo/SeoLandingBits";

const faqs = [
  {
    q: "Is TaxSimba DIY MTD software?",
    a: "No. TaxSimba is an accountant-led service. Our platform supports the customer and accountant workflow; you are not left to become a tax-software expert on your own.",
  },
  {
    q: "Can an accountant act as my agent for MTD?",
    a: "Yes. Many people appoint an agent so an accountant can help manage Making Tax Digital obligations. You still need to provide complete and accurate records.",
  },
  {
    q: "Does MTD replace Self Assessment completely?",
    a: "MTD for Income Tax changes how qualifying income is recorded and reported during the year. You should still expect year-end obligations. Check GOV.UK for the rules that apply to you.",
  },
];

export default function MakingTaxDigitalClient() {
  return (
    <>
      <SeoBreadcrumbHero
        title="Making Tax Digital accountant"
        subtitle="Accountant-led MTD support for sole traders and landlords. TaxSimba accountants help manage the Making Tax Digital process using compatible software — you are not left to operate MTD software alone."
        imageSrc="/images/breadcrum-img.png"
        imageAlt="Making Tax Digital accountant support from TaxSimba"
        primaryCta={{ href: "/register?role=MTD", label: "Get MTD support" }}
        secondaryCta={{ href: "/check-mtd", label: "Check if I need MTD" }}
      />

      <section className="feature-bussiness-sec pd-100">
        <Container>
          <div className="common-title mb-4">
            <h2>Immediate answer</h2>
          </div>
          <p className="mb-4" style={{ maxWidth: 820 }}>
            If you want a <strong>Making Tax Digital accountant</strong>, look for an accountant-led service that can help with digital records, quarterly updates and the wider Income Tax process — not a promise of “set and forget” automation. TaxSimba’s MTD service is managed by accountants using a secure online workflow.
          </p>

          <Row className="g-4">
            <Col md={6}>
              <div className="connect-box-card h-100 p-4">
                <h2 className="h4">What MTD means in practice</h2>
                <p className="mb-0">
                  Making Tax Digital for Income Tax requires many people with qualifying self-employment and/or property income to keep digital records and send quarterly updates to HMRC. Exact thresholds and start dates are set by HMRC — always check current GOV.UK guidance.
                </p>
              </div>
            </Col>
            <Col md={6}>
              <div className="connect-box-card h-100 p-4">
                <h2 className="h4">Who this page is for</h2>
                <ul className="mb-0">
                  <li>Sole traders told MTD applies to them</li>
                  <li>Landlords with qualifying property income</li>
                  <li>People searching for an accountant to handle MTD</li>
                  <li>Clients who do not want DIY MTD software alone</li>
                </ul>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="ptb-80 bg-grey">
        <Container>
          <div className="common-title mb-4">
            <h2>How TaxSimba’s accountant-led MTD service works</h2>
          </div>
          <Row className="g-4">
            {[
              {
                t: "1. You share your situation",
                d: "Tell us about your self-employment and/or property income and provide the records an accountant needs.",
              },
              {
                t: "2. Accountants manage the workflow",
                d: "Our team helps organise digital records and MTD steps through TaxSimba’s platform — you are not left to interpret HMRC software alone.",
              },
              {
                t: "3. Quarterly rhythm, not a January scramble",
                d: "MTD is built around regular updates. We help you stay on that rhythm, then handle year-end steps as part of the managed service model.",
              },
              {
                t: "4. Clear responsibilities",
                d: "You remain responsible for complete, accurate information. We do not claim guaranteed compliance, guaranteed no penalties, or “HMRC approved accountant” status.",
              },
            ].map((item) => (
              <Col md={6} key={item.t}>
                <div className="p-4 h-100 bg-white rounded-3">
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
          <div className="common-title mb-4">
            <h2>Example</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            Alex runs a freelance design business and also lets a flat. HMRC confirms MTD for Income Tax applies. Instead of buying and learning multiple tools alone, Alex registers with TaxSimba for MTD support, uploads bank and income records, and works with an accountant-led process for quarterly updates.
          </p>

          <div className="common-title mt-5 mb-3">
            <h2>Common mistake</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            Waiting until the Self Assessment deadline to “sort MTD later.” Quarterly updates are part of the MTD design. Starting early with clear records is usually easier than reconstructing a year of activity at once.
          </p>

          <div className="common-title mt-5 mb-3">
            <h2>What you should do next</h2>
          </div>
          <ul>
            <li>Confirm whether MTD applies using HMRC/GOV.UK guidance or our <Link href="/check-mtd">MTD checker</Link>.</li>
            <li>Gather income, expense and property records.</li>
            <li>Decide whether you want accountant-led support.</li>
            <li>Review <Link href="/mtd-information">MTD packages</Link> and register for MTD if TaxSimba is the right fit.</li>
          </ul>
        </Container>
      </section>

      <section className="ptb-80 bg-grey">
        <Container>
          <div className="common-title mb-4 text-center">
            <h2>Why people choose an MTD accountant</h2>
          </div>
          <Row className="g-3">
            {[
              "Help interpreting what HMRC expects",
              "Support keeping digital records usable",
              "Managed quarterly update rhythm",
              "Human review instead of DIY guesswork",
            ].map((text) => (
              <Col md={6} key={text}>
                <div className="d-flex align-items-start gap-2">
                  <MdOutlineCheckCircle className="text-success mt-1" size={22} />
                  <p className="mb-0">{text}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="faq-section ptb-80">
        <Container>
          <div className="common-title mb-4 text-center">
            <h2>MTD accountant FAQs</h2>
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
        title="Ready for accountant-led MTD support?"
        text="Register for TaxSimba’s Making Tax Digital service and we’ll help you take the next step."
        href="/register?role=MTD"
        label="Get MTD support"
      />

      <SeoLinkList
        heading="Related pages"
        links={[
          { href: "/mtd-information", label: "MTD information and packages" },
          { href: "/check-mtd", label: "Check if MTD applies to you" },
          { href: "/rental-income-tax", label: "MTD for landlords" },
          { href: "/self-employed-tax-return", label: "MTD for sole traders" },
          { href: "/blogs/hmrc-signed-me-up-for-making-tax-digital", label: "HMRC signed me up for MTD — what do I do next?" },
          { href: "/blogs/mtd-qualifying-income", label: "MTD qualifying income explained" },
          { href: "/blogs/mtd-quarterly-updates", label: "MTD quarterly updates explained" },
          { href: "/blogs", label: "All tax guides" },
        ]}
      />

      <SeoSources
        sources={[
          {
            label: "GOV.UK — Use Making Tax Digital for Income Tax",
            url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
          },
          {
            label: "GOV.UK — Find out if and when you need to use Making Tax Digital for Income Tax",
            url: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax",
          },
        ]}
      />
    </>
  );
}
