"use client";

import React from 'react';
import Link from "next/link";
import { Accordion, Col, Container, Row } from 'react-bootstrap';
import { MdKeyboardDoubleArrowRight, MdOutlineCheckCircle } from "react-icons/md";

function page() {
    return (
        <>
            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h2 className="text-capitalize mb-3">Simple tax advice today...</h2>
                                <p>Get professional tax advice from a <span className="text-orange">qualified accountant for £139.</span></p>
                            </div>
                        </Col>
                        <Col lg={6} className="mt-lg-0 mt-5">
                            <div className="breadcrum-img text-center">
                                <img src="/images/breadcrum-img.png" alt="Breadcrumb Image" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="tax-problems-sec ptb-80">
                <Container>
                    <div className="common-title text-center mb-5">
                        <h2>Advice That <span>Makes Sense</span></h2>
                        <p>Simple, clear guidance on the tax issues that matter to you.</p>
                    </div>
                    <Row>
                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">01</div>
                                <span className="tax-problem-icon">
                                    <img src="/images/sel-employment.svg" alt="img" />
                                </span>
                                <h3>Self-Employment</h3>
                                <p>Manage allowable expenses, deductions, and filing requirements for your self-employed business.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">02</div>
                                <span className="tax-problem-icon">
                                    <img src="/images/tax-deduct.svg" alt="img" />
                                </span>
                                <h3>Tax Deductions</h3>
                                <p>Understand which expenses are deductible and how to maximize deductions to reduce your tax bill.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">03</div>

                                <span className="tax-problem-icon">
                                    <img src="/images/vat.svg" alt="img" />
                                </span>
                                <h3>VAT & More</h3>
                                <p>Get clarity on VAT, pension planning, property income, and general tax strategy questions.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">04</div>

                                <span className="tax-problem-icon">
                                    <img src="/images/property.svg" alt="img" />
                                </span>
                                <h3>Property Income</h3>
                                <p>Understand tax obligations on rental income, allowable expenses, and property investment strategies.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">05</div>

                                <span className="tax-problem-icon">
                                    <img src="/images/retirement-plan.svg" alt="img" />
                                </span>
                                <h3>Pension Planning</h3>
                                <p>Maximize your pension contributions and understand tax relief benefits for long-term savings.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">06</div>

                                <span className="tax-problem-icon">
                                    <img src="/images/gain.svg" alt="img" />
                                </span>
                                <h3>Capital Gains</h3>
                                <p>Navigate investment gains, CGT allowances, and understand your tax liability on asset sales.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">07</div>

                                <span className="tax-problem-icon">
                                    <img src="/images/dividends.svg" alt="img" />
                                </span>
                                <h3>Dividend Income</h3>
                                <p>Manage dividend tax, understand allowances, and optimize your investment income strategy.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">08</div>

                                <span className="tax-problem-icon">
                                    <img src="/images/insurance.svg" alt="img" />
                                </span>
                                <h3>National Insurance</h3>
                                <p>Understand NI contributions, thresholds, and how to minimize your National Insurance bill.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <div className="fbox-number">09</div>

                                <span className="tax-problem-icon">
                                    <img src="/images/inheritance.svg" alt="img" />
                                </span>
                                <h3>Inheritance Tax</h3>
                                <p>Learn about IHT planning, thresholds, and strategies to protect your family's assets.</p>
                            </div>
                        </Col>

                    </Row>

                </Container>
            </section>

            <section className="ready-call-outer">
                <Container>
                    <div className="ready-call">
                        <Row>
                            <Col xl={7} lg={6} >
                                <div className="ready-call-text p-5">
                                    <h2>Book Your <span>Consultation</span></h2>
                                    <p className="text-white">Get straight answers to your tax questions from real accountants who understand your situation.</p>
                                    <ul className="easy-list">
                                        <li><MdOutlineCheckCircle />No jargon, just simple answers</li>
                                        <li><MdOutlineCheckCircle />Understand what you actually owe</li>
                                        <li><MdOutlineCheckCircle />Find out how to pay less tax legally</li>
                                        <li><MdOutlineCheckCircle />Leave knowing exactly what to do next</li>
                                    </ul>
                                    <Link href="/register" className="common-btn">
                                        Book Your Session Now <MdKeyboardDoubleArrowRight className="ms-1" />
                                    </Link>
                                </div>
                            </Col>
                            <Col xl={5} lg={6}>
                                <div className="ready-call-img text-center">
                                    <img src="/images/consult.png" alt="ready-call" className="img-fluid" />
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section>

            <section className="start-simbox-sec start-advice ptb-80">
                <Container>
                    <div className="common-title text-left mb-5">
                        <h2>How It <span>Works</span></h2>
                        <p>Three simple steps to get the advice you need.</p>
                    </div>
                    <Row>
                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="start-simbox-card">
                                <div className="start-simbax-img">
                                    <img src="/images/share.png" alt="img" />
                                </div>
                                <div className="start-simbax-dis">
                                    <span className="start-count">
                                        1
                                    </span>
                                    <h4>Share Your Question</h4>
                                    <p>Tell us about your tax situation and what you need help with.</p>

                                </div>

                            </div>
                        </Col>


                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="start-simbox-card">
                                <div className="start-simbax-img">
                                    <img src="/images/chat.png" alt="img" />
                                </div>
                                <div className="start-simbax-dis">
                                    <span className="start-count">
                                        2
                                    </span>
                                    <h4>Chat With An Accountant</h4>
                                    <p>Book a 30-minute call at a time that suits you and get expert advice.</p>

                                </div>

                            </div>
                        </Col>


                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="start-simbox-card">
                                <div className="start-simbax-img">
                                    <img src="/images/summary.png" alt="img" />
                                </div>
                                <div className="start-simbax-dis">
                                    <span className="start-count">
                                        3
                                    </span>
                                    <h4>Get Your Summary</h4>
                                    <p>Receive a written summary and clear action steps to follow.</p>

                                </div>

                            </div>
                        </Col>

                    </Row>



                </Container>
            </section>

            <section className="stop-stressing-sec ptb-80 pt-0">
                <Container>
                    <div className="stop-stressing-content text-center">
                        <h2>Stop Stressing <span>About Tax</span></h2>
                        <p>Join 1,000+ UK businesses using TaxSimba to manage their tax the simple way.</p>
                        <Link href="/register" className="common-btn">
                            Start Your Free Trial Today <MdKeyboardDoubleArrowRight className="ms-1" />
                        </Link>
                        <p className="no-card mt-4">No card required • Cancel anytime • Stay compliant with confidence</p>
                    </div>
                </Container>
            </section>

            {/* FAQ Section Start */}
            <section className="faq-section ptb-80 pt-0">
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
                                            TaxSimba is an advanced UK tax management platform specifically engineered to simplify the transition into the Making Tax Digital (MTD) era for self-employed individuals and landlords. By replacing the intimidating and complex traditional government tax forms with a streamlined, question-based interface, the software allows users to navigate their financial obligations in a fraction of the usual time. The platform's core strength lies in its intelligent automation, which handles all necessary tax calculations behind the scenes to significantly reduce the risk of human error during Self Assessment.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                    <Accordion.Item eventKey="1">
                                        <Accordion.Header>Can I try TaxSimba before paying?</Accordion.Header>
                                        <Accordion.Body>
                                            Yes, you can try TaxSimba before committing to a purchase. The platform is designed with a "try-before-you-buy" philosophy that allows you to explore the interface and use the essential diagnostic tools entirely for free. Specifically, the MTD Eligibility Checker is accessible without any payment, enabling you to determine your tax obligations in under a minute at no cost. You are generally able to set up your profile, navigate the dashboard, and begin answering the simplified tax questions to see exactly how much time the automation saves you
                                        </Accordion.Body>
                                    </Accordion.Item>
                                    <Accordion.Item eventKey="2">
                                        <Accordion.Header>Is my data safe?</Accordion.Header>
                                        <Accordion.Body>
                                            Security is a fundamental pillar of the TaxSimba platform, which utilizes industry-standard encryption and security protocols to ensure your financial information remains completely protected. All data transmitted between your device and the servers is secured using 256-bit SSL encryption, the same level of security employed by major banks and financial institutions. Furthermore, as an HMRC-recognized software provider, the platform must adhere to rigorous data handling standards and privacy regulations, including GDPR, to maintain its integration credentials.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                    <Accordion.Item eventKey="3">
                                        <Accordion.Header>Can I cancel anytime?</Accordion.Header>
                                        <Accordion.Body>
                                            TaxSimba offers a flexible and transparent cancellation policy that puts you in full control of your account without any long-term contractual obligations. Since the platform operates on a commitment-free basis, you are welcome to stop using the service at any time by simply navigating to your account settings or managing your subscription status. If you are using the pay-per-submission model, there is no ongoing commitment to cancel, as you only pay for the specific filings you complete.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                    <Accordion.Item eventKey="4">
                                        <Accordion.Header>Does TaxSimba work on mobile?</Accordion.Header>
                                        <Accordion.Body>
                                            TaxSimba is fully optimized for mobile use, ensuring that you can manage your tax obligations and check your eligibility from any smartphone or tablet without needing to download a dedicated app. The platform utilizes a responsive web design that automatically adjusts the layout and interface to fit your screen size, maintaining the same high-end cinematic aesthetic and functionality found on the desktop version. This mobile-first approach allows you to answer tax questions, upload documents, and monitor your submission status on the go, providing the flexibility to handle your Self Assessment or Making Tax Digital requirements whenever it is most convenient for you.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                </Accordion>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
        </>
    )
}

export default page