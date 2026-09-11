import React from 'react'
import { Accordion, Col, Container, Row } from 'react-bootstrap'

function FaqSection() {
    return (
        <>
            {/* FAQ Section Start */}
            <section className="faq-section ptb-80">
                <Container>
                    <Row>
                        <Col lg={5} md={12} sm={12} xs={12} className="mb-lg-0 mb-4">
                            <div className="common-title mb-lg-0 mb-4 px-0">
                                <h2 className="text-start">Your Complete <span>Compliance Guide</span></h2>
                            </div>

                            <div className="faq-img">
                                <img src="/images/faq-img.png" className="img-fluid" alt="faq-img" />
                            </div>
                        </Col>

                        <Col lg={7} md={12} sm={12} xs={12}>

                            <div className="faq-outer">
                                <Accordion defaultActiveKey="0">
                                    <Accordion.Item eventKey="0">
                                        <Accordion.Header>What is TaxSimba?  </Accordion.Header>
                                        <Accordion.Body>
                                            TaxSimba is a UK tax filing platform designed to simplify Self Assessment for self-employed individuals, landlords, CIS contractors, and private clients. By replacing complex HMRC forms with a guided, question-based process, TaxSimba allows customers to complete their tax return quickly and accurately. Our certified accountants review every submission before filing, significantly reducing the risk of errors or missed deductions.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                    <Accordion.Item eventKey="1">
                                        <Accordion.Header>Can I try TaxSimba before paying?</Accordion.Header>
                                        <Accordion.Body>
                                            Yes — you can use our free MTD Eligibility Checker without creating an account, to find out whether Making Tax Digital applies to you. Once you&apos;re ready to file, our fixed-fee service starts at £120 per return with no hidden charges.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                    <Accordion.Item eventKey="2">
                                        <Accordion.Header>Is my data safe?</Accordion.Header>
                                        <Accordion.Body>
                                            Security is a fundamental pillar of TaxSimba. All data transmitted between your device and our servers is protected using industry-standard SSL encryption. We handle all personal and financial information in accordance with GDPR and UK data protection law. We never sell or share your data with third parties without your explicit consent.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                    <Accordion.Item eventKey="3">
                                        <Accordion.Header>What is your cancellation policy?</Accordion.Header>
                                        <Accordion.Body>
                                            TaxSimba operates on a pay-per-service basis — you only pay for the tax return filings you complete. There is no ongoing subscription or long-term commitment required. You can stop using our services at any time.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                    <Accordion.Item eventKey="4">
                                        <Accordion.Header>Does TaxSimba work on mobile?</Accordion.Header>
                                        <Accordion.Body>
                                            Yes. The TaxSimba website is fully responsive and works on any smartphone, tablet, or desktop browser — no app download needed. You can upload documents, check your MTD eligibility, and communicate with your accountant from any device.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                </Accordion>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
            {/* FAQ Section End */}

        </>
    )
}

export default FaqSection