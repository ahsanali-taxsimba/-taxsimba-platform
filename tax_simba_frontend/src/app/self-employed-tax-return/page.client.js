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
    q: "I’m self-employed with a small side hustle — does MTD apply?",
    a: "It depends on your qualifying income and HMRC’s phased rules. Use GOV.UK guidance and our MTD checker, then speak to an accountant if your income mix is unclear.",
  },
  {
    q: "Do I still need Self Assessment if I’m on MTD?",
    a: "MTD changes how qualifying income is recorded and updated during the year. Year-end obligations still matter. Follow current HMRC guidance for your case.",
  },
  {
    q: "What’s different from landlord MTD content?",
    a: "Sole traders focus on trading income, business expenses and self-employment records. Landlords focus on property income. The MTD idea is related, but the day-to-day records differ.",
  },
];

export default function SelfEmployedTaxReturnClient() {
  return (
    <>
      <SeoBreadcrumbHero
        title="MTD for sole traders"
        subtitle="Accountant-led Making Tax Digital support for self-employed people who need digital records and quarterly updates without DIY software pressure."
        imageSrc="/images/breadcrum-img.png"
        imageAlt="Making Tax Digital guidance for UK sole traders"
      />

      <section className="ptb-80">
        <Container>
          <div className="common-title mb-3">
            <h2>Immediate answer</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            If you are a <strong>sole trader looking for MTD help</strong>, focus on three things: whether you are in scope, how you will keep digital business records, and how quarterly updates will be submitted. TaxSimba offers an accountant-led MTD service so you can get support through a managed workflow rather than learning every software screen alone.
          </p>

          <Row className="g-4 mt-1">
            <Col md={4}>
              <div className="connect-box-card p-4 h-100">
                <h2 className="h5">Qualifying income</h2>
                <p className="mb-0">
                  HMRC looks at qualifying income from self-employment and/or property when deciding who enters MTD for Income Tax and when. Check official thresholds and dates — do not guess from social media summaries.
                </p>
              </div>
            </Col>
            <Col md={4}>
              <div className="connect-box-card p-4 h-100">
                <h2 className="h5">Digital records</h2>
                <p className="mb-0">
                  Sales, expenses and supporting evidence need to be kept digitally in a way that supports MTD reporting. Spreadsheet chaos at year end is the expensive habit MTD is designed to replace.
                </p>
              </div>
            </Col>
            <Col md={4}>
              <div className="connect-box-card p-4 h-100">
                <h2 className="h5">Quarterly updates</h2>
                <p className="mb-0">
                  In-scope traders send regular income and expense updates through compatible software or an agent, then deal with year-end finalisation as required.
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="ptb-80 bg-grey">
        <Container>
          <div className="common-title mb-3">
            <h2>Example</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            Riley is a self-employed electrician with income above the relevant MTD threshold for their start date. Riley photographs invoices, keeps a clear expense trail, and uses TaxSimba’s accountant-led MTD service so quarterly updates are prepared with human oversight rather than last-minute guesswork.
          </p>

          <div className="common-title mt-5 mb-3">
            <h2>Common mistake</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            Mixing personal and business spending in one account with no labels, then expecting an accountant to reconstruct the year in a weekend. MTD rewards cleaner records throughout the year.
          </p>

          <div className="common-title mt-5 mb-3">
            <h2>What sole traders should do next</h2>
          </div>
          <ol>
            <li>Confirm scope on GOV.UK and via the <Link href="/check-mtd">MTD checker</Link>.</li>
            <li>Separate business income and expenses as cleanly as you can.</li>
            <li>Store invoices and bank evidence digitally.</li>
            <li>Choose accountant-led support if you do not want to run MTD alone.</li>
            <li>Compare <Link href="/mtd-information">MTD packages</Link> and register when ready.</li>
          </ol>
        </Container>
      </section>

      <section className="ptb-80">
        <Container>
          <div className="common-title mb-3">
            <h2>How TaxSimba’s managed service helps sole traders</h2>
          </div>
          <p style={{ maxWidth: 820 }}>
            You provide trading information and documents. Our accountants use TaxSimba’s platform to help manage the MTD process. We are not positioning TaxSimba as DIY accounting software or an unsupervised filing robot.
          </p>
          <p style={{ maxWidth: 820 }}>
            If you also have property income, see our separate <Link href="/rental-income-tax">MTD for landlords</Link> page — the records and examples differ even when the MTD framework overlaps.
          </p>
        </Container>
      </section>

      <section className="faq-section ptb-80 bg-grey">
        <Container>
          <div className="common-title mb-4 text-center">
            <h2>Sole trader MTD FAQs</h2>
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
        title="Get sole trader MTD support"
        text="Register for TaxSimba’s Making Tax Digital service and work with an accountant-led team."
        href="/register?role=MTD"
        label="Register for MTD"
      />

      <SeoLinkList
        heading="Related pages"
        links={[
          { href: "/making-tax-digital", label: "Making Tax Digital accountant" },
          { href: "/mtd-information", label: "MTD packages" },
          { href: "/rental-income-tax", label: "MTD for landlords" },
          { href: "/self-employed-service", label: "Self-employed Self Assessment service" },
          { href: "/blogs/hmrc-signed-me-up-for-making-tax-digital", label: "HMRC signed me up for MTD" },
          { href: "/self-assessment", label: "Online Self Assessment accountant" },
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
          {
            label: "GOV.UK — Expenses if you're self-employed",
            url: "https://www.gov.uk/expenses-if-youre-self-employed",
          },
        ]}
      />
    </>
  );
}
