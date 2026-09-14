"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { Accordion, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { MdDoubleArrow, MdKeyboardDoubleArrowRight, MdOutlineCheckCircle } from "react-icons/md";
import { FiMail, FiPhone, FiUser } from 'react-icons/fi';
import { FaCheckCircle } from 'react-icons/fa';
import { GoArrowUpRight } from 'react-icons/go';
import { IoLockClosedOutline } from "react-icons/io5";

function page() {
    const [step, setStep] = useState("assessment");
    const [faqs, setFaqs] = useState([]);
    const [loadingFaqs, setLoadingFaqs] = useState(true);

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                const response = await axios.get(`${apiUrl}faqs`);
                if (response.data?.data?.Faqs) {
                    setFaqs(response.data.data.Faqs);
                } else if (Array.isArray(response.data?.data)) {
                    setFaqs(response.data.data);
                } else if (Array.isArray(response.data)) {
                    setFaqs(response.data);
                }
            } catch (error) {
                console.error("Error fetching FAQs:", error);
            } finally {
                setLoadingFaqs(false);
            }
        };
        fetchFaqs();
    }, []);

    return (
        <>
            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h2 className="text-capitalize mb-3">Self Assessment Made Simple</h2>
                                <p>Expert guidance to help you file your taxes accurately and <span className="text-orange">stay compliant with ease.</span></p>
                            </div>
                        </Col>
                        <Col lg={6} className="mt-lg-0 mt-5">
                            <div className="breadcrum-img text-center">
                                <img src="/images/self-bread.png" alt="Breadcrumb Image" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Assessment Section Start  */}
            <section className="assessment-sec assessment-inr-sec ptb-80 mx-3">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={7} className="mb-lg-0 mb-4">
                            <div className="assessment-left-box pe-lg-5 pe-0">
                                <div className="main-title mb-4 p-0">
                                    <h2 className='text-start text-dark'>Most people finish <br className="d-none d-lg-block" /> in about <span className='text-green'> 10 minutes</span></h2>
                                    <p className="text-dark mt-4">TaxSimba asks simple questions and builds your tax return step by step. No tax knowledge required — we handle the complex calculations and ensure you're HMRC-compliant in record time.</p>
                                </div>
                                <ul className="assessment-list list-unstyled">
                                    <li><span className="me-2"><FaCheckCircle /></span>Answer simple questions</li>
                                    <li><span className="me-2"><FaCheckCircle /></span>See your tax summary instantly</li>
                                    <li><span className="me-2"><FaCheckCircle /></span>Submit directly to HMRC</li>
                                </ul>
                            </div>
                            {/* <div className="assessment-btn mt-5">
                                <Link href="/register" className="common-btn">
                                    Start Your Return <GoArrowUpRight />
                                </Link>
                            </div> */}
                        </Col>
                        <Col lg={5}>
                            <div className="form-wrapper">
                                <div className="custom-card-frame">

                                    {/* ================= STEP 1 ================= */}
                                    {step === "assessment" && (
                                        <div className="self-form text-center">
                                            <h2 className="form-header-title">
                                                Start Your <span className="text-highlight"><br /> Self Assessment</span>
                                            </h2>

                                            <p className="form-header-subtitle">
                                                Begin your secure, HMRC-compliant filing process in minutes.
                                            </p>

                                            <Form className="custom-form">

                                                <div className="input-icon-group">
                                                    <FiUser className="input-icon" />
                                                    <Form.Control type="text" placeholder="Your Full name" className="custom-input" />
                                                </div>

                                                <div className="input-icon-group">
                                                    <FiMail className="input-icon" />
                                                    <Form.Control type="email" placeholder="Your Email Address" className="custom-input" />
                                                </div>

                                                <div className="input-icon-group">
                                                    <FiPhone className="input-icon" />
                                                    <Form.Control type="tel" placeholder="Your Phone Number" className="custom-input" />
                                                </div>

                                                <div className="mt-3 assement-btn">
                                                    <button
                                                        type="button"
                                                        className="common-btn w-100"
                                                        onClick={() => setStep("register")}
                                                    >
                                                        Start Now – Takes 2 Minutes
                                                        <MdDoubleArrow className="btn-icon-right" />
                                                    </button>
                                                </div>

                                            </Form>
                                        </div>
                                    )}

                                    {/* ================= STEP 2 ================= */}
                                    {step === "register" && (
                                        <div className="register-form text-center">
                                            <h2 className="form-header-title mb-3">
                                                Register <span className="text-highlight"> Now</span>
                                            </h2>

                                            <Form className="custom-form">

                                                <div className="input-icon-group">
                                                    <IoLockClosedOutline className="input-icon" />
                                                    <Form.Control type="password" placeholder="Enter Your Password" className="custom-input" />
                                                </div>

                                                <div className="input-icon-group">
                                                    <IoLockClosedOutline className="input-icon" />
                                                    <Form.Control type="password" placeholder="Confirm Your Password" className="custom-input" />
                                                </div>

                                                <div className="mt-3 assement-btn">
                                                    <button
                                                        type="button"
                                                        className="common-btn w-100"
                                                        onClick={() => setStep("login")}
                                                    >
                                                        Register
                                                        <MdDoubleArrow className="btn-icon-right" />
                                                    </button>
                                                </div>

                                                <p className="register-form-footer-text text-capitalize text-green mt-3">
                                                    no spam, your details are secure
                                                </p>

                                            </Form>
                                        </div>
                                    )}

                                    {/* ================= STEP 3 ================= */}
                                    {step === "login" && (
                                        <div className="login-form text-center">
                                            <h2 className="form-header-title mb-3">
                                                Verification link <span className="text-green"> send to your email.</span>
                                            </h2>

                                            <div className="assement-btn">
                                                <Link href="/login" className="common-btn d-inline-block w-100">
                                                    Login
                                                    <MdDoubleArrow className="btn-icon-right" />
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section >
            {/* Assessment Section End  */}

            {/* Choose Section Start  */}
            <section className="choose-sec ptb-80 mx-3">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={7} className="mb-lg-0 mb-4">
                            <div className="choose-left-box pe-lg-5 pe-0">
                                <div className="main-title mb-0 p-0">
                                    <h2 className='text-start'><span>Why choose TaxSimba</span> <br className="d-none d-lg-block" />  for your Self Assessment? </h2>
                                    <p className="mt-4">A simpler way to do your tax return. No spreadsheets. No guesswork. Just a clear process that helps you get it done.
                                    </p>
                                </div>
                            </div>
                        </Col>
                        <Col lg={5}>
                            <div className="choose-right-box">
                                <img src="/images/choose-img.png" alt="Choose Image" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section >
            {/* Choose Section End  */}

            <section className="stop-stressing-sec ptb-80">
                <Container>
                    <div className="stop-stressing-content text-center">
                        <h2 className='text-white'>Stop Stressing <span>About Tax</span></h2>
                        <p>Join 1,000+ UK businesses using TaxSimba to manage their tax the simple way.</p>
                        <Link href="/register" className="common-btn">
                            Start Your Free Trial Today <MdKeyboardDoubleArrowRight className="ms-1" />
                        </Link>
                        <p className="no-card mt-4">No card required • Cancel anytime • Stay compliant with confidence</p>
                    </div>
                </Container>
            </section>

            {/* Feature Section Start */}
            <section className="features-sec self-features-sec ptb-80 mx-3">
                <Container>
                    <div className="features-inr-box">
                        <Row className="align-items-center">
                            <Col lg={6}>
                                <div className="features-left-img">
                                    <img src="/images/feature-img.png" alt="img" className="img-fluid" />
                                </div>
                            </Col>
                            <Col lg={6} className="mt-lg-0 mt-4">
                                <div className="features-right-box ps-lg-4 ps-0">
                                    <div className="features-title-box text-left mb-4">
                                        <span className="features-subtitle">#accountant</span>
                                        <h2>Do you actually need an accountant?</h2>
                                        <p>For many simple tax returns, you can do it yourself.</p>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section >
            {/* Feature Section End */}

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
                                {loadingFaqs ? (
                                    <div className="text-center p-4">
                                        <Spinner animation="border" variant="success" />
                                    </div>
                                ) : faqs.length > 0 ? (
                                    <Accordion defaultActiveKey="0">
                                        {faqs.map((faq, index) => (
                                            <Accordion.Item eventKey={index.toString()} key={faq.id || index}>
                                                <Accordion.Header>{faq.question || faq.q || faq.title || "FAQ"}</Accordion.Header>
                                                <Accordion.Body>
                                                    {faq.answer || faq.a || faq.description || "Content not available."}
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        ))}
                                    </Accordion>
                                ) : (
                                    <p className="text-center text-muted">No FAQs available at the moment.</p>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
            {/* FAQ Section End */}

        </>
    )
}

export default page