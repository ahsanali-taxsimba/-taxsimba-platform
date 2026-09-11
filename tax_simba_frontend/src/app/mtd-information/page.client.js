"use client";

import { signIn, useSession } from 'next-auth/react';
import Link from "next/link";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Col, Container, Form, Modal, Row, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { FaCheck, FaTimes, FaStar, FaChevronRight } from 'react-icons/fa';
import { GoArrowUpRight } from 'react-icons/go';
import { MdCurrencyPound, MdKeyboardDoubleArrowRight, MdOutlineCheckCircle } from "react-icons/md";
import { RxCross2 } from "react-icons/rx";
import { Check, ShieldCheck, Users, Lock, Calendar, MessageSquare, ArrowRight, Star, Award, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FaQuoteLeft } from "react-icons/fa";
import { getCurrencySymbol } from '@/utils/commonHelper';
import MtdPricingSection from '@/components/MtdPricingSection';
import toast from 'react-hot-toast';




function page() {

    const [show, setShow] = useState(false);

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    const router = useRouter();

    const { data: sessionData, status } = useSession();

    console.log(sessionData, status, "sessionData");

    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [currentPlanId, setCurrentPlanId] = useState(null);

    useEffect(() => {
        const fetchCurrentPlan = async () => {
            if (status === "authenticated" && sessionData?.accessToken) {
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                    const response = await axios.post(`${apiUrl}auth/get-account-details`, {}, {
                        headers: { Authorization: `Bearer ${sessionData.accessToken}` }
                    });
                    if (response.data?.data?.subscription) {
                        setCurrentPlanId(response.data.data.subscription.planId);
                    }
                } catch (error) {
                    console.error("Error fetching account details:", error);
                }
            }
        };
        const fetchPlans = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                const response = await axios.get(`${apiUrl}subscription-plans?category=mtd`);
                if (response.data && Array.isArray(response.data.data)) {
                    setSubscriptionPlans(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching subscription plans:", error);
            } finally {
                setLoadingPlans(false);
            }
        };
        fetchPlans();
        fetchCurrentPlan();
    }, [status, sessionData]);

    // MTD Eligibility Checker Logic start

    const [income, setIncome] = useState("");
    const [resultType, setResultType] = useState("");

    // New states for MTD submission
    const [isSelfEmployed, setIsSelfEmployed] = useState(null);
    const [hasRentalIncome, setHasRentalIncome] = useState(null);
    const [errors, setErrors] = useState({});
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState("");
    const [apiSuccess, setApiSuccess] = useState("");

    const handlePasswordSubmit = async () => {
        if (!password) {
            setVerificationError("Please enter your password.");
            return;
        }
        if (status !== "authenticated" || !sessionData?.user?.email) {
            setVerificationError("User is not logged in properly.");
            return;
        }

        setIsVerifying(true);
        setVerificationError("");

        try {
            // Validate password using NextAuth signIn credentials provider
            const res = await signIn("credentials", {
                email: sessionData.user.email,
                password: password,
                redirect: false,
            });

            if (res?.error) {
                setVerificationError("Invalid password. Please try again.");
                setIsVerifying(false);
                return;
            }

            // If success, construct query parameters
            const params = new URLSearchParams();
            if (sessionData?.user?.firstName) params.append("firstName", sessionData.user.firstName);
            if (sessionData?.user?.lastName) params.append("lastName", sessionData.user.lastName);
            if (sessionData?.user?.email) params.append("email", sessionData.user.email);
            if (sessionData?.user?.mobile) params.append("phone", sessionData.user.mobile);
            if (income) params.append("annualIncome", income);
            if (isSelfEmployed) params.append("isSelfEmployed", isSelfEmployed);
            if (hasRentalIncome) params.append("hasRentalIncome", hasRentalIncome);
            if (password) params.append("password", password);
            params.append("isExternalPlatform", "true");

            const baseUrl = process.env.NEXT_PUBLIC_SIMBAX_PLATFORM_URL || "http://localhost:2327";
            const redirectUrl = `${baseUrl}?${params.toString()}`;

            setApiSuccess("Password verified! Redirecting...");
            setShowPasswordModal(false);
            setPassword("");

            // Redirect to Simbax platform with data
            window.location.href = redirectUrl;

        } catch (error) {
            setVerificationError("An unexpected error occurred.");
            console.error(error);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleStartUsingSimbax = () => {
        if (status === "authenticated") {
            setShowPasswordModal(true);
        } else {
            const baseUrl = process.env.NEXT_PUBLIC_SIMBAX_PLATFORM_URL || "http://localhost:2327";
            window.location.href = `${baseUrl}/register`;
        }
    };


    const handleCheck = () => {
        const newErrors = {};
        const value = Number(income);

        if (!income || value <= 0) {
            newErrors.income = "Please enter a valid annual income greater than 0";
        }
        if (isSelfEmployed === null) {
            newErrors.isSelfEmployed = "Please select Yes or No";
        }
        if (hasRentalIncome === null) {
            newErrors.hasRentalIncome = "Please select Yes or No";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error("Please complete all questions before checking");
            return;
        }

        setErrors({});

        // MTD only applies if user is self-employed/sole trader OR has rental income
        if (isSelfEmployed === "no" && hasRentalIncome === "no") {
            setResultType("green");
            return;
        }

        if (value >= 50000) {
            setResultType("warning-2026");
        } else if (value >= 30000) {
            setResultType("warning-2027");
        } else if (value >= 20000) {
            setResultType("warning-2028");
        } else {
            setResultType("green");
        }
    };

    const handleReset = (e) => {
        e.preventDefault();
        setIncome("");
        setResultType("");
        setIsSelfEmployed(null);
        setHasRentalIncome(null);
        setErrors({});
    };

    // MTD Eligibility Checker Logic end

    return (
        <>
            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="banner-cont bread-crum-inr-box text-lg-start text-center">
                                <h6 className="banner_span">HMRC <span> Compliance 2026</span></h6>
                                {/* <h2 className="text-capitalize mb-3"> <span>Making Tax Digital</span> is coming</h2> */}
                                <h1 className="text-capitalize mb-3 fs-2"> <span>Making Tax Digital</span> is here</h1>
                                <p>HMRC rules apply from April 2026. Stay ahead of the curve with simplified digital accounting tailored for the UK.</p>
                                <div className='mtd-banner-btn d-flex align-items-center justify-content-lg-start justify-content-center gap-2 mt-4 pt-2'>
                                    <Link href={status === "authenticated" ? "/dashboard" : "/register?role=MTD"} className="common-btn glowing-button justify-content-center">Get Started</Link>
                                    <Link href="/check-mtd" className="common-btn-outline ">Check if I need MTD</Link>
                                </div>
                                <ul className='list-unstyled d-flex align-item-center gap-3 w-100 mt-4 pt-3 justify-content-lg-start justify-content-center'>
                                    <li className='text-white '><img src="/images/check-icon.png" alt="img" className='me-2' />HMRC Recognised</li>
                                    <li className='text-white '><img src="/images/secure-icon.png" alt="img" className='me-2' />UK Cloud Secure</li>
                                </ul>

                            </div>
                        </Col>
                        <Col lg={6} className="mt-lg-0 mt-5">
                            <div className="breadcrum-image-mtd breadcrum-img text-center">
                                <img src="/images/mtd-banner-img.png" alt="Breadcrumb Image" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="about-choose-sec ptb-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={5}>
                            <div className="choose-left-img mtd-choose-left-img mb-lg-0 mb-4 h-100 d-lg-block d-none">
                                <img
                                    src="/images/mt-img.png"
                                    alt="About TaxSimba"
                                    className="img-fluid"
                                />
                            </div>
                        </Col>
                        <Col lg={7}>
                            <div className="choose-right-content ps-lg-5 ps-0">
                                <div className="site-heading common-title mb-0">
                                    <h2>
                                        What is  <span className="text-green"> Making Tax Digital (MTD)?</span>
                                    </h2>
                                    <p>
                                        Making Tax Digital (MTD) is HMRC’s new way of managing tax. Instead of paperwork, everything is done digitally.
                                    </p>
                                    <ul className="list-unstyled simple-mtd-box mt-4">
                                        <li className='d-flex align-items-center gap-2'>

                                            <span> <FaCheck /></span>
                                            Keep your records in one place.
                                        </li>
                                        <li className='d-flex align-items-center gap-2'>

                                            <span> <FaCheck /></span>
                                            Track income and expenses easily.
                                        </li>
                                        <li className='d-flex align-items-center gap-2 mb-0'>

                                            <span> <FaCheck /></span>
                                            Submit your tax return online.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            {/* Eligibility Section Start  */}
            <section className="eligibility-sec eligibility-sec-mtd eligibility-sec-mtd-new ptb-80">
                <Container>
                    <div className="eligibility-inr-box">
                        <Row className="align-items-center">
                            <Col lg={7} className="mb-lg-0 mb-4">
                                <div className="eligibility-left-box pe-lg-4 pe-0">
                                    <div className="main-title mb-4 p-0">
                                        <h2 className='text-start text-white text-capitalize'>Will this <span> affect you?</span></h2>
                                        <p className="text-white mt-lg-4 mt-2">HMRC's Making Tax Digital (MTD) for Income Tax will
                                            fundamentally change how self-employed individuals and landlords report their earnings.</p>
                                    </div>
                                    <ul className="eligibility-list list-unstyled">
                                        <li><span className="me-2"><img src="/images/user-search.png" alt="img" /></span>Self-employed individuals with income over £50,000 (from April 2026) or over £30,000 (from April 2027)</li>
                                        <li><span className="me-2"><img src="/images/landlord.png" alt="img" /></span>Landlords with rental income over £50,000 (from April 2026) or over £30,000 (from April 2027)</li>

                                    </ul>
                                </div>
                            </Col>
                            <Col lg={5}>
                                <div className="mtd-card">
                                    <div className="mtd-header-section">
                                        <h2 className="mtd-title">MTD Eligibility Checker</h2>
                                        <p className="mtd-subtitle">Check your eligibility in seconds</p>
                                    </div>
                                    <div className="mtd-box custom-form">
                                        <div className={`mtd-body-section ${resultType ? "hide" : "show"}`} aria-hidden={!!resultType}>
                                            <div className="mtd-question-group">
                                                <label className="mtd-question-label">
                                                    1. What is your annual income?
                                                </label>
                                                <div className="mtd-input-wrapper">
                                                    <MdCurrencyPound className="mtd-input-icon" />
                                                    <Form.Control
                                                        type="number"
                                                        placeholder="0.00"
                                                        className={`mtd-text-input ${errors.income ? 'is-invalid' : ''}`}
                                                        value={income}
                                                        onChange={(e) => {
                                                            setIncome(e.target.value);
                                                            if (errors.income) {
                                                                setErrors(prev => ({ ...prev, income: null }));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                {errors.income && (
                                                    <div className="text-danger small mt-1 fw-medium">{errors.income}</div>
                                                )}
                                            </div>
                                            <div className="mtd-question-group">
                                                <label className="mtd-question-label">
                                                    2. Are you self-employed or a sole trader?
                                                </label>
                                                <div className="mtd-button-toggle-group">
                                                    <input
                                                        type="radio"
                                                        id="yes"
                                                        name="elegibility-check"
                                                        checked={isSelfEmployed === 'yes'}
                                                        onChange={() => {
                                                            setIsSelfEmployed('yes');
                                                            if (errors.isSelfEmployed) {
                                                                setErrors(prev => ({ ...prev, isSelfEmployed: null }));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor="yes">Yes</label>

                                                    <input
                                                        type="radio"
                                                        id="no"
                                                        name="elegibility-check"
                                                        checked={isSelfEmployed === 'no'}
                                                        onChange={() => {
                                                            setIsSelfEmployed('no');
                                                            if (errors.isSelfEmployed) {
                                                                setErrors(prev => ({ ...prev, isSelfEmployed: null }));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor="no">No</label>
                                                </div>
                                                {errors.isSelfEmployed && (
                                                    <div className="text-danger small mt-1 fw-medium">{errors.isSelfEmployed}</div>
                                                )}
                                            </div>
                                            <div className="mtd-question-group">
                                                <label className="mtd-question-label">
                                                    3. Do you have rental income?
                                                </label>
                                                <div className="mtd-button-toggle-group">
                                                    <input
                                                        type="radio"
                                                        id="rental-yes"
                                                        name="rental-check"
                                                        checked={hasRentalIncome === 'yes'}
                                                        onChange={() => {
                                                            setHasRentalIncome('yes');
                                                            if (errors.hasRentalIncome) {
                                                                setErrors(prev => ({ ...prev, hasRentalIncome: null }));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor="rental-yes">Yes</label>

                                                    <input
                                                        type="radio"
                                                        id="rental-no"
                                                        name="rental-check"
                                                        checked={hasRentalIncome === 'no'}
                                                        onChange={() => {
                                                            setHasRentalIncome('no');
                                                            if (errors.hasRentalIncome) {
                                                                setErrors(prev => ({ ...prev, hasRentalIncome: null }));
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor="rental-no">No</label>
                                                </div>
                                                {errors.hasRentalIncome && (
                                                    <div className="text-danger small mt-1 fw-medium">{errors.hasRentalIncome}</div>
                                                )}
                                            </div>
                                            <div className="mtd-action-section">
                                                <Button className="mtd-submit-btn" onClick={handleCheck}>
                                                    Check If You Need MTD
                                                    <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                                                </Button>
                                            </div>
                                        </div>
                                        {/* Warning result */}
                                        {resultType && resultType.startsWith("warning") && (
                                            <div className="alert-msg-box m-3 show">
                                                <Alert className="position-relative border-warning bg-opacity-10 bg-warning text-dark pt-3 pb-4 px-3 rounded-4 shadow-sm mb-0">
                                                    {resultType === "warning-2026" && (
                                                        <>
                                                            <h6 className="fw-bold mb-1 text-dark">You must comply with MTD</h6>
                                                            <p className="mb-3 text-muted">
                                                                Comply with MTD from April 2026—TaxSimba manages it automatically.
                                                            </p>
                                                        </>
                                                    )}
                                                    {resultType === "warning-2027" && (
                                                        <>
                                                            <h6 className="fw-bold mb-1 text-dark">You must comply with MTD</h6>
                                                            <p className="mb-3 text-muted">
                                                                Comply with MTD from April 2027—TaxSimba manages it automatically.
                                                            </p>
                                                        </>
                                                    )}
                                                    {resultType === "warning-2028" && (
                                                        <>
                                                            <h6 className="fw-bold mb-1 text-dark">MTD is planned for you</h6>
                                                            <p className="mb-3 text-muted">
                                                                MTD is planned to apply to you from April 2028, or you can join voluntarily.
                                                            </p>
                                                        </>
                                                    )}

                                                    {apiSuccess && <Alert variant="success" className="p-2 mb-3">{apiSuccess}</Alert>}

                                                    <Link
                                                        href="#pricing-section"
                                                        className="common-btn px-4 py-2 border-0 d-inline-block w-100 text-center text-white text-decoration-none"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            document.getElementById("pricing-section")?.scrollIntoView({ behavior: "smooth" });
                                                        }}
                                                    >
                                                        Start Using TaxSimba
                                                    </Link>

                                                    <Link
                                                        href="#"
                                                        onClick={handleReset}
                                                        className="back-form-btn"
                                                    >
                                                        <RxCross2 />
                                                    </Link>
                                                </Alert>
                                            </div>
                                        )}

                                        {/* Green result */}
                                        {resultType === "green" && (
                                            <div className="alert-msg-box m-3 show">
                                                <Alert className="position-relative border-success bg-opacity-10 bg-success text-success pt-3 pb-4 px-3 rounded-4 shadow-sm mb-0">
                                                    <h6 className="fw-bold mb-1 text-success">MTD doesn&apos;t apply to you yet</h6>
                                                    <p className="mb-3 text-success">
                                                        You don&apos;t need to worry about MTD right now. But you still need to file your Self Assessment!
                                                    </p>

                                                    <Link href={status === "authenticated" ? "/dashboard" : "/register?role=MTD"} className="common-btn d-inline-block w-100">
                                                        Start Using TaxSimba
                                                    </Link>

                                                    <Link
                                                        href="#"
                                                        onClick={handleReset}
                                                        className="back-form-btn"
                                                    >
                                                        <RxCross2 />
                                                    </Link>
                                                </Alert>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section >
            {/* Eligibility Section End  */}



            {/* CTA Section Start */}
            <section className="cta-main bottom-cta mobile-cta ptb-80 pt-0">
                <Container>
                    <div className="cta-inner">
                        <Row>
                            <Col lg={12}>
                                <div className="cta-cont text-center">
                                    <div className="stop-stressing-content text-center">
                                        <div className="mb-3 cta-img-box">
                                            <img src="/images/cta-logo.png" alt="" />
                                        </div>
                                        <h2 className="text-lt-theme">
                                            How TaxSimba Works <span> step by step </span>
                                        </h2>
                                        <p className="mt-1">
                                            See what happens after you purchase your MTD package and how our dedicated accountants manage your submission from start to finish.
                                        </p>
                                        <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-4">
                                            <button className="common-btn" onClick={handleShow}>
                                                Watch How It Works <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section>

            {/* How Work Section Start */}
            <section className="start-simbox-sec step-sec-home step-sec-mtd ptb-80 pt-0 position-relative">
                <Container>
                    <div className="common-title text-lg-start text-center mb-lg-5 mb-4">
                        <h2>MTD in <span className="text-green">3 simple steps</span></h2>
                    </div>
                    <Row>
                        <Col lg={4} className="mb-lg-0 mb-4">
                            <div className="start-simbox-card">
                                <div className="start-simbax-img">
                                    <img src="/images/step-1.png" alt="img" />
                                </div>
                                <div className="start-simbax-dis">
                                    <span className="start-count">
                                        1
                                    </span>
                                    <h4>Keep digital records</h4>
                                    <p>Log every transaction digitally as they happen throughout the fiscal year.</p>

                                </div>

                            </div>
                        </Col>
                        <Col lg={4} className="mb-lg-0 mb-4">
                            <div className="start-simbox-card">
                                <div className="start-simbax-img">
                                    <img src="/images/step-2.png" alt="img" />
                                </div>
                                <div className="start-simbax-dis">
                                    <span className="start-count">
                                        2
                                    </span>
                                    <h4>Send updates every 3 months</h4>
                                    <p>Submit a summary of your income
                                        and expenses to HMRC every
                                        quarter.</p>

                                </div>

                            </div>
                        </Col>
                        <Col lg={4} className="mb-0">
                            <div className="start-simbox-card">
                                <div className="start-simbax-img">
                                    <img src="/images/step-3.png" alt="img" />
                                </div>
                                <div className="start-simbax-dis">
                                    <span className="start-count">
                                        3
                                    </span>
                                    <h4>Submit tax return online</h4>
                                    <p>Finalise your annual tax position
                                        using MTD-compatible software
                                        like ours.</p>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
            {/* How Work Section End */}
            {/* Premium Luxury Pricing Section */}
            <section id="pricing-section" className="mtd-luxury-section ptb-80 position-relative overflow-hidden mb-5">
                {/* Decorative Glows */}
                <div className="luxury-glow-orb glow-1"></div>
                <div className="luxury-glow-orb glow-2"></div>

                <Container className="position-relative z-1">
                    {/* Section Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="text-center mb-5 mt-4"
                    >
                        <div className="d-inline-flex align-items-center gap-2 section-header-badge mb-3 px-3 text-white">
                            <span className="pulsing-dot"></span>
                            MAKING TAX DIGITAL EXPERTS
                        </div>
                        <h1 className="fw-bold mb-3 display-4 text-white">
                            Stay HMRC Compliant <br />
                            <span className="text-lt-theme text-glow">Without The Stress</span>
                        </h1>
                        <p className="opacity-75 mx-auto mb-4 text-white" style={{ maxWidth: '650px', fontSize: '18px', lineHeight: '1.6' }}>
                            We handle your Making Tax Digital (MTD) filing from start to finish so you can focus on growing your business.
                        </p>

                        <div className="d-flex justify-content-center gap-md-5 gap-3 flex-wrap opacity-75 mt-4 text-white">
                            {["HMRC Compliant", "UK Accountant Support", "Secure & Confidential", "Cancel Anytime"].map((text, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.2 + (i * 0.1) }}
                                    className="d-flex align-items-center gap-2 small fw-medium"
                                >
                                    <Check size={18} className="text-lt-theme" /> {text}
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="w-100"
                    >
                        {loadingPlans ? (
                            <div className="text-center py-5">
                                <Spinner animation="border" variant="light" />
                            </div>
                        ) : (
                            <MtdPricingSection
                                subscriptionPlans={subscriptionPlans}
                                currentPlanId={currentPlanId}
                                onSelectPlan={(planId) => {
                                    if (currentPlanId === planId) {
                                        router.push(`/dashboard/my-subscriptions`);
                                    } else if (status === "authenticated") {
                                        router.push(`/planlist/${planId}`);
                                    } else {
                                        router.push(`/register?role=MTD`);
                                    }
                                }}
                            />
                        )}
                    </motion.div>

                    {/* Stats Section */}
                    <div className="mt-5 pt-3">
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            viewport={{ once: true }}
                            className="d-flex justify-content-center gap-1 mb-4"
                        >
                            {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill="#b3ed97" color="#b3ed97" />)}
                            <span className="ms-3 small opacity-75 text-white">Rated 4.9/5 by UK business owners</span>
                        </motion.div>

                        <Row className="justify-content-center g-4 text-center">
                            {[
                                { label: "Happy Clients", val: "1,000+" },
                                { label: "HMRC Compliant", val: "100%" },
                                { label: "Accounting Experience", val: "10+ Years" },
                                { label: "Average Rating", val: "4.9/5" }
                            ].map((stat, i) => (
                                <Col key={i} lg={2} md={4} xs={6}>
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        viewport={{ once: true }}
                                        className="stat-item text-white"
                                    >
                                        <h3 className="fw-bold mb-1 text-white">{stat.val}</h3>
                                        <div className="extra-small opacity-75 text-white">{stat.label}</div>
                                    </motion.div>
                                </Col>
                            ))}
                        </Row>
                    </div>
                </Container>

                {/* Footer Bar */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    viewport={{ once: true }}
                    className="luxury-footer-bar glass-footer mt-5"
                >
                    <Container>
                        <div className="d-flex flex-wrap justify-content-center gap-md-5 gap-3 opacity-60 extra-small py-3 text-white">
                            <div className="d-flex align-items-center gap-2">
                                <Lock size={14} className="text-lt-theme" /> Your data is 100% secure and never shared.
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <ShieldCheck size={14} className="text-lt-theme" /> Proud to support UK sole traders and small businesses.
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <img src="https://flagcdn.com/w20/gb.png" width="16" alt="UK flag" className="rounded-1" /> UK Based Support
                            </div>
                        </div>
                    </Container>
                </motion.div>
            </section>

            <section className="about-choose-sec benefit-sec-mtd ptb-80">
                <Container>
                    <Row className="align-items-center">
                        <Col xl={5} lg={12} className='d-lg-block d-none'>
                            <div className="choose-left-img mb-xl-0 mb-4 h-100">
                                <img
                                    src="/images/feels-img.png"
                                    alt="About TaxSimba"
                                    className="img-fluid"
                                />
                            </div>
                        </Col>
                        <Col xl={7} lg={12}>
                            <div className="choose-right-content ps-xl-5 ps-0 mt-xl-0 mt-0">
                                <div className="site-heading common-title mb-0">
                                    <h2>Why MTD
                                        <span> feels confusing</span>
                                    </h2>
                                    <p>
                                        Navigating new government mandates shouldn't feel like an uphill
                                        battle. Most current systems aren't ready for the transition.  </p>
                                </div>
                                <div className="feature-list-wrapper mt-4">
                                    <Row className='align-items-center'>
                                        <Col lg={6}>
                                            <div className="feature-card  mb-4">
                                                <div className="feature-name">
                                                    <h6>Real-time digital records</h6>
                                                    <p>Moving from one annual filing to four digital updates per year is a huge shift in workload.</p>
                                                </div>
                                            </div>
                                        </Col>
                                        <Col lg={6}>
                                            <div className="feature-card  mb-4">
                                                <div className="feature-name">
                                                    <h6>Digital software requirement</h6>
                                                    <p>Paper records or standard spreadsheets will no longer be accepted
                                                        by HMRC.</p>
                                                </div>
                                            </div>
                                        </Col>
                                        <Col lg={12}>
                                            <div className="feature-card last-card">
                                                <div className="feature-name">
                                                    <h6>Penalties</h6>
                                                    <p>New points-based penalty system for late submissions and
                                                        payments starting 2026.</p>
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
            {/* Process Section Start */}
            <section className="process-sec mb-5">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={10} className="mx-auto">
                            <div className="process-box d-flex align-items-center justify-content-center gap-xxl-5 gap-3 flex-wrap">
                                <div className="process-img">
                                    <img className="img-fluid" src="/images/mtd-process-img.png" alt="process-img" />
                                </div>
                                <div className="d-flex align-items-center gap-lg-5 gap-2 flex-wrap justify-content-md-start justify-content-center">
                                    <div className="process-txt">
                                        <h6>Stay Compliant With MTD Without The Stress.</h6>
                                    </div>
                                    <div className="process-btn">
                                        <Link href={status === "authenticated" ? "/dashboard" : "/register?role=MTD"} className="common-btn text-capitalize ">Get Started <GoArrowUpRight className="ms-1" /></Link>
                                    </div>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>
            {/* Process Section end */}


            <section className="easy-sec easy-sec-home easy-sec-home-new ptb-80 pt-4">
                <Container>
                    <div className="easy-content-main">
                        <Row className="g-0">
                            <Col className="p-0" lg={6} md={12} sm={12} xs={12}>
                                <div className="easy-content-inner">
                                    <h2>Powerful Tools to <span>Simplify Your Digital Tax Journey</span></h2>
                                    <ul className="easy-list">
                                        <li><MdOutlineCheckCircle />Connect Your Bank</li>
                                        <li><MdOutlineCheckCircle />Track Income & Expenses</li>
                                        <li><MdOutlineCheckCircle />Add Records Manually</li>
                                        <li><MdOutlineCheckCircle />Send Updates to HMRC</li>
                                        <li><MdOutlineCheckCircle />Clear Reports</li>
                                        <li><MdOutlineCheckCircle />Smart Insights</li>

                                    </ul>
                                    {/* <Link href="/mtd-information" className="common-btn mt-4 d-inline-block">
                                        Learn More About MTD  <MdKeyboardDoubleArrowRight className="ms-1" />
                                    </Link> */}
                                </div>
                            </Col>
                            <Col className="p-0" lg={6} md={12} sm={12} xs={12}>
                                <div className="easy-img">
                                    <img src="/images/mtd.jpg" alt="img" />
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section>

            <section className='why-choose ptb-80 mx-lg-3 mx-0'>
                <Container>
                    <Row className='align-items-center'>
                        <Col lg={6} className='mb-lg-0 mb-0'>
                            <div className="why-choose-right-box pe-lg-5 pe-0">
                                <h2 className='text-white'>
                                    A simpler way to   <span> handle MTD </span>
                                </h2>
                                <p className='text-white'>
                                    We've built TaxSimba specifically for the 2026 transition,
                                    focusing on clarity and ease of use for non-accountants.
                                </p>
                                <ul className="list-unstyled simple-mtd-box mt-4">
                                    <li className='d-flex align-items-center gap-2 text-white'>

                                        <span> <FaCheck /></span>
                                        Track income and expenses in real-time
                                    </li>
                                    <li className='d-flex align-items-center gap-2 text-white'>

                                        <span> <FaCheck /></span>
                                        Auto-organised for quarterly submissions
                                    </li>
                                    <li className='d-flex align-items-center gap-2 text-white mb-0'>

                                        <span> <FaCheck /></span>
                                        Direct secure submission to HMRC
                                    </li>
                                </ul>
                            </div>
                        </Col>

                        <Col lg={6} className='d-lg-block d-none'>
                            <div className="why-chose-left-box">
                                <img src="/images/graph-img.png" alt="img" className='img-fluid' />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="comparison-section ptb-80">
                <Container>
                    <div className="comparison-wrapper">
                        <Row>
                            <Col lg={6} className='pe-0'>
                                <div className='comparison-left '>
                                    <h3 className="comparison-title">Without <span> TaxSimba </span> </h3>
                                    <ul className="comparison-list">
                                        <li>
                                            <FaTimes className="icon cross-icon" />
                                            Manual spreadsheet entries
                                        </li>
                                        <li>
                                            <FaTimes className="icon cross-icon" />
                                            Paper receipts in boxes
                                        </li>
                                        <li>
                                            <FaTimes className="icon cross-icon" />
                                            End-of-year tax panic
                                        </li>
                                        <li className='mb-0'>
                                            <FaTimes className="icon cross-icon" />
                                            Risk of MTD non-compliance
                                        </li>
                                    </ul>
                                </div>
                            </Col>
                            <Col lg={6} className='ps-0' >
                                <div className='comparison-right '>
                                    <h3 className="comparison-title text-white">
                                        With <span> TaxSimba </span>
                                    </h3>
                                    <ul className="comparison-list">
                                        <li>
                                            <FaCheck className="icon check-icon" />
                                            Real-time digital records
                                        </li>
                                        <li>
                                            <FaCheck className="icon check-icon" />
                                            Snap receipts with your phone
                                        </li>
                                        <li>
                                            <FaCheck className="icon check-icon" />
                                            Quarterly automation
                                        </li>
                                        <li className='mb-0'>
                                            <FaCheck className="icon check-icon" />
                                            Fully HMRC-recognised software
                                        </li>
                                    </ul>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section>


            {/* CTA Section Start */}
            <section className="cat-mt-0 cta-main bottom-cta mobile-cta ptb-80 pt-0">
                <Container>
                    <div className="cta-inner">
                        <Row>
                            <Col lg={12}>
                                <div className="cta-cont text-center">
                                    <div className="stop-stressing-content text-center">
                                        <h2 className="text-lt-theme">
                                            Make Tax Digital.   <span>  Make It Easy. </span>
                                        </h2>
                                        <p className='text-white mb-0'>Real-time records, receipt capture, and HMRC submissions in one place.{subscriptionPlans.length > 0 && <> From {getCurrencySymbol(subscriptionPlans[0].currency)}{subscriptionPlans[0].price}/month.</>}</p>
                                        <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-4">
                                            <Link href={status === "authenticated" ? "/dashboard" : "/register?role=MTD"} className="common-btn">
                                                Get Started <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                                            </Link>
                                            {/* <Link href="https://simbax.toxsl.in/" className="common-btn-outline" target="_blank">
                        Start using TaxSimba <MdKeyboardDoubleArrowRight className="mtd-btn-icon" />
                      </Link> */}
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </section>
            {/* Password Confirmation Modal */}
            <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Your Identity</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Please confirm your password to proceed with MTD and start using TaxSimba.</p>

                    {verificationError && (
                        <Alert variant="danger" className="p-2 mb-3">
                            {verificationError}
                        </Alert>
                    )}

                    <Form.Group className="mb-3">
                        <Form.Label>Password</Form.Label>
                        <Form.Control
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" className="common-bd-btn" onClick={() => setShowPasswordModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" className="common-btn px-4" onClick={handlePasswordSubmit} disabled={isVerifying}>
                        {isVerifying ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Verifying...
                            </>
                        ) : (
                            "Confirm & Start"
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>


            {/* video modal */}
            <Modal show={show} onHide={handleClose} className="video-modal-box" centered>
                <Modal.Header closeButton>
                </Modal.Header>
                <Modal.Body>
                    <div className="video-box">
                        <video controls autoPlay>
                            <source src="/images/mtd.mp4" type="video/mp4" />
                        </video>

                    </div>
                </Modal.Body>
            </Modal>

        </>
    )
}

export default page