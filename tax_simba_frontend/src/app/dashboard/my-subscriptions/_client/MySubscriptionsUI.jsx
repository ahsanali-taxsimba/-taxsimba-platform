"use client";
import { Spinner, Row, Col, Alert } from "react-bootstrap";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { getCurrencySymbol } from "@/utils/commonHelper";
import { logClientAction } from "@/utils/auditLogger";
import {
    addSecondServiceLabel,
    addSecondServicePath,
    upgradeCataloguePath,
} from "@/lib/catalogueJourney";
import AddSecondServiceBanner from "@/components/AddSecondServiceBanner";

export default function MySubscriptionsUI({ userData, confirmData, allPlans = [], loading, sessionData }) {
    const router = useRouter();
    const pathname = usePathname();
    const [canceling, setCanceling] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);
    const [upgradeLockReason, setUpgradeLockReason] = useState(null);

    useEffect(() => {
        const token = sessionData?.accessToken;
        if (!token) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/";
        axios
            .get(`${apiUrl}client/subscription/upgrade-options`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            .then((res) => {
                const data = res.data?.data || res.data || {};
                if (data.locked) {
                    setUpgradeLockReason(
                        data.lockReason ||
                            data.lock_reason ||
                            "Package changes are locked at this stage of your return",
                    );
                } else {
                    setUpgradeLockReason(null);
                }
            })
            .catch(() => {
                /* non-fatal — keep upgrade CTA available */
            });
    }, [sessionData?.accessToken]);

    const handleBillingPortal = async () => {
        setPortalLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
            const response = await axios.post(`${apiUrl}client/subscription/portal`, {}, {
                headers: { Authorization: `Bearer ${sessionData.accessToken}` }
            });

            const portalUrl =
                response.data?.data?.url ||
                response.data?.data?.portalUrl ||
                response.data?.data?.portal_url;
            if (portalUrl) {
                await logClientAction(
                    sessionData.accessToken,
                    "VIEW_STRIPE_BILLING_PORTAL",
                    "BILLING",
                    { hasUrl: true }
                );
                window.location.href = portalUrl;
            } else {
                toast.error("Failed to load billing portal link.");
            }
        } catch (err) {
            toast.error(
                err?.response?.data?.detail ||
                    err?.response?.data?.message ||
                    "Failed to redirect to Stripe Billing Portal.",
            );
        } finally {
            setPortalLoading(false);
        }
    };

    const handleCancel = async (subId) => {
        const result = await Swal.fire({
            title: 'Manage cancellation?',
            text: "Recurring MTD billing is cancelled through the secure Stripe Billing Portal so your SA entitlement is not affected.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#14ab71',
            cancelButtonColor: '#dc3545',
            confirmButtonText: 'Open billing portal',
            cancelButtonText: 'Back',
            borderRadius: '15px',
            customClass: {
                popup: 'premium-swal-popup',
                title: 'premium-swal-title',
                confirmButton: 'premium-swal-confirm'
            }
        });

        if (!result.isConfirmed) return;

        setCanceling(true);
        try {
            await logClientAction(
                sessionData.accessToken,
                "CLICK_CANCEL_SUBSCRIPTION",
                "BILLING",
                { subscriptionId: subId, via: "billing_portal" }
            );
            await handleBillingPortal();
        } finally {
            setCanceling(false);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center py-5">
                <Spinner animation="border" variant="success" />
            </div>
        );
    }

    // Standardized date formatter for MM/DD/YYYY
    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    };

    const formatPaymentMethod = (methodStr) => {
        if (!methodStr) return "Card";
        const str = methodStr.toLowerCase();
        if (str.includes("klarna")) return "Klarna";
        if (str.includes("clearpay") || str.includes("afterpay")) return "Clearpay";
        if (str.includes("google") || str.includes("gpay")) return "Google Pay";
        if (str.includes("apple")) return "Apple Pay";
        if (str.includes("stripe_checkout")) return "Stripe Checkout";
        return "Card";
    };

    // Safely resolve subscription — confirmData from list endpoint may be an array or { subscriptions }
    const activeSubs = Array.isArray(confirmData)
        ? confirmData
        : Array.isArray(confirmData?.subscriptions)
          ? confirmData.subscriptions
          : Array.isArray(userData?.subscriptions)
            ? userData.subscriptions
            : [];
    const onMtdWorkspace = pathname?.startsWith("/mtd-dashboard");
    const matchService = (row) => {
        const t = String(row?.serviceType || row?.service_type || "").toUpperCase();
        return onMtdWorkspace
            ? t.includes("MTD")
            : t.includes("SELF") || t === "SA" || !t;
    };
    const activeSubFromConfirm =
        activeSubs.find(matchService) ||
        activeSubs[0] ||
        confirmData?.subscription ||
        confirmData?.data ||
        confirmData;

    const sub = activeSubFromConfirm || userData?.subscription || userData?.subscriptions?.[0];
    const hasActiveSa = Boolean(
        userData?.hasActiveSa ?? confirmData?.hasActiveSa ?? sessionData?.hasActiveSa ?? sessionData?.user?.hasActiveSa,
    );
    const hasActiveMtd = Boolean(
        userData?.hasActiveMtd ?? confirmData?.hasActiveMtd ?? sessionData?.hasActiveMtd ?? sessionData?.user?.hasActiveMtd,
    );
    const hasActive =
      Boolean(userData?.hasActiveService) ||
      Boolean(confirmData?.hasActiveService) ||
      hasActiveSa ||
      hasActiveMtd ||
      Boolean(sub && (sub.status === 'active' || sub.status === 'ACTIVE'));
    const ownershipSource = { hasActiveSa, hasActiveMtd };
    const secondServiceHref = addSecondServicePath(ownershipSource);
    const secondServiceLabel = addSecondServiceLabel(ownershipSource);
    const upgradeHref = upgradeCataloguePath(pathname, ownershipSource);
    const currentPlan = allPlans.find(plan => plan.id === sub?.planId || plan.id === sub?.plan?.id || plan.code === sub?.packageCode || plan.code === sub?.plan?.code);
    const features = currentPlan?.features || sub?.plan?.features || [];

    return (
        <div className="edt_profile_box">
            <style>{`
                .subscription-detail-item {
                    display: flex;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .subscription-detail-label {
                    font-weight: bold;
                    margin-right: 0.5rem;
                    width: 180px;
                    flex-shrink: 0;
                    color: #333;
                }
                .subscription-actions-wrapper {
                    margin-top: 2.5rem;
                    display: flex;
                    align-items: stretch;
                    gap: 1rem;
                    flex-wrap: nowrap;
                }
                .subscription-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 10px 24px;
                    font-weight: bold;
                    border: none;
                    border-radius: 5px;
                    color: #fff;
                    text-align: center;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
                    transition: all 0.2s ease;
                    white-space: nowrap;
                    min-height: 48px;
                }
                .subscription-btn-primary {
                    background-color: #37a267;
                }
                .subscription-btn-primary:hover {
                    background-color: #2e8a56;
                }
                .subscription-btn-danger {
                    background-color: #dc3545;
                }
                .subscription-btn-danger:hover {
                    background-color: #c82333;
                }
                .subscription-btn-danger:disabled {
                    background-color: #e9ecef;
                    color: #6c757d;
                    cursor: not-allowed;
                    box-shadow: none;
                }

                @media (max-width: 576px) {
                    .subscription-detail-item {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 4px;
                        margin-bottom: 1.25rem;
                    }
                    .subscription-detail-label {
                        width: auto;
                        margin-right: 0;
                    }
                    .subscription-actions-wrapper {
                        flex-direction: column;
                        width: 100%;
                        gap: 12px;
                        margin-top: 2rem;
                    }
                    .subscription-btn {
                        width: 100%;
                        padding: 12px 16px;
                    }
                }
            `}</style>
            <div className="edt_prof_head">
                <h3>Current Subscription</h3>
            </div>

            <div className="profile_details px-4 py-4 mt-3 border rounded bg-white shadow-sm">
                {(hasActiveSa || hasActiveMtd) && (
                    <div
                        className="mb-4 pb-3"
                        data-testid="service-ownership-summary"
                        style={{ borderBottom: "1px solid rgba(13,43,30,0.1)" }}
                    >
                        <div className="small text-muted text-uppercase fw-semibold mb-2" style={{ letterSpacing: "0.04em" }}>
                            Your services
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                            <span
                                className="badge px-3 py-2"
                                style={{ backgroundColor: hasActiveSa ? "#0f8c5a" : "#6c757d" }}
                                data-testid="sa-service-status"
                            >
                                Self Assessment: {hasActiveSa ? "ACTIVE" : "Not active"}
                            </span>
                            <span
                                className="badge px-3 py-2"
                                style={{ backgroundColor: hasActiveMtd ? "#0f8c5a" : "#6c757d" }}
                                data-testid="mtd-service-status"
                            >
                                Making Tax Digital: {hasActiveMtd ? "ACTIVE" : "Not active"}
                            </span>
                        </div>
                    </div>
                )}
                <AddSecondServiceBanner
                    session={sessionData}
                    account={{ hasActiveSa, hasActiveMtd }}
                />
                {!hasActive || !sub ? (
                    <div className="text-center py-4">
                        <h5 className="text-muted mb-4">You do not have an active subscription.</h5>
                        <button
                            className="btn btn-success px-4 py-2"
                            style={{ backgroundColor: '#14ab71', border: 'none' }}
                            onClick={() => router.push('/planlist')}
                        >
                            View Packages
                        </button>
                    </div>
                ) : (
                    <>
                        <Row>
                            {/* Left Details Panel */}
                            <Col lg={6}>
                                <div className="subscription-detail-item">
                                    <span className="subscription-detail-label">Subscription Status:</span>
                                    <span className="badge px-3 py-2 text-capitalize" style={{ backgroundColor: sub.status === 'active' || sub.status === 'ACTIVE' ? '#0f8c5a' : '#c82333' }}>
                                        {sub.status || 'Active'}
                                    </span>
                                </div>
                                <div className="subscription-detail-item">
                                    <span className="subscription-detail-label">Subscription Plan:</span>
                                    <span className="text-muted text-capitalize">{sub.plan?.name || "N/A"} Package</span>
                                </div>
                                <div className="subscription-detail-item">
                                    <span className="subscription-detail-label">Subscription Duration:</span>
                                    <span className="text-muted text-capitalize">{(sub.plan?.interval === 'year' || sub.plan?.name === 'yearly') ? 'Yearly' : 'Monthly'}</span>
                                </div>
                                <div className="subscription-detail-item">
                                    <span className="subscription-detail-label">Subscription Start Date:</span>
                                    <span className="text-muted">{formatDate(sub.startDate)}</span>
                                </div>
                                {sub.plan?.price && (
                                    <div className="subscription-detail-item">
                                        <span className="subscription-detail-label">Plan Price:</span>
                                        <span className="text-muted">{getCurrencySymbol(sub.currency)}{sub.plan.price} / {sub.plan?.interval || (sub.plan?.name === 'yearly' ? 'year' : 'month')}</span>
                                    </div>
                                )}
                                <div className="subscription-detail-item">
                                    <span className="subscription-detail-label">Next Renewal:</span>
                                    <span className="text-muted">{formatDate(sub.endDate)}</span>
                                </div>

                                {sub.status?.toLowerCase() === 'canceled' && (
                                    <div className="subscription-detail-item">
                                        <span className="subscription-detail-label">Expiry Date:</span>
                                        <span className="text-muted">{formatDate(sub.expiryDate)}</span>
                                    </div>
                                )}
                                <div className="subscription-detail-item">
                                    <span className="subscription-detail-label">Renewal Frequency:</span>
                                    <span className="text-muted text-capitalize">{(sub.plan?.interval === 'year' || sub.plan?.name === 'yearly') ? 'Yearly' : 'Monthly'}</span>
                                </div>
                                <div className="subscription-detail-item">
                                    <span className="subscription-detail-label">Payment Method:</span>
                                    <span className="text-muted">{sub.modeOfPayment || formatPaymentMethod(sub.paymentMethod || sub.paymentMethodType || sub.paymentMethodId)}</span>
                                </div>

                            </Col>

                            {/* Right Features Panel */}
                            <Col lg={6}>
                                <div className="ps-lg-5 mt-4 mt-lg-0">
                                    <h6 className="fw-bold mb-3">Features:</h6>
                                    {features && features.length > 0 ? (
                                        <ul className="list-unstyled">
                                            {features.map((feature, idx) => (
                                                <li key={idx} className="mb-2 text-muted" style={{ fontSize: '0.95rem' }}>
                                                    <span className="me-2 text-success">✓</span> {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-muted fst-italic">Standard features included with {sub.plan?.name || 'this'} package.</p>
                                    )}
                                </div>
                            </Col>
                        </Row>

                        {/* P0 K.3: portal/cancel hidden (E9); upgrade + C-004 second-service CTAs */}
                        <div className="subscription-actions-wrapper mt-3">
                            {upgradeLockReason ? (
                                <Alert variant="warning" className="mb-2 w-100" data-testid="upgrade-locked-banner">
                                    {upgradeLockReason}. Package upgrades will reopen when your return is no longer in a late filing stage.
                                </Alert>
                            ) : null}
                            <button
                                className="subscription-btn subscription-btn-primary shadow-sm"
                                data-testid="view-upgrade-options"
                                disabled={Boolean(upgradeLockReason)}
                                title={upgradeLockReason || undefined}
                                onClick={() => {
                                    if (upgradeLockReason) {
                                        toast.error(upgradeLockReason);
                                        return;
                                    }
                                    router.push(upgradeHref);
                                }}
                            >
                                View upgrade options
                            </button>
                            {secondServiceHref && secondServiceLabel ? (
                                <button
                                    className="subscription-btn subscription-btn-primary shadow-sm"
                                    data-testid="add-second-service-cta"
                                    style={{ backgroundColor: "#0d2b1e" }}
                                    onClick={() => router.push(secondServiceHref)}
                                >
                                    {secondServiceLabel}
                                </button>
                            ) : null}
                            {hasActiveSa && hasActiveMtd ? (
                                <button
                                    className="subscription-btn subscription-btn-primary shadow-sm"
                                    data-testid="open-other-workspace"
                                    style={{ backgroundColor: "#2e5a45" }}
                                    onClick={() =>
                                        router.push(onMtdWorkspace ? "/dashboard" : "/mtd-dashboard")
                                    }
                                >
                                    {onMtdWorkspace ? "Open Self Assessment" : "Open Making Tax Digital"}
                                </button>
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
