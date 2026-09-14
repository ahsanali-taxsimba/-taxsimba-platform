"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Alert, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { FaArrowDown, FaDollarSign, FaStar, FaChevronRight, FaQuoteLeft } from "react-icons/fa";
import { MdKeyboardDoubleArrowRight, MdOutlineCheckCircle, MdOutlinePrivacyTip } from "react-icons/md";
import Button from 'react-bootstrap/Button';
import { GoArrowUpRight } from "react-icons/go";
import { RxCross2 } from "react-icons/rx";
import { MdCurrencyPound } from "react-icons/md";
import { Check, ShieldCheck, Users, Lock, Calendar, MessageSquare, ArrowRight, Star, Award, Shield } from "lucide-react";
import { FaArrowRight, FaCalendarCheck, FaChartBar, FaCheck, FaExclamationCircle, FaShieldAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import axios from 'axios';
import { getCurrencySymbol } from '@/utils/commonHelper';
import MtdPricingSection from '@/components/MtdPricingSection';
import toast from 'react-hot-toast';
import { Modal } from "react-bootstrap";

export default function MtdClient() {
    const [show, setShow] = useState(false);

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    const router = useRouter();
    const { data: sessionData, status } = useSession();

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

    const [income, setIncome] = useState("");
    const [resultType, setResultType] = useState("");
    const [isSelfEmployed, setIsSelfEmployed] = useState(null);
    const [hasRentalIncome, setHasRentalIncome] = useState(null);
    const [errors, setErrors] = useState({});

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

    const [blogs, setBlogs] = useState([]);
    const [loadingBlogs, setLoadingBlogs] = useState(true);
    const [totalBlogs, setTotalBlogs] = useState(0);

    useEffect(() => {
        const fetchBlogs = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
                const response = await axios.get(`${apiUrl}resources/blogs?limit=3&type=MTD`);
                if (response.data && Array.isArray(response.data.data?.articles)) {
                    setBlogs(response.data.data.articles.slice(0, 3));
                    setTotalBlogs(response.data.data.pagination?.total || response.data.data.articles.length);
                } else if (response.data && Array.isArray(response.data.data)) {
                    setBlogs(response.data.data.slice(0, 3));
                    setTotalBlogs(response.data.data.length);
                }
            } catch (error) {
                console.error("Error fetching blogs:", error);
            } finally {
                setLoadingBlogs(false);
            }
        };
        fetchBlogs();
    }, []);

    return (
        <>
            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h1 className="text-capitalize mb-3 fs-2">Check if I need MTD</h1>
                                <p className="mb-0">Find out if your business or self-employment income requires you to follow Making Tax Digital (MTD) rules. Use our simple tool to stay compliant with HMRC.</p>
                            </div>
                        </Col>
                        <Col lg={6} className="mt-lg-0 mt-5">
                            <div className="breadcrum-img text-center">
                                <img src="/images/check-if-bread.png" alt="Breadcrumb Image" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="eligibility-sec eligibility-sec-mtd ptb-80">
                <Container>
                    <div className="eligibility-inr-box">
                        <Row className="align-items-center">
                            <Col lg={7} className="mb-lg-0 mb-4">
                                <div className="eligibility-left-box pe-lg-4 pe-0">
                                    <div className="main-title mb-4 p-0">
                                        <h2 className='text-start'>Do I need to use <br className="d-none d-lg-block" /> <span> Making Tax Digital?</span></h2>
                                        <p className="text-white mt-4">If you earn over <span className="text-lt-theme">£30,000</span> (from April 2027) or <span className="text-lt-theme">£50,000</span> (from April 2026), new HMRC rules apply.
                                        </p>
                                    </div>
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
                                                        checked={isSelfEmployed === "yes"}
                                                        onChange={() => {
                                                            setIsSelfEmployed("yes");
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
                                                        checked={isSelfEmployed === "no"}
                                                        onChange={() => {
                                                            setIsSelfEmployed("no");
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
                                                        checked={hasRentalIncome === "yes"}
                                                        onChange={() => {
                                                            setHasRentalIncome("yes");
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
                                                        checked={hasRentalIncome === "no"}
                                                        onChange={() => {
                                                            setHasRentalIncome("no");
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

                                                    <Link
                                                        href="#pricing-section"
                                                        className="common-btn d-inline-block w-100"
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

                                                    <Link href="/login" className="common-btn d-inline-block w-100">
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

            <section id="pricing-section" className="mtd-luxury-section ptb-80 position-relative overflow-hidden">
                <div className="luxury-glow-orb glow-1"></div>
                <div className="luxury-glow-orb glow-2"></div>

                <Container className="position-relative z-1">
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
                                        <h3 className="fw-bold mb-1">{stat.val}</h3>
                                        <div className="extra-small opacity-75">{stat.label}</div>
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

            <section className="cta-main bottom-cta mobile-cta ptb-80">
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

            <section className="taxes-section-bg ptb-80 mt-lg-5 mt-0">
                <Container className="taxes-container-wrapper">
                    <Row className="justify-content-center text-center">
                        <Col lg={12}>
                            <div className="taxes-header-wrapper">
                                <h1 className="taxes-main-title">File Taxes Faster. Save Time. Reduce Stress.</h1>
                            </div>
                        </Col>
                    </Row>

                    <Row className="justify-content-center taxes-cards-row g-4">
                        <Col lg={4} md={6}>
                            <div className="taxes-data-card">
                                <Card.Body className="taxes-card-inner-body">
                                    <Card.Title className="taxes-card-heading">Less Time Filing Taxes</Card.Title>
                                    <Card.Text className="taxes-card-description">
                                        Answer simple questions instead of complicated tax forms.
                                    </Card.Text>
                                    <div className="taxes-percentage-group">
                                        <span className="taxes-percentage-value">-80%</span>
                                        <FaArrowDown className="taxes-down-arrow-icon" />
                                    </div>
                                </Card.Body>
                            </div>
                        </Col>
                        <Col lg={4} md={6}>
                            <div className="taxes-data-card">
                                <Card.Body className="taxes-card-inner-body">
                                    <Card.Title className="taxes-card-heading">Fewer Mistakes</Card.Title>
                                    <Card.Text className="taxes-card-description">
                                        Automatic calculations help prevent errors in your Self Assessment.
                                    </Card.Text>
                                    <div className="taxes-percentage-group">
                                        <span className="taxes-percentage-value">-90%</span>
                                        <FaArrowDown className="taxes-down-arrow-icon" />
                                    </div>
                                </Card.Body>
                            </div>
                        </Col>
                        <Col lg={4} md={6}>
                            <div className="taxes-data-card">
                                <Card.Body className="taxes-card-inner-body">
                                    <Card.Title className="taxes-card-heading">Faster Tax Submission</Card.Title>
                                    <Card.Text className="taxes-card-description">
                                        Submit directly to HMRC in minutes.
                                    </Card.Text>
                                    <div className="taxes-percentage-group">
                                        <span className="taxes-percentage-value">-70%</span>
                                        <FaArrowDown className="taxes-down-arrow-icon" />
                                    </div>
                                </Card.Body>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <section className="blog-sec ptb-80">
                <Container>
                    <div className="common-title mb-5">
                        <h2><span>Guides</span> to help you with your tax return</h2>
                        <p>Simple articles to help you understand tax, deadlines, and MTD.</p>
                    </div>
                    <Row>
                        {loadingBlogs ? (
                            <Col className="text-center py-5">
                                <Spinner animation="border" variant="success" />
                            </Col>
                        ) : blogs.length > 0 ? (
                            blogs.map((blog, idx) => (
                                <Col lg={4} className="mb-4" key={blog.id || idx}>
                                    <div className="blog-card">
                                        <Link href={blog.slug ? `/blogs/${blog.slug}` : "/blog-details"}>
                                            <div className="blog-img">
                                                <img src={blog.featuredImage || `/images/blog_${(idx % 3) + 1}.png`} alt={blog.title || "img"} />
                                            </div>
                                            <div className="blog-card-content mt-3">
                                                <h4>{blog.title}</h4>
                                                <p>{(() => {
                                                    const wordCount = (blog.excerpt || "").split(/\s+/).filter(Boolean).length;
                                                    return Math.max(1, Math.ceil(wordCount / 200));
                                                })()} min read</p>
                                            </div>
                                        </Link>
                                    </div>
                                </Col>
                            ))
                        ) : (
                            <Col className="text-center py-5">
                                <p>No articles available yet.</p>
                            </Col>
                        )}
                    </Row>

                    {totalBlogs > 3 && (
                        <div className="blog-btn mt-4 text-center">
                            <Link href="/blogs" className="common-btn text-capitalize d-inline-block">see more <span> <GoArrowUpRight /></span></Link>
                        </div>
                    )}
                </Container>
            </section>

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
