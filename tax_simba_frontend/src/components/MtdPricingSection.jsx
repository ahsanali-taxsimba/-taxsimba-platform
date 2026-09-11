"use client";
import React, { useState, useEffect } from 'react';
import { Row, Col } from 'react-bootstrap';
import { Check, Shield, Star, Crown, ShieldCheck, User, Headphones, Lock, ArrowRight, X, TrendingUp, Settings, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { getCurrencySymbol } from '@/utils/commonHelper';
import { FaRegCheckCircle, FaCheckCircle, FaTimes } from "react-icons/fa";

const categories = [
    {
        name: "SOFTWARE & SETUP",
        icon: Settings,
        rows: [
            { label: "Xero Subscription Included", key: "xero" },
            { label: "MTD Registration with HMRC", key: "mtd_updates" },
            { label: "Setup & Onboarding Support", key: "setup" },
            { label: "Secure Digital Document Exchange", key: "doc_exchange" },
            { label: "Automated Tax Deadline Reminders", key: "reminders" }
        ]
    },
    {
        name: "SUPPORT & ADVICE",
        icon: Headphones,
        rows: [
            { label: "Dedicated Accountant Support", key: "accountant" },
            { label: "Support Channels Available", key: "support" },
            { label: "Proactive Tax Planning", key: "tax_planning" },
            { label: "Financial & Performance Reviews", key: "reviews" }
        ]
    },
    {
        name: "TAX & COMPLIANCE",
        icon: FileText,
        rows: [
            { label: "Quarterly MTD Updates Submitted", key: "mtd_updates" },
            { label: "Final Declaration Submission", key: "final_declaration" },
            { label: "Self-Assessment Tax Return Preparation", key: "tax_return" },
            { label: "VAT Return Preparation & Submission", key: "vat_return" },
            { label: "CIS Return Preparation (up to 2 subs)", key: "CIS" },
            { label: "Payroll Processing (up to 2 employees)", key: "payroll" }
        ]
    },
    {
        name: "KEY BENEFITS",
        icon: ShieldCheck,
        rows: [
            { label: "Avoid HMRC Penalties & Missed Deadlines", key: "penalties" },
            { label: "Expert Guidance When Required", key: "expert_guidance" },
            { label: "Peace of Mind", key: "peace_of_mind" },
            { label: "Reduced Administrative Burden", key: "admin_burden" }
        ]
    }
];

const getCellValue = (plan, rowKey) => {
    const features = plan?.features || [];
    const idealFor = plan?.idealFor || [];
    const benefits = plan?.benefits || [];
    const allItems = [...features, ...idealFor, ...benefits].map(x => x.toLowerCase());

    switch (rowKey) {
        case 'xero':
            if (allItems.some(x => x.includes('xero starter'))) return 'Xero Starter';
            if (allItems.some(x => x.includes('xero standard'))) return 'Xero Standard';
            if (allItems.some(x => x.includes('xero premium'))) return 'Xero Premium';
            return 'Not Included';
        case 'setup':
            return allItems.some(x => x.includes('onboarding') || x.includes('setup'));
        case 'accountant':
            if (allItems.some(x => x.includes('priority accountant'))) return 'Priority Support';
            if (allItems.some(x => x.includes('service response guarantee') || x.includes('dedicated accountant'))) return 'Dedicated Accountant';
            if (allItems.some(x => x.includes('accountant support via email'))) return 'Email Support';
            return 'Not Included';
        case 'support':
            if (plan?.name?.toLowerCase().includes('elite') || allItems.some(x => x.includes('priority accountant'))) return 'Priority Phone & Email';
            if (allItems.some(x => x.includes('telephone') || x.includes('phone') || x.includes('phone and email'))) return 'Phone & Email';
            if (allItems.some(x => x.includes('support via email'))) return 'Email Only';
            return 'Email Only'; // fallback
        case 'reviews':
            if (allItems.some(x => x.includes('performance reviews'))) return 'Quarterly Business Reviews';
            if (allItems.some(x => x.includes('financial health reviews'))) return 'Quarterly Health Reviews';
            return false;
        case 'CIS':
            return allItems.some(x => x.includes('cis return') || x.includes('subcontractors'));
        case 'payroll':
            return allItems.some(x => x.includes('payroll') || x.includes('employees'));
        case 'tax_planning':
            return allItems.some(x => x.includes('tax planning') || x.includes('tax-saving'));
        case 'tax_return':
            return allItems.some(x => x.includes('self-assessment') || x.includes('self-employed accounts'));
        case 'vat_return':
            return allItems.some(x => x.includes('vat return'));
        case 'mtd_updates':
            return allItems.some(x => x.includes('mtd updates') || x.includes('mtd registration') || x.includes('quarterly mtd updates'));
        case 'final_declaration':
            return allItems.some(x => x.includes('final declaration'));
        case 'reminders':
            return allItems.some(x => x.includes('reminders'));
        case 'doc_exchange':
            return allItems.some(x => x.includes('document exchange'));
        case 'penalties':
            return allItems.some(x => x.includes('penalties'));
        case 'expert_guidance':
            return allItems.some(x => x.includes('expert guidance') || x.includes('dedicated accountant') || x.includes('priority accountant'));
        case 'peace_of_mind':
            return allItems.some(x => x.includes('peace of mind'));
        case 'admin_burden':
            return allItems.some(x => x.includes('administrative burden'));
        default:
            return allItems.some(x => x.includes(rowKey.toLowerCase()));
    }
};

const getCellValueWithInheritance = (sortedPlans, planIdx, rowKey) => {
    const currentPlan = sortedPlans[planIdx];
    let value = getCellValue(currentPlan, rowKey);

    // If the value is a string, or is already true, return it
    if (typeof value === 'string' || value === true) {
        return value;
    }

    // If it is false (or not explicitly found), check if any lower-priced plan has it as true.
    // Since sortedPlans is ordered Comply (0) -> Growth (1) -> Elite (2),
    // higher plans inherit boolean features from lower plans.
    for (let i = 0; i < planIdx; i++) {
        const lowerVal = getCellValue(sortedPlans[i], rowKey);
        if (lowerVal === true) {
            return true;
        }
    }

    return false;
};

const MtdPricingSection = ({
    subscriptionPlans = [],
    currentPlanId,
    currentPlanStatus,
    currentPlanEndDate,
    onSelectPlan,
    isExpired = false,
    isCanceled = false
}) => {
    // Local state to track which plan is currently selected in the UI
    const [selectedPlanId, setSelectedPlanId] = useState(currentPlanId);

    // Initialize selection when plans load
    useEffect(() => {
        if (!selectedPlanId && subscriptionPlans.length > 0) {
            setSelectedPlanId(currentPlanId || subscriptionPlans[1]?.id || subscriptionPlans[0]?.id);
        }
    }, [subscriptionPlans, currentPlanId, selectedPlanId]);

    // Shared fallback features
    const fallbackFeatures = [
        "Quarterly submissions",
        "Dedicated accountant support",
        "Xero included",
        "HMRC registration support"
    ];

    const [expandedCategories, setExpandedCategories] = useState({});
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // On mobile, keep track of which are expanded. On desktop, they are all visible by CSS.
    const toggleCategory = (catIdx) => {
        setExpandedCategories(prev => ({
            ...prev,
            [catIdx]: !prev[catIdx]
        }));
    };

    if (!subscriptionPlans || subscriptionPlans.length === 0) {
        return (
            <div className="text-center py-5">
                <p className="text-muted fs-5">No MTD subscription plans found at the moment.</p>
            </div>
        );
    }

    const checkIsPopular = (p) => p.isPopular == 1 || p.isPopular === true || p.isPopular === '1' || p.isPopular === 'true';
    const hasExplicitPopular = subscriptionPlans.some(checkIsPopular);
    const sortedPlans = [...subscriptionPlans].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    return (
        <div className="mtd-pricing-section-wrapper py-4">
            <div className="mtd-pricing-container">
                {sortedPlans.map((plan, idx) => {
                    // Determine highlighting
                    const isPopular = hasExplicitPopular
                        ? checkIsPopular(plan)
                        : (idx === 1);

                    // Icons based on index
                    let IconComponent = Shield;
                    let iconClass = "comply";
                    if (idx === 1) {
                        IconComponent = Star;
                        iconClass = "growth";
                    } else if (idx >= 2) {
                        IconComponent = Crown;
                        iconClass = "elite";
                    }

                    // Plan features
                    const displayFeatures = (Array.isArray(plan.features) && plan.features.length > 0)
                        ? plan.features
                        : fallbackFeatures;

                    // CTA Button text logic (matches existing functionality)
                    const isCurrent = currentPlanId === plan.id;
                    let btnText = "Get Started";
                    if (isCurrent) {
                        btnText = isCanceled ? "Buy Again" : (!isExpired ? "Manage Subscription" : "Get Started");
                    }

                    return (
                        <div key={plan.id} className={`mtd-pricing-card ${isPopular ? 'popular' : ''} ${isCurrent ? 'active-plan-border' : ''}`}>
                            {isCurrent && (
                                <div className="current-plan-ribbon-wrapper">
                                    <div className="current-plan-ribbon">Current Plan</div>
                                </div>
                            )}

                            {isPopular && (
                                <div className="mtd-popular-banner">
                                    MOST POPULAR <Star size={12} fill="currentColor" />
                                </div>
                            )}

                            <div className={`mtd-plan-icon ${iconClass}`}>
                                <IconComponent size={32} />
                            </div>

                            <h3 className="mtd-pricing-name text-capitalize">{plan.name}</h3>

                            <div className={`mtd-pricing-price-box ${idx >= 2 ? 'elite-price' : ''}`}>
                                <span className="mtd-pricing-currency">{getCurrencySymbol(plan.currency)}</span>
                                <span className="mtd-pricing-price">{plan.price}</span>
                            </div>

                            <div className="mtd-pricing-interval">+ VAT / {plan.interval === 'year' ? 'year' : 'month'}</div>

                            {plan.description && (
                                <p className="mtd-plan-description">{plan.description}</p>
                            )}

                            <hr className="mtd-pricing-divider" />

                            <div className="mtd-pricing-group-title">Included:</div>
                            <ul className="mtd-pricing-features">
                                {displayFeatures.map((feature, fIdx) => (
                                    <li key={fIdx}>
                                        <div className="mtd-feature-check">
                                            <FaRegCheckCircle />
                                        </div>
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {onSelectPlan && (
                                <div className="mtd-pricing-btn-wrapper">
                                    <button
                                        className="mtd-pricing-btn"
                                        onClick={() => onSelectPlan(plan.id, isExpired, isCanceled)}
                                    >
                                        {btnText} <ArrowRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Package Comparison Table Section */}
            <div className="mtd-comparison-section mt-5">
                <div className="mtd-comparison-header text-center mb-4">
                    <h2 className="mtd-comparison-title">Compare Plan Details</h2>
                    <p className="mtd-comparison-subtitle">A side-by-side comparison of MTD features & benefits to help you choose the right plan</p>
                </div>

                {/* Mini Cards Section */}
                <div className="mtd-mini-cards-container mb-4">
                    <Row className="g-3 justify-content-center">
                        {sortedPlans.map((plan, idx) => {
                            const isPopular = hasExplicitPopular ? checkIsPopular(plan) : (idx === 1);
                            
                            // Icons and short text based on index
                            let IconComponent = User;
                            let iconClass = "comply";
                            let shortText = "Great for sole traders getting started with MTD";
                            
                            if (idx === 1) {
                                IconComponent = TrendingUp;
                                iconClass = "growth";
                                shortText = "Perfect for growing businesses needing more support & insights";
                            } else if (idx >= 2) {
                                IconComponent = Crown;
                                iconClass = "elite";
                                shortText = "Advanced support for established businesses with complex needs";
                            }

                            const isCurrent = currentPlanId === plan.id;
                            let btnText = "Get Started";
                            if (isCurrent) {
                                btnText = isCanceled ? "Buy Again" : (!isExpired ? "Manage" : "Get Started");
                            }

                            return (
                                <Col lg={4} md={6} key={`mini-${plan.id}`}>
                                    <div className={`mtd-mini-card ${isPopular ? 'popular' : ''}`}>
                                        {isPopular && (
                                            <div className="mtd-popular-banner">
                                                MOST POPULAR <Star size={12} fill="currentColor" />
                                            </div>
                                        )}
                                        <div className="mtd-mini-card-header text-center pt-2">
                                            <h3 className="mtd-mini-name">{plan.name}</h3>
                                            <div className="mtd-mini-price-box">
                                                <span className="mtd-mini-currency">{getCurrencySymbol(plan.currency)}</span>
                                                <span className="mtd-mini-price">{plan.price}</span>
                                            </div>
                                            <div className="mtd-mini-interval">+ VAT / Month</div>
                                        </div>
                                        
                                        <hr className="mtd-mini-divider" />
                                        
                                        <div className="mtd-mini-desc-flex">
                                            <div className={`mtd-mini-icon-circle ${iconClass}`}>
                                                <IconComponent size={24} />
                                            </div>
                                            <p className="mtd-mini-desc-text">{shortText}</p>
                                        </div>
                                        
                                        <div className="mtd-mini-btn-wrapper mt-3 text-center">
                                            {onSelectPlan ? (
                                                <button
                                                    className={`mtd-table-btn w-100 ${isPopular ? 'popular' : ''} ${isCurrent ? 'active-plan' : ''}`}
                                                    onClick={() => onSelectPlan(plan.id, isExpired, isCanceled)}
                                                >
                                                    {btnText}
                                                </button>
                                            ) : (
                                                <button className={`mtd-table-btn w-100 ${isPopular ? 'popular' : ''} ${isCurrent ? 'active-plan' : ''}`}>
                                                    {btnText}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </Col>
                            );
                        })}
                    </Row>
                </div>
                <div className="mtd-comparison-bottom-card">
                    <h2 className="mtd-mobile-features-title d-block d-md-none text-center">Compare Features</h2>

                    <div className="mtd-comparison-table-wrapper">
                    <table className="mtd-comparison-table">
                        <thead className="mtd-desktop-header">
                            {/* Plan name row */}
                            <tr className="plan-info-row">
                                <th className="feature-col">Features</th>
                                {sortedPlans.map((plan, pIdx) => {
                                    return (
                                        <th key={plan.id} className="plan-col text-center">
                                            <div className="plan-header-cell">
                                                <span className="plan-name-txt">{plan.name}</span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category, catIdx) => (
                                <React.Fragment key={catIdx}>
                                    <tr 
                                        className="category-header-row"
                                        onClick={() => toggleCategory(catIdx)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td colSpan={sortedPlans.length + 1}>
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-2">
                                                    {category.icon && <category.icon size={18} className="mtd-category-icon" />}
                                                    <span>{category.name}</span>
                                                </div>
                                                <div className="d-block d-md-none mtd-accordion-icon">
                                                    {expandedCategories[catIdx] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    {isMobile && expandedCategories[catIdx] && (
                                        <tr className="mobile-table-header-row d-md-none">
                                            <th className="feature-col">Features</th>
                                            {sortedPlans.map((plan, pIdx) => {
                                                const isPopular = hasExplicitPopular ? checkIsPopular(plan) : (pIdx === 1);
                                                return (
                                                    <th key={`mobile-head-${plan.id}`} className={`plan-col text-center ${isPopular ? 'popular-col' : ''}`}>
                                                        <span className="plan-name-txt">{plan.name.replace('Simbian ', '')}</span>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    )}
                                    {category.rows.map((row, rowIdx) => {
                                        const isVisible = !isMobile || expandedCategories[catIdx];
                                        return (
                                            <tr key={rowIdx} className={`feature-row ${isVisible ? '' : 'd-none'}`}>
                                                <td className="feature-name">{row.label}</td>
                                                {sortedPlans.map((plan, pIdx) => {
                                                    const value = getCellValueWithInheritance(sortedPlans, pIdx, row.key);
                                                    const isPopular = hasExplicitPopular ? checkIsPopular(plan) : (pIdx === 1);
                                                    return (
                                                        <td key={plan.id} className={`value-cell ${isPopular ? 'popular-col' : ''}`}>
                                                            {typeof value === 'boolean' ? (
                                                                value ? (
                                                                    <FaCheckCircle className="mtd-check-icon-table" />
                                                                ) : (
                                                                    <X className="mtd-cross-icon-table" size={20} />
                                                                )
                                                            ) : (
                                                                <span className="text-val">{value}</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>

                    </table>
                </div>

                {/* Bottom Trust Badges inside the white card */}
                <div className="mtd-trust-badges mtd-badges-bottom">
                    <div className="mtd-trust-badge">
                        <ShieldCheck className="mtd-trust-icon" size={24} />
                        <span className="mtd-trust-text">HMRC <br className='d-md-block d-none' />Compliant</span>
                    </div>
                    <div className="mtd-trust-badge">
                        <User className="mtd-trust-icon" size={24} />
                        <span className="mtd-trust-text">Expert <br className='d-md-block d-none' />Accountants</span>
                    </div>
                    <div className="mtd-trust-badge">
                        <Headphones className="mtd-trust-icon" size={24} />
                        <span className="mtd-trust-text">Unlimited <br className='d-md-block d-none' />Support</span>
                    </div>
                    <div className="mtd-trust-badge">
                        <Lock className="mtd-trust-icon" size={24} />
                        <span className="mtd-trust-text">Secure <br className='d-md-block d-none' />& Private</span>
                    </div>
                </div>
            </div>
        </div>


        </div>
    );
};

export default MtdPricingSection;
