"use client";
import { Spinner, Row, Col, Table } from "react-bootstrap";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { getCurrencySymbol } from "@/utils/commonHelper";
import { logClientAction } from "@/utils/auditLogger";

export default function MySubscriptionsUI({ userData, confirmData, allPlans = [], loading, sessionData }) {
    const router = useRouter();
    const [canceling, setCanceling] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);

    const handleBillingPortal = async () => {
        setPortalLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
            const response = await axios.post(`${apiUrl}client/subscription/portal`, {}, {
                headers: { Authorization: `Bearer ${sessionData.accessToken}` }
            });

            if (response.data && response.data.data?.url) {
                await logClientAction(
                    sessionData.accessToken,
                    "VIEW_STRIPE_BILLING_PORTAL",
                    "BILLING",
                    { url: response.data.data.url }
                );
                window.location.href = response.data.data.url;
            } else {
                toast.error("Failed to load billing portal link.");
            }
        } catch (err) {
            console.error("Failed to redirect to billing portal", err);
            toast.error(err?.response?.data?.message || "Failed to redirect to Stripe Billing Portal.");
        } finally {
            setPortalLoading(false);
        }
    };

    const handleCancel = async (subId) => {
        const result = await Swal.fire({
            title: 'Cancel Subscription?',
            text: "Are you sure you want to cancel your current subscription? This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#14ab71',
            cancelButtonColor: '#dc3545',
            confirmButtonText: 'Yes, cancel it!',
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
                { subscriptionId: subId }
            );

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/';
            await axios.post(`${apiUrl}client/subscription/cancel/${subId}`, {}, {
                headers: { Authorization: `Bearer ${sessionData.accessToken}` }
            });

            await Swal.fire({
                title: 'Cancelled!',
                text: 'Your subscription has been cancelled.',
                icon: 'success',
                confirmButtonColor: '#14ab71',
                borderRadius: '15px'
            });

            window.location.reload();
        } catch (err) {
            console.error("Failed to cancel plan", err);
            Swal.fire({
                title: 'Error!',
                text: err?.response?.data?.message || "Failed to cancel subscription.",
                icon: 'error',
                confirmButtonColor: '#14ab71',
                borderRadius: '15px'
            });
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
    const activeSubFromConfirm = Array.isArray(confirmData)
        ? confirmData[0]
        : Array.isArray(confirmData?.subscriptions)
          ? confirmData.subscriptions[0]
          : (confirmData?.subscription || confirmData?.data || confirmData);

    const sub = activeSubFromConfirm || userData?.subscription || userData?.subscriptions?.[0];
    const hasActive =
      Boolean(userData?.hasActiveService) ||
      Boolean(confirmData?.hasActiveService) ||
      Boolean(sub && (sub.status === 'active' || sub.status === 'ACTIVE'));
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
                                    <span className="badge px-3 py-2 text-capitalize" style={{ backgroundColor: sub.status === 'active' ? '#0f8c5a' : '#c82333' }}>
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

                        {/* P0 K.3: portal/cancel hidden (E9); upgrade-only CTA (E8) */}
                        <div className="subscription-actions-wrapper mt-3">
                            <button
                                className="subscription-btn subscription-btn-primary shadow-sm"
                                onClick={() => router.push('/planlist')}
                            >
                                View upgrade options
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
