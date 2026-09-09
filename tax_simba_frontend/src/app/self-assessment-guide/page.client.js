"use client";
import { Link } from 'lucide-react';
import { Accordion, Col, Row } from 'react-bootstrap';
import Container from 'react-bootstrap/Container';
import { MdKeyboardDoubleArrowRight, MdOutlineCheckCircle, MdOutlineKeyboardDoubleArrowRight } from 'react-icons/md';
const SelfAssessmentGuideClient = () => {
    return (
        <>

            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h2 className="text-capitalize mb-3">Self Assessment Tax Returns</h2>
                                <p className="mb-0">File your HMRC Self Assessment easily with Taxsimba's smart tax platform Stay compliant, minimize errors, and avoid overpaying tax.</p>
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
                                        <p className='mb-0'>Our platform is designed to take the stress out of filing your Self Assessment. Instead of navigating complicated HMRC forms, Taxsimba asks you simple questions and handles all the complex tax calculations behind the scenes. We automatically identify allowable expenses so you never pay more tax than you need to. With our direct HMRC connection, you can submit your return straight from our software with a single click. From sole traders and landlords to high earners, Taxsimba provides the guidance and confidence you need to file accurately, avoid penalties, and get back to what you do best.
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
                                        <h4>Smart Tax Estimator</h4>
                                        <p>See your estimated tax bill update in real-time as you enter your income and expenses. No more surprise tax bills in January.</p>
                                    </div>
                                </div>
                            </Col>
                            <Col lg={3} className="mb-lg-0 mb-4">
                                <div className='feature-bussiness-bottom-box h-100'>
                                    <div className="feature-bottom-text">
                                        <h4>Maximized Deductions</h4>
                                        <p>Ensure you claim every allowable expense you're entitled to with built-in guidance on what can and cannot be deducted.</p>
                                    </div>
                                </div>
                            </Col>
                            <Col lg={3} className="mb-lg-0 mb-4">
                                <div className='feature-bussiness-bottom-box h-100'>
                                    <div className="feature-bottom-text">
                                        <h4>Direct Submission</h4>
                                        <p>File your Self Assessment tax return straight to HMRC electronically from within Taxsimba without needing to visit the HMRC portal.</p>
                                    </div>
                                </div>
                            </Col>
                            <Col lg={3} className="mb-lg-0 mb-4">
                                <div className='feature-bussiness-bottom-box h-100'>
                                    <div className="feature-bottom-text">
                                        <h4>Expert Review Checks</h4>
                                        <p>Our system runs automated diagnostic checks on your return before submission to help prevent common mistakes and HMRC inquiries.</p>
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
                                <h3>Automated Tax Calculations</h3>
                                <p>Taxsimba automatically calculates your tax liability in real-time as you log your income and expenses.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Direct HMRC Submission</h3>
                                <p>Submit your Self Assessment directly to HMRC from our platform. We are formally recognised by HMRC.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Smart Expense Tracking</h3>
                                <p>Log all your business expenses digitally so you never miss a tax deduction and keep proof organized.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Error Checking</h3>
                                <p>Our system runs automatic checks to identify potential anomalies or missing data before you submit to HMRC.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Deadline Reminders</h3>
                                <p>Get automated email and dashboard reminders near the 31 January deadline so you never face late penalties.</p>
                            </div>
                        </Col>

                        <Col lg={4} md={6} sm={12} xs={12}>
                            <div className="tax-problems-box">
                                <span className="tax-problem-icon">
                                    <img src="/images/tax.png" alt="img" />
                                </span>
                                <h3>Comprehensive Reporting</h3>
                                <p>Generate detailed income, expense, and tax liability reports to understand your overall financial position.</p>
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
                                            The deadline for online tax returns is typically midnight on 31 January following the end of the tax year. The tax year ends on 5 April.
                                        </Accordion.Body>
                                    </Accordion.Item>

                                    <Accordion.Item eventKey="1">
                                        <Accordion.Header>Can Taxsimba submit my return to HMRC directly?</Accordion.Header>
                                        <Accordion.Body>
                                            Yes, Taxsimba is HMRC recognized and fully supports direct digital submission of your Self Assessment tax return.
                                        </Accordion.Body>
                                    </Accordion.Item>

                                    <Accordion.Item eventKey="2">
                                        <Accordion.Header>Do I need to be an accountant to use Taxsimba for Self Assessment?</Accordion.Header>
                                        <Accordion.Body>
                                            Not at all. Taxsimba is designed specifically for non-accountants. It asks you simple questions and automatically calculates your tax dynamically.
                                        </Accordion.Body>
                                    </Accordion.Item>

                                    <Accordion.Item eventKey="3">
                                        <Accordion.Header>What if I make a mistake on my return?</Accordion.Header>
                                        <Accordion.Body>
                                            Taxsimba has built-in error checking to catch common mistakes before you submit. If you've already submitted, you normally have up to 12 months from the 31 January deadline to amend your return.
                                        </Accordion.Body>
                                    </Accordion.Item>

                                    <Accordion.Item eventKey="4">
                                        <Accordion.Header>Can I claim expenses through Taxsimba?</Accordion.Header>
                                        <Accordion.Body>
                                            Yes, you can easily log and categorize allowable business expenses throughout the year to ensure your tax bill is accurate.
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
                        <h2>Start your <span>tax return</span> today</h2>
                        <p>Complete your Self Assessment the simple way.</p>
                        <button className="common-btn">
                            Start Your Free Trial Today <MdOutlineKeyboardDoubleArrowRight className='ms-1' />
                        </button>

                    </div>
                </Container>
            </section>

        </>
    );
};

export default SelfAssessmentGuideClient;
