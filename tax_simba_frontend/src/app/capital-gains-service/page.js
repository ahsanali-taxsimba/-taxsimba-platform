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
                                <h2 className="text-capitalize mb-3">Capital Gains Tax (CGT) Services</h2>
                                <p className="mb-0">Navigate the complexities of Capital Gains Tax (CGT) with complete
                                    confidence. Whether you’re disposing of residential property, stocks, or
                                    business assets, our expert CGT services provide accurate calculations of your
                                    liabilities while identifying every available relief and exemption. We offer
                                    strategic tax planning to help you understand your obligations in advance,
                                    ensuring full compliance with current HMRC regulations and streamlining the
                                    submission process for a stress-free experience.</p>
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
                                            <h2>Capital Gains Tax (CGT) <span>Services</span></h2>
                                            <p className='mb-0'>Navigate the complexities of Capital Gains Tax (CGT) with complete
                                                confidence. Whether you’re disposing of residential property, stocks, or
                                                business assets, our expert CGT services provide accurate calculations of your
                                                liabilities while identifying every available relief and exemption. We offer
                                                strategic tax planning to help you understand your obligations in advance,
                                                ensuring full compliance with current HMRC regulations and streamlining the
                                                submission process for a stress-free experience.</p>
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
                                            <h4>Assessment</h4>
                                            <p>Our experts provide professional assessments of your capital assets, determining acquisition costs and market valuations to establish your potential tax base accurately and fairly.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3} className="mb-lg-0 mb-4">
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>Tax Planning</h4>
                                            <p>Our experts help you plan strategically to minimise your Capital Gains Tax liability. We analyse your assets, identify reliefs and exemptions, and develop personalised strategies to optimise your tax position while ensuring full compliance with HMRC regulations.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3} className="mb-lg-0 mb-4">
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>Tax Returns</h4>
                                            <p>We prepare and submit accurate Self-Assessment tax returns for individuals, sole traders, and partnerships. Our experts ensure all income and capital gains are reported correctly, maximising reliefs and minimising your tax liability while ensuring full compliance with HMRC regulations.</p>
                                        </div>
                                    </div>
                                </Col>
                                <Col lg={3}>
                                    <div className='feature-bussiness-bottom-box h-100'>
                                        <div className="feature-bottom-text">
                                            <h4>Tax Reliefs</h4>
                                            <p>Our experts help you plan strategically to minimise your Capital Gains Tax liability. We analyse your assets, identify reliefs and exemptions, and develop personalised strategies to optimise your tax position while ensuring full compliance with HMRC regulations.</p>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </div>
                    </div>
                </Container>
            </section>

            <section className="ptb-80 bg-light">
                <Container>
                    <div className="common-title text-center mb-5">
                        <h2 className="mb-2">Your Partner in <span>CGT Compliance</span></h2>
                        <p style={{ maxWidth: '700px', margin: '0 auto' }}>From residential property to cryptocurrency holdings, we provide the expertise needed to navigate the complexities of Capital Gains Tax reporting.</p>
                    </div>
                    <Row>
                        <Col lg={4} md={6} className="mb-lg-0 mb-4">
                            <div className="bg-white p-4 border-radius-20 h-100 shadow-sm border-0 text-center">
                                <div className="text-theme mb-3"><MdOutlineCheckCircle size={32} /></div>
                                <h4 className="fw-bold mb-3">Property Disposals</h4>
                                <p className="mb-0">Expert handling of the 60-day reporting rule for UK residential property, ensuring you never face HMRC penalties.</p>
                            </div>
                        </Col>
                        <Col lg={4} md={6} className="mb-lg-0 mb-4">
                            <div className="bg-white p-4 border-radius-20 h-100 shadow-sm border-0 text-center">
                                <div className="text-theme mb-3"><MdOutlineCheckCircle size={32} /></div>
                                <h4 className="fw-bold mb-3">Investment Assets</h4>
                                <p className="mb-0">Comprehensive calculations for stocks, shares, and modern assets like NFTs and Cryptocurrency under HMRC guidelines.</p>
                            </div>
                        </Col>
                        <Col lg={4} md={12}>
                            <div className="bg-white p-4 border-radius-20 h-100 shadow-sm border-0 text-center">
                                <div className="text-theme mb-3"><MdOutlineCheckCircle size={32} /></div>
                                <h4 className="fw-bold mb-3">Strategic Reliefs</h4>
                                <p className="mb-0">Identifying every applicable relief, including Business Asset Disposal Relief, to legitimately reduce your tax liability.</p>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="easy-sec easy-sec-home capital-cta ptb-80">
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