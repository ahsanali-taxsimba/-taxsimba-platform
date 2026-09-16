"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { MdCheckCircle, MdOutlineCheckCircle } from "react-icons/md";
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { TranslatedHeading, TranslatedParagraph } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import { FaChevronRight, FaStar, FaQuoteLeft } from 'react-icons/fa';
import { motion, AnimatePresence } from "framer-motion";
import { Check, ShieldCheck, Users, Lock, Calendar, ArrowRight, Star, Award, Shield } from "lucide-react";
import toast from 'react-hot-toast';
import { getCurrencySymbol } from '@/utils/commonHelper';
import MtdPricingSection from '@/components/MtdPricingSection';

const PlanCard = ({ plan, onSelect, currentPlanId, currentPlanStatus, currentPlanEndDate }) => {
    const isCurrentPlan = currentPlanId === plan.id;
    const isCanceled = isCurrentPlan && currentPlanStatus?.toLowerCase() === 'canceled';
    const getRemainingDays = (dateStr) => {
        if (!dateStr) return 0;
        const diff = new Date(dateStr) - new Date();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };
    const remainingDays = getRemainingDays(currentPlanEndDate);
    const isExpired = isCurrentPlan && currentPlanStatus?.toLowerCase() === 'expired';

    return (
        <Col lg={4} md={6} sm={12} className="mb-4">
            <div
                className={`${plan.isPopular
                    ? "popular-card home-plan-card plan-card-white"
                    : "home-plan-card plan-card-white"
                    } ${isCurrentPlan && !isExpired ? "active-plan-border" : ""} position-relative`}
            >
                {isCurrentPlan && (
                    <div className="current-plan-ribbon-wrapper">
                        <div className={`current-plan-ribbon ${(isCanceled || isExpired) ? 'bg-danger text-white border-danger' : ''}`}>
                            {isCanceled ? 'Canceled Plan' : isExpired ? 'Expired Plan' : 'Current Plan'}
                        </div>
                    </div>
                )}
                <div className="plan-card-header">
                    <h4 className="plan-name-main text-capitalize d-flex align-items-center gap-2 flex-wrap text-dark">
                        {plan.name}
                    </h4>
                    {plan.isPopular && (
                        <div className="popular-badge-simple">
                            <FaStar size={11} /> Most Popular
                        </div>
                    )}
                    <div className="price-row">
                        {plan.originalPrice && (
                            <del className="price-old">
                                {getCurrencySymbol(plan.currency)}{plan.originalPrice}
                            </del>
                        )}
                        <span className="price-new">
                            {getCurrencySymbol(plan.currency)}{plan.price}
                        </span>
                        {plan.savePercentage > 0 && (
                            <span className="save-badge-green">
                                Save {plan.savePercentage}%
                            </span>
                        )}
                    </div>
                    <p className="plan-desc-text text-muted">
                        {plan.description || "Perfect for individuals and businesses."}
                    </p>
                </div>

                <ul className="plan-feature-list-modern">
                    {Array.isArray(plan.features) && plan.features.map((feature, idx) => (
                        <li key={idx}>
                            <MdCheckCircle className="check-icon-modern" />
                            <span className="text-dark-50">{feature}</span>
                        </li>
                    ))}
                </ul>

                <div className="plan-card-action">
                    <button
                        className={isCanceled ? "select-plan-button-modern" : (isCurrentPlan && !isExpired ? "btn btn-outline-success w-100 bg-white text-success border-success" : "select-plan-button-modern")}
                        style={{
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            borderRadius: '12px'
                        }}
                        onClick={() => onSelect(plan.id, isExpired, isCanceled)}
                    >
                        {isCanceled ? <><TranslatedText>Buy Again</TranslatedText> {remainingDays > 0 ? `(${remainingDays} Days Left)` : ""} <FaChevronRight className="chevron-icon" /></> : isCurrentPlan && !isExpired ? <>Cancel Subscription</> : <><TranslatedText>{isExpired ? 'Renew Plan' : 'Select Plan'}</TranslatedText> <FaChevronRight className="chevron-icon" /></>}
                    </button>
                </div>
            </div>
        </Col>
    );
};

