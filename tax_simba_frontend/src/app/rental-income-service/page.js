"use client";
import AccountantLedPublicFaqs from "@/components/seo/AccountantLedPublicFaqs";
import Link from 'next/link';
import React from 'react';
import { Col, Container, Row } from 'react-bootstrap';
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
                                <h2 className="text-capitalize mb-3">Rental Income Tax Returns</h2>
                                <p className="mb-0">Simplify your rental income tax filing with our expert landlord solutions. We handle the complexities of property tax returns so you can focus on managing your portfolio.</p>
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
                                            <h2>Rental Income <span>Tax Returns</span></h2>
                                            <p className='mb-0'>Simplify your rental income tax filing with our expert landlord solutions. We handle the complexities of property tax returns so you can focus on managing your portfolio. From tracking rental income and qualifying expenses to final HMRC submissions, our automated platform ensures your landlord tax filings are accurate, on time, and fully compliant. Maximize your property tax efficiency and eliminate the stress of manual returns with our intelligent rental income support.</p>
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
                                            <h4>Rental Income Tax Return Preparation & Submission</h4>
                                            <p>We handle the complete rental income tax return process—from gathering your rental income and property expenses to filing your return with HMRC. Our experts ensure accuracy and compliance, saving you time and stress.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3} className="mb-lg-0 mb-4">
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>Rental Income & Expense Analysis</h4>
                                            <p>We help you identify and claim all eligible expenses, including property maintenance, mortgage interest, and insurance costs, ensuring you never miss a deduction.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3} className="mb-lg-0 mb-4">
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>Capital Gains Tax (CGT) Support</h4>
                                            <p>We provide expert guidance on Capital Gains Tax for property disposals, helping you calculate liabilities and ensure compliance with HMRC regulations.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3}>
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>HMRC Submission Support</h4>
                                            <p>We ensure your tax return is submitted to HMRC accurately and on time, handling all communication and queries on your behalf.</p>
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
            <AccountantLedPublicFaqs />
            {/* FAQ Section End */}
</>
    )
}

export default Page