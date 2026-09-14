"use client";

import React from 'react';
import Link from "next/link";
import { Col, Container, Form, Row } from 'react-bootstrap';
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaTwitter } from 'react-icons/fa';

function page() {

    return (
        <>

            <section className="blog-details ptb-80">
                <Container>
                    <Row>
                        <Col lg={8} className='mb-lg-0 mb-4'>
                            <div className="blog-details-img">
                                <img src="/images/blog_1.png" alt="blog" className="img-fluid" />
                            </div>
                            <div className="blog-details-content">
                                <h2>A Simple Guide to UK Self Assessment</h2>
                                <p>Self Assessment is the system HM Revenue and Customs (HMRC) uses to collect Income Tax. If you're self-employed or have other sources of income, you need to report it yourself each year.</p>

                                <h4 className='mt-4 mb-2 fw-bold'>Do you need to file a tax return?</h4>
                                <p className="mb-2">Determining whether you need to file a Self Assessment tax return depends on several factors related to your income and professional status. Generally, you are required to send a return if you earned more than £1,000 from self-employment within the tax year or received income from renting out a property. Additionally, if you earned money from tips, commissions, or various investments, or if you are a partner in a business partnership, you likely fall under the filing requirement. Other scenarios include having a taxable income over £100,000, needing to pay the High Income Child Benefit Charge, or having income from abroad that hasn't been taxed. Ensuring you understand these criteria is crucial to remaining compliant with HMRC regulations and avoiding unexpected penalties.</p>
                                <h4 className='mt-4 mb-2 fw-bold'>Lower Your Bill: What are Allowable Expenses?</h4>
                                <p className="mb-0">One of the biggest mistakes taxpayers make is not claiming their legal expenses. HMRC allows you to deduct costs that are "wholly and exclusively" for business purposes.</p>
                                <div className="expense-highlight-box p-4 my-4">
                                    <Row>
                                        <Col md={6}>
                                            <ul className="custom-list">
                                                <li><strong>Office costs:</strong> Stationery or phone bills.</li>
                                                <li><strong>Travel:</strong> Fuel, parking, or train fares.</li>
                                                <li><strong>Stock:</strong> Raw materials or goods for resale.</li>
                                            </ul>
                                        </Col>
                                        <Col md={6}>
                                            <ul className="custom-list">
                                                <li><strong>Financial:</strong> Insurance or bank charges.</li>
                                                <li><strong>Marketing:</strong> Website costs or advertising.</li>
                                                <li><strong>Clothing:</strong> Uniforms or protective gear.</li>
                                            </ul>
                                        </Col>
                                    </Row>
                                </div>

                                <h4 className='mt-4 mb-2 fw-bold'>Important Dates to Remember</h4>
                                <p className="mb-1">Staying on top of the UK tax calendar is essential to avoid unnecessary stress and financial penalties. Key dates include 5 October, which is the deadline to register for Self Assessment if you haven't done so before, and 31 October for those still submitting paper tax returns. However, for the majority of taxpayers, the most critical date is 31 January—the final deadline to file your return online and pay any tax owed for the previous tax year. It’s also worth noting the 6 April start of the new tax year, which is the perfect time to begin organizing your records for the year ahead. Missing these milestones can result in automatic fines starting at £100, so marking your calendar early is highly recommended.</p>

                                <h4 className='mt-4 mb-2 fw-bold'>How Tax Simba Makes it Easy</h4>
                                <p className="mb-0">Tax Simba transforms the often-dreaded tax season into a straightforward and stress-free process. We replace the confusing jargon and complicated forms associated with HMRC submissions with simple, easy-to-understand questions. Our platform automatically calculates exactly what you owe, eliminating the need for manual calculations and reducing the risk of errors. Furthermore, Tax Simba actively helps you identify all the legal deductions you're entitled to, ensuring you keep as much of your hard-earned money as possible. Once your information is complete, the system submits your return directly to HMRC with just one click, saving you valuable time and ensuring accuracy.</p>

                                <div className="tax-notice-box my-4 p-4">
                                    <h5 className="fw-bold text-danger">Don't Get Penalized!</h5>
                                    <p className="mb-0">Even if you have no tax to pay, missing the 31 January deadline results in an <strong>immediate £100 fine</strong>. If you are 3 months late, HMRC adds £10 for every additional day. Using Tax Simba ensures you stay ahead of the clock.</p>
                                </div>




                                <Row className="align-items-start">
                                    {/* Left Text Column */}
                                    <Col lg={12} className="mtd-text-column">
                                        <h1 className="mtd-main-title">
                                            Tax Simba makes UK Self Assessment simple, accurate, and stress-free.
                                        </h1>
                                        <p className="mtd-subtext">
                                            Avoid the complexity of HMRC's forms and the risk of late penalties. Our platform
                                            is designed to guide you through every step of the process, ensuring you claim
                                            every legal deduction while meeting critical deadlines with ease.
                                        </p>
                                    </Col>

                                    {/* Right Grid Column */}
                                    <Col lg={12}>
                                        <Row className="g-4 mb-4 mt-1">
                                            {/* Box 1 */}
                                            <Col lg={6}>
                                                <div className="mtd-stat-box mtd-bg-orange">
                                                    <div className="mtd-stat-number">£100</div>
                                                    <p className="mtd-stat-desc">
                                                        Immediate penalty for missing the 31 January deadline, even with no tax to pay.
                                                    </p>
                                                </div>
                                            </Col>

                                            {/* Box 2 */}
                                            <Col lg={6}>
                                                <div className="mtd-stat-box mtd-bg-beige">
                                                    <div className="mtd-stat-number">£1,000</div>
                                                    <p className="mtd-stat-desc">
                                                        The annual earnings threshold above which self-employment income must be reported.
                                                    </p>
                                                </div>
                                            </Col>

                                            {/* Box 3 */}
                                            <Col lg={6}>
                                                <div className="mtd-stat-box mtd-bg-purple">
                                                    <div className="mtd-stat-number">100%</div>
                                                    <p className="mtd-stat-desc">
                                                        Compliance assurance with automated calculations that eliminate manual error risks.
                                                    </p>
                                                </div>
                                            </Col>

                                            {/* Box 4 */}
                                            <Col lg={6}>
                                                <div className="mtd-stat-box mtd-bg-blue">
                                                    <div className="mtd-stat-number">1-Click</div>
                                                    <p className="mtd-stat-desc">
                                                        Fast, direct submission to HMRC, saving you hours of administrative work.
                                                    </p>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Col>
                                </Row>






                                <p className="mb-0">Tax doesn't have to be taxing. With TaxSimba, you can file with confidence in minutes.</p>
                            </div>

                            <div className="comment-area">
                                <div className="leave-comment">
                                    <h3>Leave a Comment</h3>
                                    <Form className="common-form">
                                        <Row>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Control type="text" placeholder="Full Name" />
                                                </Form.Group>
                                            </Col>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Control type="email" placeholder="Email Address" />
                                                </Form.Group>
                                            </Col>
                                            <Col md={12}>
                                                <Form.Group className="mb-3">
                                                    <Form.Control as="textarea" rows={5} placeholder="Write your comment here..." />
                                                </Form.Group>
                                            </Col>
                                            <Col md={12}>
                                                <div className="text-end">
                                                    <button type="submit" className="common-btn mt-2">Post Comment</button>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Form>
                                </div>
                            </div>
                        </Col>

                        <Col lg={4}>
                            <div className="blog-sidebar">
                                <div className="sidebar-widget">
                                    <h4 className="widget-title">Categories</h4>
                                    <ul className="category-list">
                                        <li><Link href="/blog-details">Digital Tax <span>(5)</span></Link></li>
                                        <li><Link href="/blog-details">Compliance <span>(3)</span></Link></li>
                                        <li><Link href="/blog-details">Bookkeeping <span>(8)</span></Link></li>
                                        <li><Link href="/blog-details">Small Business <span>(4)</span></Link></li>
                                        <li><Link href="/blog-details">Tax Planning <span>(2)</span></Link></li>
                                        <li><Link href="/blog-details">HMRC Updates <span>(6)</span></Link></li>
                                        <li><Link href="/blog-details">Financial Advice <span>(3)</span></Link></li>
                                        <li><Link href="/blog-details">Technology <span>(7)</span></Link></li>
                                    </ul>
                                </div>

                                <div className="sidebar-widget">
                                    <h4 className="widget-title">Tags</h4>
                                    <div className="tag-list d-flex flex-wrap gap-2">
                                        <Link href="/blog-details" className="common-bd-btn py-1 px-3 fs-14">HMRC</Link>
                                        <Link href="/blog-details" className="common-bd-btn py-1 px-3 fs-14">VAT</Link>
                                        <Link href="/blog-details" className="common-bd-btn py-1 px-3 fs-14">Income Tax</Link>
                                        <Link href="/blog-details" className="common-bd-btn py-1 px-3 fs-14">MTD</Link>
                                        <Link href="/blog-details" className="common-bd-btn py-1 px-3 fs-14">Software</Link>
                                        <Link href="/blog-details" className="common-bd-btn py-1 px-3 fs-14">Digital</Link>
                                        <Link href="/blog-details" className="common-bd-btn py-1 px-3 fs-14">Finance</Link>
                                    </div>
                                </div>

                                <div className="sidebar-widget">
                                    <h4 className="widget-title">Follow Social</h4>
                                    <div className="social-links">
                                        <Link href="/"><FaFacebookF /></Link>
                                        <Link href="/"><FaTwitter /></Link>
                                        <Link href="/"><FaInstagram /></Link>
                                        <Link href="/"><FaLinkedinIn /></Link>
                                    </div>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="other-blogs-sec ptb-80">
                <Container>
                    <div className="common-title text-start mb-4">
                        <h2 className="text-capitalize">other <span> blogs</span></h2>
                    </div>
                    <Row>
                        <Row>
                            <Col lg={4} className="mb-4">
                                <div className="blog-card">
                                    <Link href="/blog-details">
                                        <div className="blog-img">
                                            <img src="/images/blog_1.png" alt="img" />
                                        </div>
                                        <div className="blog-card-content mt-3">
                                            <h4>Simple guide to understanding Self Assessment in the UK.</h4>
                                            <p>7 min read</p>
                                        </div>
                                    </Link>
                                </div>
                            </Col>
                            <Col lg={4} className="mb-4">
                                <div className="blog-card">
                                    <Link href="/blog-details">
                                        <div className="blog-img">
                                            <img src="/images/blog_2.png" alt="img" />
                                        </div>
                                        <div className="blog-card-content mt-3">
                                            <h4>Find out if Self Assessment applies to you.</h4>
                                            <p>7 min read</p>

                                        </div>
                                    </Link>
                                </div>
                            </Col>
                            <Col lg={4} className="mb-4">
                                <div className="blog-card">
                                    <Link href="/blog-details">
                                        <div className="blog-img">
                                            <img src="/images/blog_3.png" alt="img" />
                                        </div>
                                        <div className="blog-card-content mt-3">
                                            <h4>Simple steps to get ready for your tax return.</h4>
                                            <p>7 min read</p>
                                        </div>
                                    </Link>
                                </div>
                            </Col>
                        </Row>
                    </Row>
                </Container>
            </section>

        </>
    )
}

export default page