const PlanListContent = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPlanId, setCurrentPlanId] = useState(null);

    const [currentPlanStatus, setCurrentPlanStatus] = useState(null);
    const [currentPlanEndDate, setCurrentPlanEndDate] = useState(null);

    useEffect(() => {
        const fetchCurrentPlan = async () => {
            if (status === "authenticated" && session?.accessToken) {
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                    const response = await axios.post(`${apiUrl}auth/get-account-details`, {}, {
                        headers: { Authorization: `Bearer ${session.accessToken}` }
                    });
                    if (response.data?.data?.subscription) {
                        setCurrentPlanId(response.data.data.subscription.planId);
                        setCurrentPlanStatus(response.data.data.subscription.status);
                        setCurrentPlanEndDate(response.data.data.subscription.endDate);
                        // setCurrentPlanStatus(response.data.data.isSubscriptionBuy ? response.data.data.subscription.status : 'expired');
                    }
                } catch (error) {
                    console.error("Error fetching account details:", error);
                }
            }
        };
        const fetchPlans = async () => {
            try {
                const queryRole = searchParams.get('role');
                const userRole = session?.user?.userRole || session?.user?.role || queryRole;
                const category = userRole === 'MTD' ? 'mtd' : 'taxSimba';
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                const response = await axios.get(`${apiUrl}subscription-plans?category=${category}`);
                if (response.data && Array.isArray(response.data.data)) {
                    setSubscriptionPlans(response.data.data);
                } else {
                    setError("No plans found at the moment.");
                }
            } catch (err) {
                console.error("Error fetching plans:", err);
                setError("Unable to connect to service. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        if (status !== 'loading') {
            fetchPlans();
            fetchCurrentPlan();
        }
    }, [session, status]);

    const isMTD = searchParams.get('role') === 'MTD' || session?.user?.userRole === 'MTD' || session?.user?.role === 'MTD';

    const handleSelectPlan = (planId, isExpired = false, isCanceled = false) => {
        if (!session?.accessToken) {
            toast.error("Please log in to select a plan.");
            const queryRole = searchParams.get('role') || 'TAXSIMBA';
            router.push(`/register?role=${queryRole}`);
            return;
        }
        if (currentPlanId === planId && !isExpired && !isCanceled) {
            if (isMTD) {
                router.push(`/mtd-dashboard?tab=subscriptions`);
            } else {
                router.push(`/dashboard/my-subscriptions`);
            }
        } else {
            router.push(`/planlist/${planId}`);
        }
    };



    if (isMTD && !loading) {
        return (
            <div className="plan-list-modern-wrapper">
                <section id="pricing-section" className="mtd-luxury-section ptb-80 position-relative overflow-hidden">
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
                            <div className="d-inline-flex align-items-center gap-2 section-header-badge mb-3 px-3 pill text-white" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '5px 15px', fontSize: '12px' }}>
                                <span className="pulsing-dot" style={{ width: '8px', height: '8px', background: '#37a267', borderRadius: '50%' }}></span>
                                MAKING TAX DIGITAL EXPERTS
                            </div>
                            <h1 className="fw-bold mb-3 display-4 text-white">
                                Stay HMRC Compliant <br />
                                <span className="text-lt-theme text-glow" style={{ color: '#b3ed97' }}>Without The Stress</span>
                            </h1>
                            <p className="opacity-75 mx-auto mb-4 text-white" style={{ maxWidth: '650px', fontSize: '18px', lineHeight: '1.6' }}>
                                Choose the plan that fits your business needs and let our experts handle the rest.
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
                                        <Check size={18} className="text-lt-theme" style={{ color: '#b3ed97' }} /> {text}
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
                            <MtdPricingSection 
                                subscriptionPlans={subscriptionPlans}
                                currentPlanId={currentPlanId}
                                currentPlanStatus={currentPlanStatus}
                                currentPlanEndDate={currentPlanEndDate}
                                onSelectPlan={handleSelectPlan}
                                isExpired={currentPlanStatus?.toLowerCase() === 'expired'}
                                isCanceled={currentPlanStatus?.toLowerCase() === 'canceled'}
                            />
                        </motion.div>
                    </Container>

                    {/* Footer Bar */}
                    <div className="glass-footer mt-5 p-4" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <Container>
                            <div className="d-flex flex-wrap justify-content-center gap-md-5 gap-3 opacity-60 extra-small text-white">
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
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="plan-list-modern-wrapper">
            <section className="plan-hero-modern">
                <Container>
                    <div className="hero-text-center text-center">
                        <TranslatedHeading className="hero-main-title">
                            Find The Right Package <span>For Your Tax Return</span>
                        </TranslatedHeading>
                        <TranslatedParagraph className="hero-sub-text">
                            Built for landlords, sole traders, and those with multiple income streams.
                        </TranslatedParagraph>
                    </div>

                    <div className="plans-display-section mt-5">
                        <Row className="justify-content-center">
                            {loading ? (
                                <Col xs={12} className="text-center py-5">
                                    <div className="loading-state-modern">
                                        <Spinner animation="border" variant="light" />
                                        <p className="mt-3 text-white-50"><TranslatedText>Loading your options...</TranslatedText></p>
                                    </div>
                                </Col>
                            ) : error ? (
                                <Col lg={6} className="text-center py-5">
                                    <div className="error-card-modern">
                                        <h4 className="text-white">Something went wrong</h4>
                                        <p className="text-white-50">{error}</p>
                                        <button onClick={() => window.location.reload()} className="retry-btn-modern">Try Again</button>
                                    </div>
                                </Col>
                            ) : (
                                subscriptionPlans.map((plan) => (
                                    <PlanCard key={plan.id} plan={plan} onSelect={handleSelectPlan} currentPlanId={currentPlanId} currentPlanStatus={currentPlanStatus} currentPlanEndDate={currentPlanEndDate} />
                                ))
                            )}
                        </Row>
                    </div>
                </Container>
            </section>

            <section className="cta-bottom-modern">
                <Container>
                    <div className="cta-content-center text-center">
                        <h2 className="cta-title">Share Your Details. Choose Your Plan.</h2>
                        <h3 className="cta-subtitle">Connect With Your Dedicated Accountant.</h3>
                    </div>
                </Container>
            </section>

            <style jsx>{`
                .plan-list-modern-wrapper {
                    background: #001a12;
                    min-height: 100vh;
                    font-family: Geist,sans-serif !important;
                }
                .plan-hero-modern {
                    padding: 80px 0 0 0;
                    background: linear-gradient(180deg, #002117 0%, #001a12 100%);
                    font-family: Geist,sans-serif !important;
                }
                :global(.hero-main-title) {
                    font-size: 40px !important;
                    font-weight: 800 !important;
                    // color: #14ab71 !important;
                    color: #b3ed97 !important;
                    margin-bottom: 20px !important;
                    line-height: 1.2 !important;
                    letter-spacing: -.5px;
                    font-family: Geist,sans-serif !important;
                }
                :global(.hero-main-title span) {
                    color: #ffffff !important;
                    opacity: 1;
                }
                :global(.hero-sub-text) {
                    font-size: 1.2rem !important;
                    color: rgba(255, 255, 255, 0.8) !important;
                    max-width: 800px;
                    margin: 0 auto !important;
                    font-weight: 500;
                    font-family: Geist,sans-serif;
                }
                :global(.plan-card-white) {
                    background: #ffffff;
                    border-radius: 24px;
                    padding: 40px 30px;
                    height: 100%;
                    box-shadow: 0 15px 45px rgba(0, 0, 0, 0.2);
                    display: flex;
                    flex-direction: column;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                :global(.plan-card-white:hover) {
                    transform: translateY(-10px);
                    box-shadow: 0 20px 55px rgba(0, 0, 0, 0.3);
                }
                :global(.plan-name-main) {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: #000000;
                    margin-bottom: 20px;
                }
                :global(.price-row) {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 20px;
                    flex-wrap: nowrap;
                    white-space: nowrap;
                }
                :global(.price-old) {
                    font-size: 1.4rem;
                    color: #999999;
                    text-decoration: line-through;
                    font-weight: 500;
                }
                :global(.price-new) {
                    font-size: 2.4rem;
                    color: #14ab71;
                    font-weight: 800;
                    display: flex;
                    align-items: baseline;
                }
                :global(.price-suffix) {
                    font-size: 1.4rem;
                    font-weight: 600;
                }
                :global(.save-badge-green) {
                    background: #effaf5;
                    color: #14ab71;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    border: 1px solid rgba(20, 171, 113, 0.2);
                }
                :global(.plan-desc-text) {
                    font-size: 1rem;
                    color: #555555;
                    margin-bottom: 20px;
                    line-height: 1.5;
                    min-height: 0;
                }
                :global(.plan-feature-list-modern) {
                    list-style: none;
                    padding: 0;
                    margin: 0 0 10px 0;
                    flex-grow: 1;
                }
                :global(.plan-feature-list-modern li) {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 18px;
                    font-size: 1rem;
                    color: #333333;
                    font-weight: 500;
                }
                :global(.check-icon-modern) {
                    color: #14ab71;
                    font-size: 1.4rem;
                    margin-top: 2px;
                    flex-shrink: 0;
                }
                :global(.select-plan-button-modern) {
                    background: #14ab71 !important;
                    color: #ffffff !important;
                    text-decoration: none !important;
                    padding: 14px 20px !important;
                    border-radius: 12px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-weight: 700 !important;
                    font-size: 1rem !important;
                    width: 100% !important;
                    transition: all 0.3s ease !important;
                    border: none !important;
                }
                :global(.select-plan-button-modern:hover) {
                    background: #119361 !important;
                    transform: scale(1.02);
                }
                :global(.chevron-icon) {
                    margin-left: 8px;
                    font-size: 0.8rem;
                }
                .cta-bottom-modern {
                    background: #002117;
                    padding: 80px 0;
                }
                .cta-title {
                    font-size: 2.5rem;
                    font-weight: 800;
                    color: #ffffff;
                    margin-bottom: 10px;
                }
                .cta-subtitle {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #ffffff;
                    opacity: 0.9;
                }
                :global(.retry-btn-modern) {
                    background: white;
                    color: #002117;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 600;
                    margin-top: 15px;
                }
                @media (max-width: 1200px) {
                    :global(.plan-name-main) { font-size: 1.4rem; }
                    :global(.price-new) { font-size: 1.8rem; }
                }
                @media (max-width: 768px) {
                    :global(.hero-main-title) {
                        font-size: 2.2rem !important;
                    }
                    :global(.plan-card-white) {
                        padding: 25px;
                        margin-bottom: 20px;
                    }
                    .cta-title { font-size: 1.8rem; }
                    .cta-subtitle { font-size: 1.5rem; }
                }
            `}</style>
        </div>
    );
};

const PlanListPage = () => (
    <Suspense fallback={<div className="text-center py-5 text-white">Loading...</div>}>
        <PlanListContent />
    </Suspense>
);

export default PlanListPage;
