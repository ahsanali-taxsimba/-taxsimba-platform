"use client";
import React from 'react';
import Link from 'next/link';
import { Accordion, Col, Row } from 'react-bootstrap';
import Container from 'react-bootstrap/Container';
import { MdOutlineCheckCircle, MdOutlineKeyboardDoubleArrowRight } from 'react-icons/md';

const TaxForFreelancersClient = () => {
    return (
        <>

            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h2 className="text-capitalize mb-3">Self Assessment Tax Returns</h2>
                                <p className="mb-0">Accountant-led Self Assessment — you provide the information, your accountant prepares the return, and you review before filing where that step applies.</p>
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

            <section className='feature-bussiness-sec pd-100 bg-grey'>
                <Container>
                    <div className="feature-bussiness-inner">
                        <Row className="align-items-center mb-5">
                            <Col lg={7}>
                                <div className='feature-bussiness-left common-title pe-5'>
                                    <div className="feature-text-box connect-box-card">
                                        <h2><span>Self Assessment</span> made simple with <span>Taxsimba</span></h2>
                                        <p className='mb-0'>TaxSimba is an accountant-led Self Assessment service. You share your income, expenses and supporting documents through a guided workflow. A TaxSimba accountant prepares and reviews your return. You review and approve before filing where that step applies. We do not position TaxSimba as DIY tax software or as automatic filing without accountant involvement.
                                        </p>
                                    </div>
                                </div>
                            </Col>
                            <Col lg={5}>
                                <div className="feature-bussiness-right">
                                    <img src="/images/auth.jpg" alt="" className='img-fluid' />
                                </div>
                            </Col>
                        </Row>

                        <Row>
                            <Col lg={3} className="mb-lg-0 mb-4">
                                <div className='feature-bussiness-bottom-box h-100'>
                                    <div className="feature-bottom-text">
                                        <h4>Working Figures</h4>
                                        <p>Work through income and expenses with your accountant so you understand the figures before you approve the return.</p>
                                    </div>
                                </div>
                            </Col>
                            <Col lg={3} className="mb-lg-0 mb-4">
                                <div className='feature-bussiness-bottom-box h-100'>
                                    <div className="feature-bottom-text">
                                        <h4>Allowable Expenses Support</h4>
                                        <p>Share expense records so your accountant can consider allowable costs when preparing your return. Outcomes depend on your facts and HMRC rules.</p>
                                    </div>
                                </div>
                            </Col>
                            <Col lg={3} className="mb-lg-0 mb-4">
                                <div className='feature-bussiness-bottom-box h-100'>
                                    <div className="feature-bottom-text">
                                        <h4>Accountant-Led Filing</h4>
                                        <p>After you approve the prepared return where required, filing is handled as part of TaxSimba’s accountant-led service.</p>
                                    </div>
                                </div>
                            </Col>
                            <Col lg={3} className="mb-lg-0 mb-4">
                                <div className='feature-bussiness-bottom-box h-100'>
                                    <div className="feature-bottom-text">
                                        <h4>Human Accountant Review</h4>
                                        <p>A TaxSimba accountant reviews your return before you approve. You remain responsible for the accuracy of information you provide.</p>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>

                </Container>
            </section>


            <section className="tax-problems-sec pd-100">
                <Container>
                    <div className="common-title text-center mb-5">
                        <h2>Features That Make <span>Self Assessment Easy</span></h2>
                        <p>Everything you need to complete and file your self assessment tax return accurately and on time.</p>
                    </div>
                    <Row>
                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Accountant-Prepared Figures</h3>
                                <p>Your accountant prepares the figures for your return using the information and documents you provide.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Accountant-Led Filing</h3>
                                <p>After you review and approve where required, filing is handled as part of TaxSimba’s accountant-led service.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Organised Expense Records</h3>
                                <p>Upload and organise expense evidence so your accountant can consider allowable costs when preparing your return.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Accountant Review</h3>
                                <p>Your accountant reviews the prepared return and may ask follow-up questions before you approve.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Deadline Reminders</h3>
                                <p>Keep the 31 January online filing deadline in mind. Your TaxSimba workflow helps you progress in good time — we do not guarantee penalty outcomes.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Clear Return Summary</h3>
                                <p>Review the prepared figures and supporting summary with your accountant before you approve filing.</p>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="who-needs-sec mx-3 pd-100">
                <Container>
                    <div className="common-title text-center mb-5">
                        <h2>Who Needs to File a <span>Self Assessment?</span></h2>
                        <p>You must send a tax return if, in the last tax year (6 April to 5 April), any of the following applied:</p>
                    </div>
                    <Row className="justify-content-center">
                        <Col lg={3} md={6} sm={12} xs={12} className="mb-4">
                            <div className="need-to-box h-100 text-center">
                                <div className="need-to-icon mb-3">
                                    <img src="/images/tax.png" alt="img" />
                                </div>
                                <h3 className='mb-2'>Self-Employed</h3>
                                <p>You worked for yourself as a sole trader and earned more than £1,000 before taking off allowable expenses.</p>
                            </div>
                        </Col>
                        <Col lg={3} md={6} sm={12} xs={12} className="mb-4">
                            <div className="need-to-box h-100 text-center">
                                <div className="need-to-icon mb-3">
                                    <img src="/images/tax.png" alt="img" />
                                </div>
                                <h3 className='mb-2'>Partnerships</h3>
                                <p>You were a partner in a business partnership, regardless of the income amount earned.</p>
                            </div>
                        </Col>
                        <Col lg={3} md={6} sm={12} xs={12} className="mb-4">
                            <div className="need-to-box h-100 text-center">
                                <div className="need-to-icon mb-3">
                                    <img src="/images/tax.png" alt="img" />
                                </div>
                                <h3 className='mb-2'>High Earners</h3>
                                <p>Your total taxable income was more than £100,000, or you claimed Child Benefit and income was over £50,000.</p>
                            </div>
                        </Col>
                        <Col lg={3} md={6} sm={12} xs={12} className="mb-4">
                            <div className="need-to-box h-100 text-center">
                                <div className="need-to-icon mb-3">
                                    <img src="/images/tax.png" alt="img" />
                                </div>
                                <h3 className='mb-2'>Untaxed Income</h3>
                                <p>You received untaxed income from properties, tips, foreign investments, savings, or dividends.</p>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>



            <section className="easy-sec pd-100">
                <Container>
                    <div className="easy-content-main">
                        <Row>
                            <Col lg={6} md={7} sm={12} xs={12}>
                                <div className="easy-content-inner">
                                    <h2>Easy and stress-free <br /><span>tax adviser.</span></h2>

                                    <ul className="easy-list">
                                        <li><MdOutlineCheckCircle />Simple Tax Solutions</li>
                                        <li><MdOutlineCheckCircle />Smart Financial Guidance</li>
                                        <li><MdOutlineCheckCircle />Stress-Free Tax Filing</li>
                                        <li><MdOutlineCheckCircle />Stay Fully Compliant</li>
                                    </ul>


                                    <button className="common-btn mt-4">
                                        Speak to Our Adviser

                                    </button>

                                </div>
                            </Col>
                            <Col lg={6} md={5} sm={12} xs={12}>
                                <div className="easy-img">
                                    <img src="/images/easy-rt.png" alt="img" />
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section>


            <section className="faq-sec-main faq-home mx-3 pd-100">
                <Container>
                    <Row>
                        <Col lg={4} md={12} sm={12} xs={12}>
                            <div className="common-title mb-0">
                                <h2><span>Self Assessment</span> FAQs</h2>
                            </div>
                        </Col>

                        <Col lg={8} md={12} sm={12} xs={12}>
                            <div className="faq-outer">
                                <Accordion defaultActiveKey="0">
                                    <Accordion.Item eventKey="0">
                                        <Accordion.Header>When is the Self Assessment deadline?</Accordion.Header>
                                        <Accordion.Body>
                                            The online Self Assessment deadline is usually midnight on 31 January following the end of the tax year (the tax year ends on 5 April). Always check current GOV.UK dates for your situation.
                                        </Accordion.Body>
                                    </Accordion.Item>

                                    <Accordion.Item eventKey="1">
                                        <Accordion.Header>How does TaxSimba file my Self Assessment return?</Accordion.Header>
                                        <Accordion.Body>
                                            You provide your information and documents. A TaxSimba accountant prepares and reviews your return. You review and approve where that step applies, then filing is handled as part of the accountant-led service — not as DIY one-click software submission by you alone.
                                        </Accordion.Body>
                                    </Accordion.Item>

                                    <Accordion.Item eventKey="2">
                                        <Accordion.Header>Do I need to be an accountant to use TaxSimba?</Accordion.Header>
                                        <Accordion.Body>
                                            No. TaxSimba is built for people who want accountant help. You answer questions and upload documents; your accountant prepares the return. You remain responsible for the accuracy of information you provide.
                                        </Accordion.Body>
                                    </Accordion.Item>

                                    <Accordion.Item eventKey="3">
                                        <Accordion.Header>What if something looks wrong on my return?</Accordion.Header>
                                        <Accordion.Body>
                                            Raise it with your accountant before you approve. After filing, HMRC usually allows amendments within published time limits — your accountant can advise on the next step for your case.
                                        </Accordion.Body>
                                    </Accordion.Item>

                                    <Accordion.Item eventKey="4">
                                        <Accordion.Header>Can I claim expenses with TaxSimba?</Accordion.Header>
                                        <Accordion.Body>
                                            Yes. Share your expense information and supporting records with your accountant so allowable expenses can be considered when your return is prepared. We do not promise a particular tax outcome.
                                        </Accordion.Body>
                                    </Accordion.Item>
                                </Accordion>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="stop-stressing-sec pd-100">
                <Container>
                    <div className="stop-stressing-content text-center">
                        <h2>Start accountant-led <span>Self Assessment</span></h2>
                        <p>Provide your information, your accountant prepares, you review and approve before filing where that step applies.</p>
                        <Link href="/register" className="common-btn">
                            Start Self Assessment <MdOutlineKeyboardDoubleArrowRight className='ms-1' />
                        </Link>

                    </div>
                </Container>
            </section>
        </>
    );
};

export default TaxForFreelancersClient;
