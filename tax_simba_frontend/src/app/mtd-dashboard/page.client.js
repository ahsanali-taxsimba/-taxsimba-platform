"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import MtdSidebar from "./_components/MtdSidebar";
import MtdOverview from "./_components/MtdOverview";
import MtdNotifications from "./_components/MtdNotifications";
import MtdComplianceStatus from "./_components/MtdComplianceStatus";
import MtdTaxHistory from "./_components/MtdTaxHistory";
import EditProfile from "../dashboard/_components/EditProfile";
import DeleteProfile from "../dashboard/_components/DeleteProfile";
import ChangeProfilePassword from "../dashboard/_components/ChangeProfilePassword";
import MySubscriptionsClient from "../dashboard/my-subscriptions/_client/MySubscriptionsClient";
import BillingHistoryClient from "../dashboard/billing-history/_client/BillingHistoryClient";
import { FaEnvelope, FaIdCard, FaPhoneSquareAlt, FaCalendarAlt, FaClock, FaHourglass, FaCheck } from "react-icons/fa";
import { FaMapLocationDot, FaPencil } from "react-icons/fa6";
import toast from "react-hot-toast";

import { getBackendBaseUrl, formatQuarterDisplay } from "@/utils/commonHelper";

export default function MtdDashboardClient({ serverSession }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const validTabs = ["overview", "notifications", "taxHistory", "compliance", "subscriptions", "billingHistory", "profile", "deleteProfile", "changePassword"];
    const activeTab = validTabs.includes(tabFromUrl) ? tabFromUrl : "overview";
    const setActiveTab = (tabId) => {
        router.push(`/mtd-dashboard?tab=${tabId}`, { scroll: false });
    };

    const [userData, setUserData] = useState({});
    const [overviewData, setOverviewData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [trackUpdate, setTrackUpdate] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const hasLoadedOnce = React.useRef(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        } else if (session?.user?.isEngagementLetterAccepted === false) {
            router.push("/engagement-letter");
        } else if (session?.accessToken && !hasLoadedOnce.current) {
            // Only fetch on first load — do NOT refetch on every tab change
            fetchUserData(true);
        } else if (session?.accessToken && hasLoadedOnce.current) {
            // Already have data, stop showing spinner
            setLoading(false);
        }
    }, [session, status]);

    useEffect(() => {
        // Silent background refresh when profile/photo is updated
        if (session?.accessToken && hasLoadedOnce.current) fetchUserData(false);
    }, [trackUpdate]);

    const fetchUserData = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const [userRes, overviewRes] = await Promise.all([
                axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL}auth/get-account-details`,
                    {},
                    { headers: { Authorization: `Bearer ${session.accessToken}` } }
                ).catch(err => {
                    console.error("Error fetching user profile details", err);
                    return null;
                }),
                axios.get(
                    `${process.env.NEXT_PUBLIC_API_URL}mtd/dashboard-overview`,
                    { headers: { Authorization: `Bearer ${session.accessToken}` } }
                ).catch(err => {
                    console.error("Error fetching mtd dashboard overview", err);
                    return null;
                })
            ]);
            if (userRes) setUserData(userRes?.data?.data || {});
            if (overviewRes) setOverviewData(overviewRes?.data?.data || null);
            hasLoadedOnce.current = true;
        } catch (err) {
            console.error("Error fetching user data", err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleProfilePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploading(true);
        const formData = new FormData();
        formData.append("profilePhoto", file);
        
        try {
            const res = await axios.put(
                `${process.env.NEXT_PUBLIC_API_URL}auth/update-account-settings`,
                formData,
                { 
                    headers: { 
                        Authorization: `Bearer ${session.accessToken}`,
                        'Content-Type': 'multipart/form-data'
                    } 
                }
            );
            if(res.status === 200) {
                toast.success("Profile photo updated successfully!");
                setTrackUpdate((p) => !p);
            }
        } catch (error) {
            console.error("Error updating profile photo", error);
            toast.error("Failed to update profile photo.");
        } finally {
            setIsUploading(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div
                className="d-flex justify-content-center align-items-center"
                style={{ height: "50vh", backgroundColor: "rgba(255, 255, 255, 0.5)" }}
            >
                <div className="spinner-border theme-color" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const displayName =
        `${userData.name || ""} ${userData.surname || ""}`.trim() ||
        `${session?.user?.firstName || ""} ${session?.user?.lastName || ""}`.trim();

    // Overview Metrics Calculations for top header card
    const mtdQuarterRaw = overviewData?.taxReturn?.mtdQuarter || overviewData?.nextQuarter?.quarterName || userData?.currentQuarter || "—";
    const mtdQuarter = formatQuarterDisplay(mtdQuarterRaw);
    
    const mtdQuarterDueDate = overviewData?.taxReturn?.mtdQuarterDueDate || overviewData?.nextQuarter?.dueDate || null;
    const displayDeadline = mtdQuarterDueDate 
        ? new Date(mtdQuarterDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : "—";

    let daysRemaining = null;
    let daysRemainingText = "—";
    let daysRemainingColor = "normal"; // normal, warning, danger
    if (mtdQuarterDueDate) {
        const diffTime = Math.max(0, new Date(mtdQuarterDueDate) - new Date());
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        daysRemainingText = `${daysRemaining} Days`;
        if (daysRemaining < 7) {
            daysRemainingColor = "danger";
        } else if (daysRemaining < 14) {
            daysRemainingColor = "warning";
        } else {
            daysRemainingColor = "success";
        }
    }

    const currentStatus = overviewData?.taxReturnStatus || "pending_assignment";
    const statusIndexMap = {
        "pending_payment": 0,
        "payment_completed": 0,
        "pending_assignment": 0,
        "assigned": 1,
        "preparation_started": 2,
        "in_progress": 2,
        "draft_ready": 3,
        "client_review": 3,
        "approved": 3,
        "final_submitted": 4,
        "submitted": 4,
        "completed": 5
    };
    const taxReturnSteps = [
        { key: "pending_assignment", label: "Assigned Pending" },
        { key: "assigned", label: "Assigned" },
        { key: "preparation_started", label: "In Progress" },
        { key: "draft_ready", label: "Draft Ready" },
        { key: "final_submitted", label: "Final Submission" },
        { key: "completed", label: "Completed" }
    ];
    const currentIndex = statusIndexMap[currentStatus] ?? 0;
    let displayStatus = taxReturnSteps[currentIndex]?.label || "Assigned Pending";
    
    if (overviewData?.nextQuarter) {
        displayStatus = "Pending Start";
    }

    let statusBadgeColor = "secondary"; 
    if (overviewData?.nextQuarter) {
        statusBadgeColor = "info";
    } else if (currentStatus === "completed") {
        statusBadgeColor = "success";
    } else if (["preparation_started", "in_progress", "draft_ready", "client_review"].includes(currentStatus)) {
        statusBadgeColor = "warning";
    } else if (["pending_payment", "pending_assignment"].includes(currentStatus)) {
        statusBadgeColor = "secondary";
    } else if (["final_submitted", "submitted"].includes(currentStatus)) {
        statusBadgeColor = "success";
    }

    // Calculate backlog quarters based on onboarding answers
    const getBacklogQuarters = () => {
        if (!mtdQuarterRaw || mtdQuarterRaw === "—") return [];
        
        const match = mtdQuarterRaw.match(/Q([1-4])/);
        const qNum = match ? parseInt(match[1]) : 1;
        const yearMatch = mtdQuarterRaw.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

        let submitted = [];
        if (userData?.submittedQuarters) {
            try {
                submitted = JSON.parse(userData.submittedQuarters);
            } catch (e) {
                submitted = Array.isArray(userData.submittedQuarters) ? userData.submittedQuarters : [userData.submittedQuarters];
            }
        }
        if (!Array.isArray(submitted)) {
            submitted = typeof submitted === 'string' ? [submitted] : [];
        }

        if (userData?.prevSubmittedMTDThisYear === "Yes, all required quarters have been submitted") {
            return [];
        }

        const isBacklogRequired = userData?.hasOutstandingMTDSubmissions === "Yes" || 
                                  userData?.prevSubmittedMTDThisYear === "No, I have not submitted any quarterly updates" ||
                                  (userData?.prevSubmittedMTDThisYear === "Yes, some quarters have been submitted" && submitted.length < qNum - 1);
        
        if (!isBacklogRequired) return [];

        const outstanding = [];
        for (let i = 1; i < qNum; i++) {
            const isSubmitted = submitted.some(s => s && typeof s === 'string' && s.includes(`Q${i}`));
            if (!isSubmitted) {
                outstanding.push({ name: `Q${i} ${year}`, status: 'Pending' });
            }
        }
        outstanding.push({ name: `Q${qNum} ${year}`, status: 'In Progress' });
        
        if (outstanding.length > 1) {
            return outstanding;
        }
        return [];
    };

    const backlogQuarters = getBacklogQuarters();
    const hasBacklog = backlogQuarters.length > 0;

    return (
        <section className="profile_page mtd-dashboard-wrapper">
            <style>{`
                /* Header Overrides */
                .mtd-dashboard-wrapper .profile_head {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 248, 246, 0.95) 100%) !important;
                    border: 1px solid rgba(55, 162, 103, 0.16) !important;
                    border-left: 6px solid #37a267 !important;
                    border-radius: 20px !important;
                    box-shadow: 0 10px 30px rgba(5, 51, 39, 0.04) !important;
                    padding: 30px !important;
                    display: flex;
                    align-items: center;
                    gap: 30px;
                }
                .mtd-profile-figure {
                    border: 3px solid #ffffff !important;
                    box-shadow: 0 0 0 3px rgba(55, 162, 103, 0.25), 0 8px 20px rgba(0, 0, 0, 0.08) !important;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
                }
                .mtd-profile-figure:hover {
                    box-shadow: 0 0 0 4px rgba(55, 162, 103, 0.4), 0 12px 24px rgba(0, 0, 0, 0.12) !important;
                    transform: scale(1.02);
                }
                .profile-img-upload {
                    background: #37a267 !important;
                    color: #ffffff !important;
                    width: 32px !important;
                    height: 32px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    box-shadow: 0 4px 10px rgba(55, 162, 103, 0.3) !important;
                    border: 2px solid #ffffff !important;
                    cursor: pointer !important;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
                    bottom: 5px !important;
                    right: 5px !important;
                }
                .profile-img-upload:hover {
                    background: #2e8a56 !important;
                    transform: scale(1.1) !important;
                    box-shadow: 0 6px 14px rgba(55, 162, 103, 0.4) !important;
                }

                .profile_head_right ul li {
                    font-size: 13.5px !important;
                    color: #4b6357 !important;
                    font-weight: 500 !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 10px !important;
                    padding: 8px 14px !important;
                    border-radius: 10px !important;
                    background: rgba(55, 162, 103, 0.03) !important;
                    border: 1px solid rgba(55, 162, 103, 0.06) !important;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
                }
                .profile_head_right ul li:hover {
                    background: rgba(55, 162, 103, 0.06) !important;
                    border-color: rgba(55, 162, 103, 0.15) !important;
                    transform: translateX(4px);
                }
                .profile_head_right ul li svg {
                    color: #37a267 !important;
                    font-size: 15px !important;
                }

                .mtd-header-divider {
                    width: 1px;
                    align-self: stretch;
                    background: linear-gradient(180deg, rgba(55, 162, 103, 0.01) 0%, rgba(55, 162, 103, 0.15) 50%, rgba(55, 162, 103, 0.01) 100%);
                    margin: 0 10px;
                }

                /* Stats Grid & Cards */
                .mtd-header-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                    width: 100%;
                }
                .mtd-stat-card {
                    background: #ffffff;
                    border: 1px solid rgba(55, 162, 103, 0.12) !important;
                    border-radius: 16px !important;
                    padding: 14px 18px !important;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    min-width: 160px;
                    box-shadow: 0 4px 18px rgba(5, 51, 39, 0.01), inset 0 1px 0 0 rgba(255, 255, 255, 0.8) !important;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
                    position: relative;
                    overflow: hidden;
                }
                .mtd-stat-card:hover {
                    transform: translateY(-4px);
                    border-color: rgba(55, 162, 103, 0.3) !important;
                    box-shadow: 0 12px 24px -10px rgba(55, 162, 103, 0.15), 0 4px 12px rgba(0, 0, 0, 0.01) !important;
                }
                .mtd-stat-card::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 3px;
                    background: linear-gradient(90deg, transparent, rgba(55, 162, 103, 0.3), transparent);
                    transform: scaleX(0);
                    transition: transform 0.3s ease;
                }
                .mtd-stat-card:hover::after {
                    transform: scaleX(1);
                }
                
                .mtd-stat-icon-wrapper {
                    width: 40px !important;
                    height: 40px !important;
                    border-radius: 10px !important;
                    background: linear-gradient(135deg, rgba(55, 162, 103, 0.12) 0%, rgba(55, 162, 103, 0.03) 100%) !important;
                    border: 1px solid rgba(55, 162, 103, 0.15) !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #37a267 !important;
                    font-size: 16px !important;
                    flex-shrink: 0;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
                }
                .mtd-stat-card:hover .mtd-stat-icon-wrapper {
                    background: linear-gradient(135deg, rgba(55, 162, 103, 0.2) 0%, rgba(55, 162, 103, 0.06) 100%) !important;
                    transform: scale(1.08) rotate(5deg);
                    color: #2e8a56 !important;
                }

                .mtd-stat-details {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .mtd-stat-label {
                    font-size: 10px !important;
                    font-weight: 700 !important;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #64748b !important;
                }
                .mtd-stat-value {
                    font-size: 15px !important;
                    font-weight: 800 !important;
                    color: #0d2b1e !important;
                }

                /* Badge Pills */
                .mtd-badge-pill {
                    padding: 4px 12px;
                    border-radius: 50px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    display: inline-block;
                    text-align: center;
                    border: 1px solid transparent;
                }
                .mtd-badge-success {
                    background-color: #e6f7f0 !important;
                    color: #10b981 !important;
                    border-color: rgba(16, 185, 129, 0.2) !important;
                }
                .mtd-badge-warning {
                    background-color: #fff8ec !important;
                    color: #f59e0b !important;
                    border-color: rgba(245, 158, 11, 0.2) !important;
                }
                .mtd-badge-danger {
                    background-color: #fef2f2 !important;
                    color: #ef4444 !important;
                    border-color: rgba(239, 68, 68, 0.2) !important;
                }
                .mtd-badge-secondary {
                    background-color: #f3f4f6 !important;
                    color: #4b5563 !important;
                    border-color: rgba(75, 85, 99, 0.15) !important;
                }
                .mtd-badge-info {
                    background-color: #eff6ff !important;
                    color: #3b82f6 !important;
                    border-color: rgba(59, 130, 246, 0.2) !important;
                }
                .text-success {
                    color: #10b981 !important;
                }
                .text-warning {
                    color: #f59e0b !important;
                }
                .text-danger {
                    color: #ef4444 !important;
                }
                .text-normal {
                    color: #0d2b1e !important;
                }
                
                .mtd-dashboard-wrapper .profile_head_right {
                    width: auto !important;
                    flex: 1 !important;
                }

                @media (max-width: 991px) {
                    .mtd-header-stats-grid {
                        grid-template-columns: 1fr;
                        gap: 12px;
                    }
                    .mtd-header-divider {
                        display: none;
                    }
                }
            `}</style>
            <div className="container">
                {/* Profile Header */}
                <div className="profile_head">
                    <div className="profile_head_left">
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <figure className="mtd-profile-figure">
                                <Image
                                    src={
                                        userData?.profilePhoto
                                            ? userData.profilePhoto.startsWith("http")
                                                ? userData.profilePhoto
                                                : `${getBackendBaseUrl()}${userData.profilePhoto}`
                                            : "/images/user.png"
                                    }
                                    onError={(e) => { e.currentTarget.src = "/images/user.png"; console.error("Image failed to load"); }}
                                    alt="profile image"
                                    width={200}
                                    height={200}
                                    style={{ objectFit: 'cover', width: '100%', height: '100%', opacity: isUploading ? 0.5 : 1 }}
                                />
                            </figure>
                            <label 
                                htmlFor="profilePhotoInput" 
                                title="Change Profile Image"
                                className="profile-img-upload"
                            >
                                {isUploading ? <div className="spinner-border spinner-border-sm" /> : <FaPencil />}
                            </label>
                            <input 
                                type="file" 
                                id="profilePhotoInput" 
                                accept="image/*" 
                                style={{ display: 'none' }}
                                onChange={handleProfilePhotoChange}
                                disabled={isUploading}
                            />
                        </div>
                    </div>
                    <div className="profile_head_right d-flex flex-column flex-lg-row justify-content-between align-items-lg-center w-100 gap-4">
                        <div style={{ flex: '1 1 50%' }}>
                            <h2>{displayName || "MTD User"}</h2>
                            <ul className="ps-0 mb-0 d-flex flex-column gap-2">
                                <li>
                                    <FaIdCard />
                                    {userData.id || session?.user?.id}
                                </li>
                                <li>
                                    <FaEnvelope />
                                    {userData.email || session?.user?.email}
                                </li>
                                <li>
                                    <FaPhoneSquareAlt />
                                    {userData.mobile || session?.user?.mobile || "—"}
                                </li>
                                <li>
                                    <FaMapLocationDot />
                                    {userData.street && `${userData.street}, `}
                                    {userData.city && `${userData.city}, `}
                                    {userData.address && `${userData.address}, `}
                                    {userData.location ? userData.location : "—"}
                                </li>
                            </ul>
                        </div>
                        
                        {/* Divider */}
                        <div className="mtd-header-divider"></div>

                        <div className="mtd-header-stats-section" style={{ flex: '1 1 50%', width: '100%' }}>
                            {hasBacklog ? (
                                <div className="mtd-stat-card" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '20px', width: '100%', gap: '15px' }}>
                                    <div className="d-flex justify-content-between w-100">
                                        <div>
                                            <span className="mtd-stat-label">Current Quarter:</span>
                                            <span className="mtd-stat-value ms-2">{mtdQuarterRaw}</span>
                                        </div>
                                        <div>
                                            <span className="mtd-stat-label">Status:</span>
                                            <span className="mtd-badge-pill mtd-badge-danger ms-2">Historical Filings Required</span>
                                        </div>
                                    </div>
                                    
                                    <div className="w-100" style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '15px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                        <span className="mtd-stat-label text-danger mb-2 d-block">Outstanding:</span>
                                        <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                                            {backlogQuarters.map((q, idx) => (
                                                <li key={idx} className="d-flex align-items-center gap-2" style={{ fontSize: '14px', fontWeight: '600', color: '#0d2b1e' }}>
                                                    <FaCheck className={q.status === 'Pending' ? 'text-danger' : 'text-success'} /> 
                                                    {q.name} - <span className={q.status === 'Pending' ? 'text-danger' : 'text-success'}>{q.status}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    <div className="d-flex justify-content-between w-100 mt-1">
                                        <span className="mtd-stat-label">Status:</span>
                                        <span className="fw-bold text-danger" style={{ fontSize: '14px' }}>Backlog Filing Required</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="mtd-header-stats-grid">
                                    <div className="mtd-stat-card">
                                        <div className="mtd-stat-icon-wrapper">
                                            <FaCalendarAlt />
                                        </div>
                                        <div className="mtd-stat-details">
                                            <span className="mtd-stat-label">Current Quarter</span>
                                            <span className="mtd-stat-value">{mtdQuarter}</span>
                                        </div>
                                    </div>
                                    <div className="mtd-stat-card">
                                        <div className="mtd-stat-icon-wrapper">
                                            <FaClock />
                                        </div>
                                        <div className="mtd-stat-details">
                                            <span className="mtd-stat-label">Status</span>
                                            <span className={`mtd-badge-pill mtd-badge-${statusBadgeColor}`}>
                                                {displayStatus}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mtd-stat-card">
                                        <div className="mtd-stat-icon-wrapper">
                                            <FaCalendarAlt />
                                        </div>
                                        <div className="mtd-stat-details">
                                            <span className="mtd-stat-label">Next Deadline</span>
                                            <span className="mtd-stat-value">{displayDeadline}</span>
                                        </div>
                                    </div>
                                    <div className="mtd-stat-card">
                                        <div className="mtd-stat-icon-wrapper">
                                            <FaHourglass />
                                        </div>
                                        <div className="mtd-stat-details">
                                            <span className="mtd-stat-label">Days Remaining</span>
                                            <span className={`mtd-stat-value text-${daysRemainingColor}`}>
                                                {daysRemainingText}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Layout */}
                <div className="row mt-4">
                    <div className="col-lg-3 mb-4">
                        <MtdSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                    </div>
                    <div className="col-lg-9">
                        <div className="dashboard_layout">
                            {activeTab === "overview" && (
                                <MtdOverview 
                                    session={session} 
                                    userData={userData} 
                                    overviewData={overviewData} 
                                    onOverviewUpdate={(data) => setOverviewData(data)} 
                                />
                            )}
                            {activeTab === "notifications" && (
                                <MtdNotifications session={session} />
                            )}
                            {activeTab === "taxHistory" && (
                                <MtdTaxHistory session={session} />
                            )}
                            {activeTab === "compliance" && (
                                <MtdComplianceStatus session={session} />
                            )}
                            {activeTab === "profile" && (
                                <EditProfile
                                    userData={userData}
                                    sessionData={session}
                                    setTrackUpdate={() => setTrackUpdate((p) => !p)}
                                />
                            )}
                            {activeTab === "subscriptions" && (
                                <MySubscriptionsClient />
                            )}
                            {activeTab === "billingHistory" && (
                                <BillingHistoryClient />
                            )}
                            {activeTab === "deleteProfile" && (
                                <DeleteProfile
                                    sessionData={session}
                                    setTrackUpdate={() => setTrackUpdate((p) => !p)}
                                />
                            )}
                            {activeTab === "changePassword" && (
                                <ChangeProfilePassword
                                    sessionData={session}
                                    setTrackUpdate={() => setTrackUpdate((p) => !p)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
