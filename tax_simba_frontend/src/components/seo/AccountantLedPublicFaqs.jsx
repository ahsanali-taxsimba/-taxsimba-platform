"use client";

import { Accordion, Col, Container, Row } from "react-bootstrap";

/** Shared accountant-led public FAQs for legacy service / marketing pages. */
export const ACCOUNTANT_LED_PUBLIC_FAQS = [
  {
    q: "What is TaxSimba?",
    a: "TaxSimba is an accountant-led UK Self Assessment and Making Tax Digital service. You provide your information and documents; a TaxSimba accountant prepares and reviews your tax work; you review and approve before filing or submission where that step applies. It is not DIY tax-filing software.",
  },
  {
    q: "How does the accountant-led process work?",
    a: "You share your details and documents through TaxSimba. Your accountant prepares the relevant Self Assessment return or Making Tax Digital work. You review and approve where required, then filing or submission is handled as part of the managed service. You remain responsible for the accuracy of information you provide.",
  },
  {
    q: "Can I check if Making Tax Digital applies before I pay?",
    a: "Yes. You can use our free MTD checker without creating an account. When you are ready, live package details are shown on the pricing page. Choosing a package is separate from using the checker.",
  },
  {
    q: "Is my data safe?",
    a: "TaxSimba protects data in transit with industry-standard SSL encryption and handles personal and financial information in line with GDPR and UK data protection law. We do not sell your data to third parties.",
  },
  {
    q: "Where can I see packages and what is included?",
    a: "Package options and live prices are listed on the pricing page. Self Assessment and Making Tax Digital services are set out separately so you can choose the journey that matches your situation.",
  },
];

/**
 * Drop-in FAQ section matching the common two-column layout used on legacy pages.
 */
export default function AccountantLedPublicFaqs({
  title = (
    <>
      Your Complete <span>Compliance Guide</span>
    </>
  ),
  faqs = ACCOUNTANT_LED_PUBLIC_FAQS,
  imageSrc = "/images/faq-img.png",
  imageAlt = "TaxSimba FAQ",
  className = "faq-section ptb-80",
}) {
  return (
    <section className={className}>
      <Container>
        <Row>
          <Col lg={5} md={12} sm={12} xs={12} className="mb-lg-0 mb-4">
            <div className="common-title mb-lg-0 mb-4 px-0">
              <h2 className="text-start">{title}</h2>
            </div>
            <div className="faq-img">
              <img src={imageSrc} className="img-fluid" alt={imageAlt} />
            </div>
          </Col>
          <Col lg={7} md={12} sm={12} xs={12}>
            <div className="faq-outer">
              <Accordion defaultActiveKey="0">
                {faqs.map((item, idx) => (
                  <Accordion.Item eventKey={String(idx)} key={item.q}>
                    <Accordion.Header>{item.q}</Accordion.Header>
                    <Accordion.Body>{item.a}</Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}
