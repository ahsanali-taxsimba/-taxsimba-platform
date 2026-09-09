"use client";
import Link from 'next/link';
import React from 'react';
import { Accordion, Col, Container, Row } from 'react-bootstrap';
import { MdKeyboardDoubleArrowRight, MdOutlineCheckCircle } from 'react-icons/md';

function Page() {
    return (
        <>
            {/*Banner Start*/}
            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={7}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h2 className="text-capitalize mb-3">Self-Employed Tax Returns</h2>
                                <p className="mb-0">Simplify your self-employed tax filing with our expert solutions. We handle the complexities of personal tax returns so you can focus on growing your business.</p>
                            </div>
                        </Col>
                        <Col lg={5} className="mt-lg-0 mt-5">
                            <div className="breadcrum-img text-center">
                                <img src="/images/breadcrum-img.png" alt="Breadcrumb Image" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
            {/*Banner End*/}

            <section className='feature-bussiness-sec ptb-80'>
                <Container>
                    <div className="feature-bussiness">
                        <div className="feature-bussiness-inner">

                            <Row className="align-items-center">
                                <Col lg={7} className=" mb-4">
                                    <div className='feature-bussiness-left common-title pe-lg-5 pe-0'>
                                        <div className="feature-text-box connect-box-card">
                                            <h2>Self-Employed <span>Tax Returns</span></h2>
                                            <p className='mb-0'>Simplify your self-employed tax filing with our expert solutions. We handle the complexities of personal tax returns so you can focus on growing your business. From income tracking and expense categorization to final HMRC submissions, our automated platform ensures your filings are accurate, on time, and fully compliant. Maximize your tax efficiency and eliminate the stress of manual returns with our intelligent self-assessment support.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={5} className="mb-4">
                                    <div className="feature-bussiness-right">
                                        <img src="/images/auth.jpg" alt="" className='img-fluid' />
                                    </div>
                                </Col>
                            </Row>

                            <Row>
                                <Col lg={3} className="mb-lg-0 mb-4">
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>Self-Employed Tax Return Preparation & Submission</h4>
                                            <p>We handle the complete self-employed tax return process—from gathering your income and expense details to filing your return with HMRC. Our experts ensure accuracy and compliance, saving you time and stress.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3} className="mb-lg-0 mb-4">
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>Income & Expense Analysis</h4>
                                            <p>We help you identify and claim all eligible expenses, including travel, tools, and home office costs, ensuring you never miss a deduction.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3} className="mb-lg-0 mb-4">
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>VAT Return Assistance</h4>
                                            <p>We assist with VAT registration and ensure timely, accurate VAT return submissions to HMRC, helping you avoid penalties and manage cash flow effectively.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3}>
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>HMRC Support</h4>
                                            <p>Our team handles all communications with HMRC on your behalf, ensuring your queries are resolved quickly and accurately.</p>
                                        </div>
                                    </div>
                                </Col>
                            </Row>

                        </div>
                    </div>
                </Container>
            </section>

            <section className="easy-sec easy-sec-home ptb-80 pt-0">
                <Container>
                    <div className="easy-content-main">
                        <Row className="g-0">
                            <Col className="p-0" lg={6} md={12} sm={12} xs={12}>
                                <div className="easy-content-inner">
                                    <h2>Simple <span>tax advice</span> when you need it</h2>

                                    <ul className="easy-list">
                                        <li><MdOutlineCheckCircle />Understand your tax responsibilities</li>
                                        <li><MdOutlineCheckCircle />Avoid mistakes and confusion</li>
                                        <li><MdOutlineCheckCircle />Stay compliant with HMRC</li>
                                    </ul>


                                    <Link href="/tax-adviser" className="common-btn mt-4 d-inline-block">
                                        Speak to Our Adviser  <MdKeyboardDoubleArrowRight className="ms-1" />
                                    </Link>

                                </div>
                            </Col>
                            <Col className="p-0" lg={6} md={12} sm={12} xs={12}>
                                <div className="easy-img">
                                    <img src="/images/easy-rt.png" alt="img" />
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section>

            {/* CTA Section Start */}
            <section className="cta-full-main ptb-80 mx-3 rounded-4">
                <Container>
                    <div className="cta-inner">
                        <Row>
                            <Col lg={12}>
                                <div className="cta-cont text-center">
                                    <div className="stop-stressing-content text-center p-0">
                                        <div className="cta-logo">
                                            <img src="/images/cat-logo.png" alt="img" className="img-fluid" />
                                        </div>
                                        <h2 className="text-white mt-4">
                                            How to complete your tax return <span>faster</span>
                                        </h2>
                                        <p className="text-white mb-0">Answer a few questions and finish your return step by step.</p>
                                        <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-4">
                                            <Link href="/register" className="common-btn">
                                                Start Your Return <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section>
            {/* CTA Section End */}

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
            {/* FAQ Section End */}

        </>
    )
}

export default Page