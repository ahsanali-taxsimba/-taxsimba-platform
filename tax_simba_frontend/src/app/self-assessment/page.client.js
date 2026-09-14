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
    q: "Is TaxSimba automated tax software?",
    a: "No. TaxSimba is an accountant-led Self Assessment service. Software supports the workflow; your accountant prepares and reviews the return.",
  },
  {
    q: "Do I still need to approve the return?",
    a: "Yes. Where the process applies, you review the prepared return and approve before filing. You remain responsible for the accuracy of information you provide.",
  },
  {
    q: "Who is this suitable for?",
    a: "Sole traders, landlords, freelancers and other individuals who need help filing UK Self Assessment and prefer an accountant to prepare the return rather than DIY software alone.",
  },
  {
    q: "What about Making Tax Digital?",
    a: "If you also need MTD for Income Tax help, TaxSimba offers an accountant-led MTD service. See Making Tax Digital Accountant for that journey.",
  },
];

export default function SelfAssessmentClient() {
  return (
    <>
      <SeoBreadcrumbHero
        title="Online Self Assessment accountant"
        subtitle="Accountant-led online Self Assessment for sole traders, landlords and freelancers — you provide the information, your accountant prepares the return, and you review before filing where that step applies."
        imageSrc="/images/breadcrum-img.png"
        imageAlt="Online Self Assessment accountant support from TaxSimba"
      />

      <section className="feature-bussiness-sec pd-100">
        <Container>
          <div className="common-title mb-4">
            <h2>Immediate answer</h2>
          </div>
          <p className="mb-4" style={{ maxWidth: 820 }}>
            TaxSimba is an <strong>accountant-led online Self Assessment</strong> service. It is not DIY tax-filing
            software and not automated robot filing without accountant involvement. You share your documents; a
            TaxSimba accountant prepares and reviews your return; you review and approve before filing where that step
            applies.
          </p>

          <Row className="g-4">
            <Col md={6}>
              <div className="connect-box-card h-100 p-4">
                <h2 className="h4">Who it is suitable for</h2>
                <ul className="mb-0">
                  <li>Sole traders and freelancers with self-employment income</li>
                  <li>Landlords with UK rental income</li>
                  <li>People with mixed income who need a full SA return prepared properly</li>
                  <li>Anyone who wants an accountant to handle preparation rather than navigating every HMRC screen alone</li>
                </ul>
              </div>
            </Col>
            <Col md={6}>
              <div className="connect-box-card h-100 p-4">
                <h2 className="h4">What you usually provide</h2>
                <ul className="mb-0">
                  <li>Identity and HMRC reference details where needed</li>
                  <li>Income records (employment, self-employment, property, other)</li>
                  <li>Expense and allowance information that supports your return</li>
                  <li>Bank interest, dividends, capital gains or other income if relevant</li>
                  <li>Answers to clarifying questions from your accountant</li>
                </ul>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="ptb-80 bg-grey">
        <Container>
          <div className="common-title mb-4">
            <h2>How the accountant-led process works</h2>
          </div>
          <Row className="g-4">
            {[
              {
                t: "1. Register and choose your package",
                d: "Create your TaxSimba account and select the Self Assessment package that matches your situation.",
              },
              {
                t: "2. Upload information securely",
                d: "Share documents and answers through the client workflow so your accountant has what they need.",
              },
              {
                t: "3. Accountant prepares and reviews",
                d: "A qualified accountant prepares your Self Assessment return and checks it before you see the final version.",
              },
              {
                t: "4. You review and approve",
                d: "Where applicable, you review the prepared return and approve filing. You remain responsible for the accuracy of what you supplied.",
              },
            ].map((step) => (
              <Col md={6} key={step.t}>
                <div className="connect-box-card h-100 p-4">
                  <h3 className="h5">{step.t}</h3>
                  <p className="mb-0">{step.d}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="feature-bussiness-sec pd-100">
        <Container>
          <Row className="g-4">
            <Col lg={6}>
              <h2 className="h4">Deadline context</h2>
              <p>
                Online Self Assessment for a tax year is normally due by <strong>31 January</strong> following the end
                of the tax year. Filing late can lead to penalties. Check current HMRC guidance for your year and start
                early if your affairs are complex.
              </p>
              <p className="mb-0">
                TaxSimba helps you prepare and file through an accountant-led process — it does not remove HMRC
                deadlines or your responsibility for accurate information.
              </p>
            </Col>
            <Col lg={6}>
              <h2 className="h4">Common mistake</h2>
              <p>
                Leaving everything until January and then discovering missing invoices, rental statements or dividend
                vouchers. Gather records as you go, then use TaxSimba so your accountant can prepare the return without
                last-minute gaps.
              </p>
              <p className="mb-0">
                Example: Jordan freelances and also has a small rental flat. By October they upload bank exports and
                expense summaries in TaxSimba. Their accountant prepares the return in good time for review before the
                January deadline.
              </p>
            </Col>
          </Row>
          <p className="mt-4 mb-0">
            Next step:{" "}
            <Link href="/register">register for Self Assessment</Link>, or compare{" "}
            <Link href="/pricing">packages</Link> first. If you also need Making Tax Digital help, see our{" "}
            <Link href="/making-tax-digital">MTD accountant service</Link>.
          </p>
        </Container>
      </section>

      <section className="faq-section ptb-80">
        <Container>
          <div className="common-title mb-4 text-center">
            <h2>Self Assessment accountant FAQs</h2>
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
        title="Ready for accountant-led Self Assessment?"
        text="Register, choose your package, and let TaxSimba’s accountants prepare your online return with your review before filing."
        href="/register"
        label="Start Self Assessment"
      />

      <SeoLinkList
        heading="Related Self Assessment & MTD pages"
        links={[
          { href: "/self-assessment-guide", label: "Self Assessment guide" },
          { href: "/making-tax-digital", label: "Making Tax Digital accountant" },
          { href: "/blogs/self-assessment-deadline", label: "Self Assessment deadline 2027" },
          { href: "/blogs/self-assessment-documents-checklist", label: "Self Assessment documents checklist" },
          { href: "/blogs/understanding-self-assessment-uk", label: "Understanding Self Assessment" },
          { href: "/pricing", label: "Packages & pricing" },
        ]}
      />

      <SeoSources
        sources={[
          {
            label: "File your Self Assessment tax return — GOV.UK",
            url: "https://www.gov.uk/self-assessment-tax-returns",
          },
          {
            label: "Self Assessment tax returns: deadlines — GOV.UK",
            url: "https://www.gov.uk/self-assessment-tax-returns/deadlines",
          },
        ]}
      />
    </>
  );
}
