"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
    FaUserTie, FaEnvelope, FaCheck, FaArrowRight, FaClock, FaSearch, FaCertificate, FaPlusCircle, FaFileInvoice, FaCloudUploadAlt, FaFilePdf, FaDownload, FaExclamationCircle, FaHourglass, FaIdCard, FaBell, FaCheckDouble
} from "react-icons/fa";
import { MdOutlineAssignment } from "react-icons/md";
import { IoChatbubbles } from "react-icons/io5";
import { Modal } from "react-bootstrap";
import toast from "react-hot-toast";

const DOCUMENT_TYPES = [
    { id: "bank_statement", label: "Bank Statements" },
    { id: "invoice", label: "Invoices / Receipts" },
    { id: "identity", label: "Identity Document" },
    { id: "vat_certificate", label: "VAT Certificate" },
    { id: "p60_p45", label: "P60 / P45" },
    { id: "general", label: "Other / General" },
];

import DraftReviewModal from "./DraftReviewModal";
import FinalCertificateModal from "./FinalCertificateModal";
import NewTaxReturnModal from "./NewTaxReturnModal";
import UploadCurrentTaxDocumentModal from "./UploadCurrentTaxDocumentModal";
// P0 T3 HIDE: StartNextQuarterModal deferred — periods are created on activation.
import MtdMessages from "./MtdMessages";
import ReviewBox from "@/components/re-used/ReviewBox";
import { formatQuarterDisplay } from "@/utils/commonHelper";

export default function MtdOverview({ session, userData, overviewData, onOverviewUpdate }) {
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [showFinalModal, setShowFinalModal] = useState(false);
    const [showNewReturnModal, setShowNewReturnModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showChatModal, setShowChatModal] = useState(false);
    const [selectedUploadType, setSelectedUploadType] = useState("general");
    const [uploadingRequestId, setUploadingRequestId] = useState(null);

    const [notifications, setNotifications] = useState([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);

    useEffect(() => {
        if (session?.accessToken) {
            if (overviewData) {
                setOverview(overviewData);
                setLoading(false);
            } else {
                fetchOverview();
            }
            fetchNotifications();
        }
    }, [session, overviewData]);

  

  
    
    const fetchNotifications = async () => {
        if (!session?.accessToken) return;
        try {
            setLoadingNotifications(true);
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}all-notifications`,
                { limit: 5 },
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setNotifications(res.data?.data?.notifications || []);
        } catch (err) {
            console.error("Error fetching notifications", err);
        } finally {
            setLoadingNotifications(false);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await axios.patch(
                `${process.env.NEXT_PUBLIC_API_URL}notifications/${notificationId}/read`,
                {},
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
            toast.success("Notification marked as read");
        } catch (err) {
            console.error("Error marking notification as read", err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await axios.patch(
                `${process.env.NEXT_PUBLIC_API_URL}notifications/mark-all-read`,
                {},
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            toast.success("All notifications marked as read");
        } catch (err) {
            console.error("Error marking all notifications as read", err);
        }
    };

    const handleUpload = async (files, requestId = null) => {
        if (!files || files.length === 0) return;
        if (requestId) setUploadingRequestId(requestId);

        const formData = new FormData();
        Array.from(files).forEach((f) => formData.append("documents", f));
        formData.append("documentType", "general"); // fallback
        if (requestId) formData.append("requestId", requestId);

        try {
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}mtd/documents/upload`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${session.accessToken}`,
                        "Content-Type": "multipart/form-data",
                    },
                }
            );
            toast.success("Document uploaded successfully!");
            await fetchOverview();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Upload failed.");
        } finally {
            setUploadingRequestId(null);
        }
    };

    const fetchOverview = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}mtd/dashboard-overview`,
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setOverview(res.data?.data);
            if (onOverviewUpdate) {
                onOverviewUpdate(res.data?.data);
            }
        } catch (err) {
            console.error("Error fetching overview", err);
        } finally {
            setLoading(false);
        }
    };

    const accountant = overview?.accountant;
    const currentStatus = overview?.taxReturnStatus || "pending_assignment";

    const taxReturnSteps = [
        { key: "pending_assignment", label: "Assigned Pending", sub: "Assigned Tax Professional Pending" },
        { key: "assigned", label: "Assigned", sub: "Assigned to tax professional" },
        { key: "preparation_started", label: "In Progress", sub: "Tax return preparation in progress" },
        { key: "draft_ready", label: "Draft Ready", sub: "Draft ready for client review" },
        { key: "final_submitted", label: "Final Submission", sub: "Final documents submitted to tax authorities" },
        { key: "completed", label: "Completed", sub: "Tax return filed successfully" }
    ];

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

    const currentIndex = statusIndexMap[currentStatus] ?? 0;
    const currentStepLabel = taxReturnSteps[currentIndex]?.label || "Assigned Pending";

    const requestedDocs = overview?.documents?.filter(doc => doc.uploadStatus === "uploading" && doc.isRequired === true) || [];
    const completedDocs = overview?.documents?.filter(doc => doc.uploadStatus === "completed") || [];
    
    // Split into user-uploaded and accountant-uploaded
    const currentUserId = userData?.id || session?.user?.id;
    const userUploadedDocs = completedDocs.filter(doc => !doc.uploadedBy || doc.uploadedBy === currentUserId);
    const accountantUploadedDocs = completedDocs.filter(doc => doc.uploadedBy && doc.uploadedBy !== currentUserId);

    const mtdQuarter = overview?.taxReturn?.mtdQuarter;
    const mtdQuarterDueDate = overview?.taxReturn?.mtdQuarterDueDate;
    let daysRemaining = null;
    if (mtdQuarterDueDate) {
        const diffTime = Math.max(0, new Date(mtdQuarterDueDate) - new Date());
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    const previousTaxReturn = overview?.previousTaxReturn;

    // P0 T3 HIDE: never enter the "start next quarter" waiting UI.
    const nextQuarter = null;
    const isWaitingForNextQuarter = false;
    const nextDaysRemaining = null;

    return (
        <div>
            <style>{`
                .mtd-overview-greeting {
                    background: linear-gradient(135deg, #02120e 0%, #053327 100%);
                    border-radius: 16px;
                    padding: 36px;
                    color: #fff;
                    margin-bottom: 24px;
                    border: 1px solid rgba(55, 162, 103, 0.12);
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 10px 30px -10px rgba(2, 18, 14, 0.3);
                }
                .mtd-overview-greeting::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -10%;
                    width: 300px;
                    height: 300px;
                    background: radial-gradient(circle, rgba(55, 162, 103, 0.15) 0%, transparent 70%);
                    border-radius: 50%;
                }
                .mtd-overview-greeting h2 { 
                    font-size: 28px; 
                    font-weight: 800; 
                    letter-spacing: -0.03em;
                    margin-bottom: 8px; 
                }
                .mtd-overview-greeting p { 
                    color: rgba(255,255,255,0.7); 
                    font-size: 14px; 
                    font-weight: 500;
                    margin: 0; 
                }
                .mtd-overview-greeting .mtd-badge {
                    display: inline-flex; 
                    align-items: center; 
                    gap: 8px;
                    background: rgba(55, 162, 103, 0.08); 
                    border: 1px solid rgba(55, 162, 103, 0.25);
                    color: #37a267; 
                    padding: 6px 16px; 
                    border-radius: 50px; 
                    font-size: 11px;
                    font-weight: 700; 
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 18px;
                }

                /* Requested Documents Section */
                .mtd-req-section {
                    background: #fff; border: 2px solid #ffbc34; border-radius: 14px;
                    padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(255, 188, 52, 0.1);
                    position: relative; overflow: hidden;
                }
                .mtd-req-section::before {
                    content: ''; position: absolute; top: 0; left: 0; width: 6px; height: 100%;
                    background: #ffbc34;
                }
                .mtd-req-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
                .mtd-req-header h5 { color: #d35400; font-size: 18px; font-weight: 800; margin: 0; }
                .mtd-req-header svg { color: #d35400; font-size: 20px; }
                .mtd-req-list { display: flex; flex-direction: column; gap: 12px; }
                .mtd-req-item {
                    display: flex; align-items: center; justify-content: space-between; gap: 16px;
                    background: #fffdf5; border: 1px solid #ffe6a6; border-radius: 12px; padding: 16px;
                }
                .mtd-req-info h6 { font-size: 15px; font-weight: 700; color: #333; margin: 0 0 4px 0; }
                .mtd-req-info p { font-size: 13px; color: #777; margin: 0; }
                .mtd-req-upload-btn {
                    padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
                    border: none; background: #ffbc34; color: #fff; cursor: pointer; transition: 0.2s;
                    white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;
                }
                .mtd-req-upload-btn:hover { background: #f39c12; }
                .mtd-req-upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }

                .mtd-cards-grid { display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px; }
                
                .process-timeline {
                    background: #fff;
                    border-radius: 16px;
                    padding: 30px 40px;
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.02), 0 12px 30px -4px rgba(0, 0, 0, 0.03);
                }

                .process-timeline-header {
                    display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;
                }
                .process-timeline-header h3 { font-size: 18px; font-weight: 800; color: #0d2b1e; margin: 0; letter-spacing: -0.02em; }
                .process-timeline-header .current-status { font-size: 13px; color: #6c887b; font-weight: 600; }
                .process-timeline-header .current-status span { color: #10b981; font-weight: 700; }

                .timeline-horizontal {
                    display: flex;
                    justify-content: space-between;
                    position: relative;
                    width: 100%;
                }
                .timeline-step {
                    position: relative;
                    z-index: 3;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 16.66%;
                    text-align: center;
                }
                .timeline-step:not(:last-child)::before {
                    content: '';
                    position: absolute;
                    top: 21px;
                    left: calc(50% + 21px);
                    width: calc(100% - 42px);
                    height: 2px;
                    background: #f1f5f9;
                    z-index: 1;
                    transition: background 0.3s ease;
                }
                .timeline-step.done:not(:last-child)::before {
                    background: #37a267;
                    box-shadow: 0 0 10px rgba(55, 162, 103, 0.3);
                }
                .timeline-icon {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                    font-size: 14px;
                    margin-bottom: 12px;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .timeline-step.done .timeline-icon {
                    background: #37a267;
                    border-color: #37a267;
                    color: #02120e;
                    box-shadow: 0 0 0 4px rgba(55, 162, 103, 0.15);
                }
                .timeline-step.active .timeline-icon {
                    border-color: #37a267;
                    color: #37a267;
                    background: #fff;
                    box-shadow: 0 0 0 6px rgba(55, 162, 103, 0.12);
                }
                .timeline-label {
                    font-size: 14px;
                    font-weight: 700;
                    color: #0f172a;
                    margin-bottom: 4px;
                    letter-spacing: -0.01em;
                }
                .timeline-sub {
                    font-size: 11px;
                    color: #64748b;
                    line-height: 1.3;
                    padding: 0 8px;
                    min-height: 30px;
                }
                .timeline-step:not(.done) .timeline-sub {
                    color: #64748b;
                }
                .timeline-status {
                    margin-top: 8px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 4px 12px;
                    border-radius: 20px;
                    background: #f1f5f9;
                    color: #64748b;
                }
                .timeline-step.done .timeline-status {
                    color: #10b981;
                    background: rgba(55, 162, 103, 0.08);
                }
                .timeline-step.active .timeline-status {
                    color: #10b981;
                    background: rgba(55, 162, 103, 0.12);
                }
                .timeline-step:not(.done):not(.active) .timeline-status {
                    color: #64748b;
                    background: #f1f5f9;
                }

                .mtd-info-card {
                    background: #fff;
                    border-radius: 16px;
                    padding: 16px;
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.02), 0 12px 30px -4px rgba(0, 0, 0, 0.03);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .mtd-info-card:hover { 
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px -4px rgba(0, 0, 0, 0.06); 
                }
                .mtd-info-card .card-label {
                    font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.05em; color: #64748b; margin-bottom: 20px; display: flex;
                    align-items: center; gap: 8px;
                }

                .accountant-info-wrapper { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
                .accountant-avatar {
                    width: 64px; height: 64px; border-radius: 50%;
                    background: linear-gradient(135deg, #05261f 0%, #10b981 100%);
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; font-size: 24px; font-weight: 700;
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
                    flex-shrink: 0;
                }
                .accountant-avatar.empty {
                    background: #f1f5f9; color: #94a3b8; box-shadow: none;
                }
                .accountant-name { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.01em; }
                .accountant-email { font-size: 13px; color: #475569; display: flex; align-items: center; gap: 8px; }

                @media (max-width: 991px) {
                    .mtd-overview-greeting {
                        padding: 28px;
                    }
                    .mtd-overview-greeting h2 {
                        font-size: 24px;
                    }
                }
                
                @media (max-width: 768px) {
                    .mtd-overview-greeting {
                        padding: 20px;
                    }
                    .mtd-overview-greeting h2 {
                        font-size: 20px;
                    }
                    .mtd-overview-greeting p {
                        font-size: 13px;
                    }
                    .process-timeline {
                        padding: 24px 20px;
                    }
                    .process-timeline-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                        margin-bottom: 24px;
                    }
                    .timeline-horizontal {
                        flex-direction: column;
                        gap: 24px;
                        padding-left: 10px;
                    }
                    .timeline-step {
                        display: grid;
                        grid-template-columns: 42px 1fr;
                        grid-template-rows: auto auto auto;
                        gap: 2px 16px;
                        text-align: left;
                        width: 100%;
                    }
                    .timeline-icon {
                        grid-column: 1;
                        grid-row: 1 / span 3;
                        margin: 0;
                        align-self: start;
                    }
                    .timeline-label {
                        grid-column: 2;
                        grid-row: 1;
                        margin: 0;
                    }
                    .timeline-sub {
                        grid-column: 2;
                        grid-row: 2;
                        margin: 0;
                        padding: 0;
                        min-height: auto;
                    }
                    .timeline-status {
                        grid-column: 2;
                        grid-row: 3;
                        margin-top: 4px;
                        align-self: start;
                        justify-self: start;
                    }
                    .timeline-step:not(:last-child)::before {
                        left: 21px;
                        top: 42px;
                        width: 2px;
                        height: auto;
                        bottom: -24px;
                    }
                    .mtd-info-card {
                        padding: 20px !important;
                    }
                }

                @media (max-width: 480px) {
                    .accountant-info-wrapper {
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        flex-wrap: wrap;
                    }
                    .accountant-email {
                        justify-content: center;
                    }
                }
            `}</style>

            {/* Greeting Banner */}
            <div className="mtd-overview-greeting">
                <div className="mtd-badge">
                    <MdOutlineAssignment /> MTD Compliance Dashboard
                </div>
                <h2>Welcome, {`${userData?.name || ""} ${userData?.surname || ""}`.trim() || session?.user?.name || "Client"} 👋</h2>
                <p>Your MTD compliance journey is being managed by our expert accountants.</p>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border theme-color" role="status" />
                </div>
            ) : (
                <>
                    <div className="mtd-cards-grid">
                        
                        {/* Action Required: Requested Documents */}
                        {requestedDocs.length > 0 && (
                            <div className="mtd-req-section">
                                <div className="mtd-req-header">
                                    <FaExclamationCircle />
                                    <h5>Action Required: Pending Requests</h5>
                                </div>
                                <div className="mtd-req-list">
                                    {requestedDocs.map(reqDoc => (
                                        <div key={reqDoc.id} className="mtd-req-item">
                                            <div className="mtd-req-info" style={{ flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                                                    <h6 style={{ margin: 0 }}>{DOCUMENT_TYPES.find(t => t.id === reqDoc.documentType)?.label || reqDoc.documentType}</h6>
                                                    {reqDoc.priority && (
                                                        <span style={{
                                                            fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "12px",
                                                            backgroundColor: reqDoc.priority === "urgent" || reqDoc.priority === "high" ? "#fee2e2" : reqDoc.priority === "medium" ? "#fef3c7" : "#e0e7ff",
                                                            color: reqDoc.priority === "urgent" || reqDoc.priority === "high" ? "#dc2626" : reqDoc.priority === "medium" ? "#d97706" : "#4f46e5",
                                                            textTransform: "uppercase"
                                                        }}>
                                                            {reqDoc.priority} Priority
                                                        </span>
                                                    )}
                                                    {reqDoc.deadline && (
                                                        <span style={{ fontSize: "12px", color: "#e11d48", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                                                            <FaHourglass size={10} /> Due: {new Date(reqDoc.deadline).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                {reqDoc.message ? (
                                                    <div style={{ background: "#fff", padding: "8px 12px", borderRadius: "6px", borderLeft: "3px solid #ffbc34", fontSize: "13px", color: "#555", marginTop: "8px", whiteSpace: "pre-wrap" }}>
                                                        <strong>Note from Accountant:</strong><br/>{reqDoc.message}
                                                    </div>
                                                ) : (
                                                    <p>Your accountant has requested this document to proceed.</p>
                                                )}
                                            </div>
                                            <div>
                                                <input 
                                                    type="file" 
                                                    id={`req-upload-${reqDoc.id}`} 
                                                    style={{ display: "none" }} 
                                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                    onChange={(e) => handleUpload(e.target.files, reqDoc.id)}
                                                />
                                                <button 
                                                    className="mtd-req-upload-btn"
                                                    disabled={uploadingRequestId === reqDoc.id}
                                                    onClick={() => document.getElementById(`req-upload-${reqDoc.id}`).click()}
                                                >
                                                    {uploadingRequestId === reqDoc.id ? (
                                                        <><div className="spinner-border spinner-border-sm" /> Uploading...</>
                                                    ) : (
                                                        <><FaCloudUploadAlt /> Upload File</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Process Timeline */}
                        {!isWaitingForNextQuarter && (
                            <div className="process-timeline">
                            <div className="process-timeline-header">
                                {/* <h3>Progress Tracker</h3> */}
                                <h3>Quarterly Compliance Status</h3>
                                <div className="current-status">
                                    Current: <span>{currentStepLabel}</span>
                                </div>
                            </div>
                            
                            <div className="timeline-horizontal">
                                {taxReturnSteps.map((step, index) => {
                                    const isDone = index < currentIndex;
                                    const isActive = index === currentIndex;
                                    
                                    return (
                                        <div key={step.key} className={`timeline-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                                            <div className="timeline-icon">
                                                {isDone ? <FaCheck /> : isActive ? <FaClock /> : <FaCheck />}
                                            </div>
                                            <div className="timeline-label">{step.label}</div>
                                            <div className="timeline-sub">{step.sub}</div>
                                            <div className="timeline-status">
                                                {isDone ? "Complete" : isActive ? "In Progress" : "Pending"}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            </div>
                        )}

                        {/* Information Cards Row */}
                        <div className="row g-4 mt-1">
                            <div className={`col-lg-${isWaitingForNextQuarter ? '3' : '4'} col-md-6`}>
                                {/* Accountant Card */}
                                <div className="mtd-info-card h-100">
                                    <div className="card-label">
                                        <FaUserTie style={{ color: "#37a267", fontSize: "16px" }} /> Assigned Accountant
                                    </div>
                                    <div className="accountant-info-wrapper">
                                        {accountant ? (
                                            <>
                                                <div className="accountant-avatar">
                                                    {accountant.name?.[0]?.toUpperCase() || "A"}
                                                </div>
                                                <div>
                                                    <div className="accountant-name">
                                                        {accountant.name} {accountant.surname}
                                                    </div>
                                                    <div className="accountant-email">
                                                        <FaEnvelope style={{ color: "#37a267" }} /> {accountant.email}
                                                    </div>
                                                    <div className="mt-2">
                                                        <button 
                                                            className="btn btn-sm text-white fw-bold d-inline-flex align-items-center gap-2"
                                                            style={{ background: "linear-gradient(135deg, #37a267, #2e8a56)", border: "none", borderRadius: "50px", padding: "6px 16px" }}
                                                            onClick={() => setShowChatModal(true)}
                                                        >
                                                            <IoChatbubbles /> Chat
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="accountant-avatar empty">
                                                    <FaUserTie />
                                                </div>
                                                <div>
                                                    <div className="accountant-name" style={{ color: "#666" }}>No accountant assigned yet.</div>
                                                    <div className="accountant-email" style={{ color: "#999" }}>Our team will assign one shortly.</div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {isWaitingForNextQuarter ? (
                                <>
                                    <div className="col-lg-3 col-md-6">
                                        <div className="mtd-info-card h-100">
                                            <div className="card-label">
                                                <FaFileInvoice style={{ color: "#f39c12", fontSize: "16px" }} /> Previous Quarter
                                            </div>
                                            <div className="d-flex flex-column gap-3 mt-3">
                                                <div className="d-flex justify-content-between border-bottom pb-2">
                                                    <span className="text-muted" style={{ fontSize: "14px" }}>Quarter</span>
                                                    <span className="fw-bold text-dark">{formatQuarterDisplay(mtdQuarter)}</span>
                                                </div>
                                                <div className="d-flex justify-content-between">
                                                    <span className="text-muted" style={{ fontSize: "14px" }}>Status</span>
                                                    <span className="fw-bold text-success d-flex align-items-center gap-1">
                                                        Completed <FaCheck size={12}/>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-lg-3 col-md-6">
                                        <div className="mtd-info-card h-100" style={{ border: "2px solid #37a267" }}>
                                            <div className="card-label">
                                                <FaFileInvoice style={{ color: "#37a267", fontSize: "16px" }} /> Next Quarter Due
                                            </div>
                                            <div className="d-flex flex-column gap-3 mt-3">
                                                <div className="d-flex justify-content-between border-bottom pb-2">
                                                    <span className="text-muted" style={{ fontSize: "14px" }}>Quarter</span>
                                                    <span className="fw-bold text-dark">{formatQuarterDisplay(nextQuarter.quarterName)}</span>
                                                </div>
                                                <div className="d-flex justify-content-between border-bottom pb-2">
                                                    <span className="text-muted" style={{ fontSize: "14px" }}>Due Date</span>
                                                    <span className="fw-bold text-dark">{new Date(nextQuarter.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                                </div>
                                                <div className="d-flex justify-content-between border-bottom pb-2">
                                                    <span className="text-muted" style={{ fontSize: "14px" }}>Days Remaining</span>
                                                    <span className="fw-bold" style={{ color: nextDaysRemaining < 14 ? "#dc3545" : "#37a267" }}>
                                                        {nextDaysRemaining} Days
                                                    </span>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center mt-2">
                                                    <span className="fw-bold text-danger lh-1" style={{ fontSize: "13px" }}>
                                                        Action<br/>Required
                                                    </span>
                                                    <button 
                                                        className="btn text-white fw-bold px-3 py-2"
                                                        style={{ background: "#37a267", borderRadius: "6px", fontSize: "13px" }}
                                                        onClick={() => setShowStartNextQuarterModal(true)}
                                                    >
                                                        Start Now
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="col-lg-4 col-md-6">
                                    <div className="mtd-info-card h-100">
                                        <div className="card-label">
                                            <FaFileInvoice style={{ color: "#f39c12", fontSize: "16px" }} /> {mtdQuarter ? "Quarterly Compliance" : "Tax Return Details"}
                                        </div>
                                        <div className="d-flex flex-column gap-3 mt-3">
                                            {mtdQuarter ? (
                                                <>
                                                    {previousTaxReturn && previousTaxReturn.mtdQuarter && (
                                                        <div className="d-flex justify-content-between border-bottom pb-2">
                                                            <span className="text-muted" style={{ fontSize: "14px" }}>Previous Quarter</span>
                                                            <span className="fw-bold text-success d-flex align-items-center gap-1">
                                                                {formatQuarterDisplay(previousTaxReturn.mtdQuarter)} <FaCheck size={12}/>
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted" style={{ fontSize: "14px" }}>Current Quarter</span>
                                                        <span className="fw-bold text-dark">{formatQuarterDisplay(mtdQuarter)}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted" style={{ fontSize: "14px" }}>Due Date</span>
                                                        <span className="fw-bold text-dark">{new Date(mtdQuarterDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted" style={{ fontSize: "14px" }}>Days Remaining</span>
                                                        <span className="fw-bold" style={{ color: daysRemaining < 14 ? "#dc3545" : "#37a267" }}>
                                                            {daysRemaining} Days
                                                        </span>
                                                    </div>
                                                    <div className="d-flex justify-content-between">
                                                        <span className="text-muted" style={{ fontSize: "14px" }}>Status</span>
                                                        {daysRemaining < 14 && requestedDocs.length > 0 ? (
                                                            <span className="fw-bold text-danger">Action Required</span>
                                                        ) : (
                                                            <span className="fw-bold text-success">Compliance On Track</span>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted" style={{ fontSize: "14px" }}>Reference ID</span>
                                                        <span className="fw-bold text-dark">{overview?.taxReturn?.taxReturnId || "N/A"}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between border-bottom pb-2">
                                                        <span className="text-muted" style={{ fontSize: "14px" }}>Tax Year</span>
                                                        <span className="fw-bold text-dark">{overview?.taxReturn?.taxYear || "N/A"}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between">
                                                        <span className="text-muted" style={{ fontSize: "14px" }}>Priority</span>
                                                        <span className="fw-bold text-capitalize">{overview?.taxReturn?.priority || "Medium"}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={`col-lg-${isWaitingForNextQuarter ? '3' : '4'} col-md-12`}>
                                {/* Business Profile Card */}
                                <div className="mtd-info-card h-100">
                                    <div className="card-label">
                                        <FaIdCard style={{ color: "#9b59b6", fontSize: "16px" }} /> Business & Tax Profile
                                    </div>
                                    <div className="d-flex flex-column gap-3 mt-3">
                                        <div className="d-flex justify-content-between border-bottom pb-2">
                                            <span className="text-muted" style={{ fontSize: "14px" }}>Business Name</span>
                                            <span className="fw-bold text-dark text-truncate" style={{ maxWidth: "150px" }} title={userData?.businessName || "N/A"}>{userData?.businessName || "N/A"}</span>
                                        </div>
                                        <div className="d-flex justify-content-between border-bottom pb-2">
                                            <span className="text-muted" style={{ fontSize: "14px" }}>UTR</span>
                                            <span className="fw-bold text-dark">{userData?.utr || "N/A"}</span>
                                        </div>
                                        <div className="d-flex justify-content-between border-bottom pb-2">
                                            <span className="text-muted" style={{ fontSize: "14px" }}>NINO</span>
                                            <span className="fw-bold text-dark">{userData?.nino || "N/A"}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted" style={{ fontSize: "14px" }}>Gov Gateway</span>
                                            <span className="fw-bold text-dark">{userData?.govGatewayStatus || (userData?.hasGovGateway ? "Yes" : "No")}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notifications Section */}
                        <div className="mtd-info-card mt-4">
                            <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3 flex-wrap gap-3">
                                <div className="card-label mb-0 border-bottom-0 pb-0">
                                    <FaBell style={{ color: "#e74c3c", fontSize: "18px" }} /> Recent Notifications
                                </div>
                                {notifications.some(n => !n.read) && (
                                    <button 
                                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 fw-bold px-3 py-2"
                                        style={{ borderRadius: "8px", border: "1px solid #ced4da", background: "#f8f9fa", fontSize: "12px" }}
                                        onClick={handleMarkAllAsRead}
                                    >
                                        <FaCheckDouble size={14} /> Mark all as read
                                    </button>
                                )}
                            </div>

                            {loadingNotifications ? (
                                <div className="text-center py-4">
                                    <div className="spinner-border text-danger" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : notifications.length > 0 ? (
                                <div className="d-flex flex-column gap-3">
                                    {notifications.map(notif => {
                                        let NotifIcon = FaBell;
                                        let iconColor = "#95a5a6";
                                        let bgColor = "#f8f9fa";

                                        if (notif.type === "document_request" || notif.type === "document") {
                                            NotifIcon = FaCloudUploadAlt;
                                            iconColor = "#3498db";
                                            bgColor = "#ebf5fb";
                                        } else if (notif.type === "completion") {
                                            NotifIcon = FaCheck;
                                            iconColor = "#2ecc71";
                                            bgColor = "#eafaf1";
                                        } else if (notif.type === "assignment") {
                                            NotifIcon = FaUserTie;
                                            iconColor = "#9b59b6";
                                            bgColor = "#f5eef8";
                                        } else if (notif.type === "payment") {
                                            NotifIcon = FaFileInvoice;
                                            iconColor = "#f1c40f";
                                            bgColor = "#fef9e7";
                                        } else if (notif.type === "admin_flag") {
                                            NotifIcon = FaExclamationCircle;
                                            iconColor = "#e74c3c";
                                            bgColor = "#fdedd8";
                                        }

                                        return (
                                            <div 
                                                key={notif.id} 
                                                className={`d-flex align-items-center justify-content-between p-3 rounded border transition-all ${notif.read ? 'bg-light' : 'bg-white shadow-sm'}`}
                                                style={{ 
                                                    borderLeft: `4px solid ${notif.read ? '#bdc3c7' : iconColor}`,
                                                    transition: "all 0.2s ease-in-out"
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-3 overflow-hidden w-100">
                                                    <div 
                                                        className="d-flex align-items-center justify-content-center flex-shrink-0"
                                                        style={{ 
                                                            width: "40px", 
                                                            height: "40px", 
                                                            borderRadius: "50%", 
                                                            backgroundColor: bgColor,
                                                            color: iconColor 
                                                        }}
                                                    >
                                                        <NotifIcon size={20} />
                                                    </div>
                                                    <div className="overflow-hidden" style={{ minWidth: 0 }}>
                                                        <p className={`mb-1 ${notif.read ? 'text-muted' : 'text-dark fw-semibold'}`} style={{ fontSize: "14px", lineHeight: "1.4", margin: 0 }}>
                                                            {notif.message}
                                                        </p>
                                                        <span className="text-muted d-block mt-1" style={{ fontSize: "12px" }}>
                                                            {notif.time}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {!notif.read && (
                                                    <button 
                                                        className="btn btn-sm btn-light border ms-3 flex-shrink-0 d-flex align-items-center justify-content-center"
                                                        style={{ width: "32px", height: "32px", borderRadius: "50%", padding: 0 }}
                                                        onClick={() => handleMarkAsRead(notif.id)}
                                                        title="Mark as read"
                                                    >
                                                        <FaCheck size={12} className="text-success" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <FaBell size={36} className="mb-2 text-light" style={{ opacity: 0.5 }} />
                                    <p className="mb-0" style={{ fontSize: "14px" }}>No recent notifications.</p>
                                </div>
                            )}
                        </div>

                        {/* Current Tax Return Documents Section */}
                        {overview?.taxReturn && (
                            <div className="mtd-info-card mt-4">
                                <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3 flex-wrap gap-3">
                                    <div className="card-label mb-0 border-bottom-0 pb-0">
                                        <FaCloudUploadAlt style={{ color: "#3498db", fontSize: "18px" }} /> Tax Return Documents
                                    </div>
                                    {currentIndex <= 3 && (
                                        <button 
                                            className="btn btn-sm btn-primary d-flex align-items-center gap-2 fw-bold px-3 py-2"
                                            style={{ borderRadius: "8px", background: "linear-gradient(135deg, #3498db, #2980b9)", border: "none" }}
                                            onClick={() => {
                                                setSelectedUploadType(null);
                                                setShowUploadModal(true);
                                            }}
                                        >
                                            <FaCloudUploadAlt /> Upload Document
                                        </button>
                                    )}
                                </div>

                                {/* Requested Documents Section */}
                                {requestedDocs.length > 0 && (
                                    <div className="mb-4" style={{ background: "#fffdf5", border: "2px solid #ffe6a6", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 12px rgba(255, 188, 52, 0.1)" }}>
                                        <div className="d-flex align-items-center gap-2 mb-3">
                                            <FaExclamationCircle color="#d35400" size={20} />
                                            <h5 className="mb-0" style={{ color: "#d35400", fontWeight: "800", fontSize: "16px" }}>Action Required: Pending Requests</h5>
                                        </div>
                                        <div className="d-flex flex-column gap-3">
                                            {requestedDocs.map(reqDoc => (
                                                <div key={reqDoc.id} className="d-flex flex-column flex-md-row align-items-md-center justify-content-between bg-white border rounded p-3 shadow-sm gap-3">
                                                    <div style={{ flex: 1 }}>
                                                        <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                                            <h6 className="mb-0 fw-bold">{reqDoc.documentType || "Requested Document"}</h6>
                                                            {reqDoc.priority && (
                                                                <span className="badge" style={{
                                                                    backgroundColor: reqDoc.priority === "urgent" || reqDoc.priority === "high" ? "#fee2e2" : reqDoc.priority === "medium" ? "#fef3c7" : "#e0e7ff",
                                                                    color: reqDoc.priority === "urgent" || reqDoc.priority === "high" ? "#dc2626" : reqDoc.priority === "medium" ? "#d97706" : "#4f46e5",
                                                                    textTransform: "uppercase"
                                                                }}>
                                                                    {reqDoc.priority} Priority
                                                                </span>
                                                            )}
                                                            {reqDoc.deadline && (
                                                                <span style={{ fontSize: "12px", color: "#e11d48", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                                                                    <FaHourglass size={10} /> Due: {new Date(reqDoc.deadline).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {reqDoc.message ? (
                                                            <div style={{ background: "#f8f9fa", padding: "8px 12px", borderRadius: "6px", borderLeft: "3px solid #ffbc34", fontSize: "13px", color: "#555", marginTop: "8px" }}>
                                                                <strong>Note from Accountant:</strong> {reqDoc.message}
                                                            </div>
                                                        ) : (
                                                            <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>Your accountant has requested this document to proceed.</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <button 
                                                            className="btn btn-sm text-white fw-bold d-flex align-items-center gap-2"
                                                            style={{ background: "#ffbc34", border: "none", borderRadius: "8px", padding: "8px 20px" }}
                                                            onClick={() => {
                                                                setSelectedUploadType(reqDoc.documentType);
                                                                setShowUploadModal(true);
                                                            }}
                                                        >
                                                            <FaCloudUploadAlt /> Upload
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {completedDocs.length > 0 && <h6 className="fw-bold mb-3 mt-2 pb-2 border-bottom" style={{ color: "#2c3e50" }}>Uploaded Documents</h6>}

                                {(!completedDocs || completedDocs.length === 0) ? (
                                    <div className="text-center py-4 text-muted">
                                        <FaFilePdf size={32} color="#ccc" className="mb-2" />
                                        <p className="mb-0">No documents uploaded for this tax return yet.</p>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-4">
                                        {/* User Uploaded Documents */}
                                        {userUploadedDocs.length > 0 && (
                                            <div className="mb-4">
                                                <h6 className="mb-3 text-muted" style={{ fontSize: "14px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Uploaded by You</h6>
                                                <div className="already_uploads">
                                                    {userUploadedDocs.map(doc => {
                                                        let downloadUrl = doc.cloudinaryUrl;
                                                        if (downloadUrl && !downloadUrl.match(/\.[a-zA-Z0-9]+$/)) {
                                                            if (doc.mimeType?.includes('pdf')) downloadUrl += '.pdf';
                                                            else if (doc.mimeType?.includes('image/jpeg')) downloadUrl += '.jpg';
                                                            else if (doc.mimeType?.includes('image/png')) downloadUrl += '.png';
                                                        }

                                                        const docTypes = {
                                                            "bank_statement": "Bank Statements",
                                                            "invoice": "Invoices / Receipts",
                                                            "identity": "Identity Document",
                                                            "vat_certificate": "VAT Certificate",
                                                            "p60_p45": "P60 / P45",
                                                            "general": "Other / General",
                                                            "draft_return": "Draft Return",
                                                            "final_certificate": "Final Certificate",
                                                            "Subscription Agreement": "Subscription Agreement",
                                                            "Address Proof": "Address Proof",
                                                            "Income Proof": "Income Proof"
                                                        };
                                                        let typLabel = docTypes[doc.documentType] || doc.documentType || "Document";
                                                        
                                                        // Infer type from filename if it's just 'Onboarding Document'
                                                        if (typLabel === "Onboarding Document") {
                                                            const fname = (doc.originalFileName || "").toLowerCase();
                                                            if (fname.includes("subscription") || fname.includes("agreement")) typLabel = "Subscription Agreement";
                                                            else if (fname.includes("id") || fname.includes("passport") || fname.includes("license")) typLabel = "Identity Document";
                                                            else if (fname.includes("address") || fname.includes("bill") || fname.includes("statement")) typLabel = "Address Proof";
                                                        }

                                                        return (
                                                            <div className="after_upload h-100" key={doc.id} style={{ borderLeft: "4px solid #37a267" }}>
                                                                <div className="doc_dtls_prt overflow-hidden w-100">
                                                                    <figure className="mb-0 flex-shrink-0">
                                                                        <img src="/images/pdf.png" alt="doc" />
                                                                    </figure>
                                                                    <div className="doc_dtls overflow-hidden w-100" style={{ minWidth: 0 }}>
                                                                        <h6 title={doc.originalFileName} className="mb-0">{doc.originalFileName}</h6>
                                                                        <span className="size_kb d-block text-truncate w-100" title={`${(doc.fileSize / 1024).toFixed(1)} KB • ${typLabel}`}>{(doc.fileSize / 1024).toFixed(1)} KB • <span className="text-muted fw-semibold">{typLabel}</span></span>
                                                                    </div>
                                                                </div>
                                                                <div className="upload_cntrol ms-2 flex-shrink-0">
                                                                    <a className="upload_cntrls_btn d-flex align-items-center justify-content-center" href={downloadUrl} target="_blank" rel="noreferrer" title="Download Document">
                                                                        <FaDownload size={18} className="text-secondary" />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Accountant Uploaded Documents */}
                                        {accountantUploadedDocs.length > 0 && (
                                            <div>
                                                <h6 className="mb-3 text-muted" style={{ fontSize: "14px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sent by Accountant</h6>
                                                <div className="already_uploads">
                                                    {accountantUploadedDocs.map(doc => {
                                                        let downloadUrl = doc.cloudinaryUrl;
                                                        if (downloadUrl && !downloadUrl.match(/\.[a-zA-Z0-9]+$/)) {
                                                            if (doc.mimeType?.includes('pdf')) downloadUrl += '.pdf';
                                                            else if (doc.mimeType?.includes('image/jpeg')) downloadUrl += '.jpg';
                                                            else if (doc.mimeType?.includes('image/png')) downloadUrl += '.png';
                                                        }

                                                        const docTypes = {
                                                            "bank_statement": "Bank Statements",
                                                            "invoice": "Invoices / Receipts",
                                                            "identity": "Identity Document",
                                                            "vat_certificate": "VAT Certificate",
                                                            "p60_p45": "P60 / P45",
                                                            "general": "Other / General",
                                                            "draft_return": "Draft Return",
                                                            "final_certificate": "Final Certificate"
                                                        };
                                                        let typLabel = docTypes[doc.documentType] || doc.documentType || "Document";

                                                        return (
                                                            <div className="after_upload h-100" key={doc.id} style={{ borderLeft: "4px solid #3498db" }}>
                                                                <div className="doc_dtls_prt overflow-hidden w-100">
                                                                    <figure className="mb-0 flex-shrink-0">
                                                                        <img src="/images/pdf.png" alt="doc" />
                                                                    </figure>
                                                                    <div className="doc_dtls overflow-hidden w-100" style={{ minWidth: 0 }}>
                                                                        <h6 title={doc.originalFileName} className="mb-0">{doc.originalFileName}</h6>
                                                                        <span className="size_kb d-block text-truncate w-100" title={`${(doc.fileSize / 1024).toFixed(1)} KB • ${typLabel}`}>{(doc.fileSize / 1024).toFixed(1)} KB • <span className="text-muted fw-semibold">{typLabel}</span></span>
                                                                    </div>
                                                                </div>
                                                                <div className="upload_cntrol ms-2 flex-shrink-0">
                                                                    <a className="upload_cntrls_btn d-flex align-items-center justify-content-center" href={downloadUrl} target="_blank" rel="noreferrer" title="Download Document">
                                                                        <FaDownload size={18} className="text-secondary" />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* Next Steps Banner */}
                    <div className="mtd-info-card" style={{ borderLeft: "5px solid #3498db" }}>
                        <div className="card-label"><FaArrowRight style={{ color: "#3498db", fontSize: "16px" }} /> Next Steps</div>
                        {currentIndex <= 1 && (
                            <p style={{ margin: 0, color: "#555", fontSize: "15px" }}>
                                Please upload any required documents via the <strong>Upload Documents</strong> tab so our accountant can begin preparation.
                            </p>
                        )}
                        {currentIndex === 2 && (
                            <p style={{ margin: 0, color: "#555", fontSize: "15px" }}>
                                Your tax return preparation is in progress. We'll notify you once the draft is ready for review.
                            </p>
                        )}
                        {currentIndex === 3 && (
                            <div className="mt-2">
                                <p style={{ margin: 0, color: "#555", fontSize: "15px", marginBottom: "12px" }}>
                                    {currentStatus === "approved" 
                                        ? "Your draft is approved! We are preparing the final certificate for your records."
                                        : "Your draft is ready! Please review it to ensure everything is correct before final submission."}
                                </p>
                                {currentStatus === "draft_ready" && (
                                    <button 
                                        onClick={() => setShowDraftModal(true)} 
                                        className="btn btn-primary d-inline-flex align-items-center gap-2 fw-bold px-4"
                                        style={{ borderRadius: "50px", background: "linear-gradient(135deg, #3498db, #2980b9)", border: "none" }}
                                    >
                                        <FaSearch /> Review Your Draft
                                    </button>
                                )}
                            </div>
                        )}
                        {currentIndex === 4 && (
                            <div className="mt-2">
                                <p style={{ margin: 0, color: "#555", fontSize: "15px", marginBottom: "12px" }}>
                                    Final documents have been submitted to tax authorities. Awaiting final confirmation.
                                </p>
                                <button 
                                    onClick={() => setShowFinalModal(true)} 
                                    className="btn btn-success d-inline-flex align-items-center gap-2 fw-bold px-4 mt-2"
                                    style={{ borderRadius: "50px", background: "linear-gradient(135deg, #27ae60, #2ecc71)", border: "none" }}
                                >
                                    <FaCertificate /> View Final Certificate
                                </button>
                            </div>
                        )}
                        {currentIndex === 5 && (
                            <div className="mt-2">
                                <p style={{ margin: 0, color: "#27ae60", fontWeight: 600, fontSize: "15px", marginBottom: "12px" }}>
                                    🎉 Your MTD compliance is fully completed! Thank you for using TaxSimba.
                                </p>
                                <div className="d-flex gap-3 mb-4">
                                    <button 
                                        onClick={() => setShowFinalModal(true)} 
                                        className="btn btn-success d-inline-flex align-items-center gap-2 fw-bold px-4"
                                        style={{ borderRadius: "50px", background: "linear-gradient(135deg, #27ae60, #2ecc71)", border: "none" }}
                                    >
                                        <FaCertificate /> View Final Certificate
                                    </button>

                                </div>
                                
                                <div className="mt-4 pt-4 border-top">
                                    <h6 className="fw-bold mb-2" style={{ color: "#2c3e50" }}>Rate your Accountant</h6>
                                    <p className="text-muted mb-0" style={{ fontSize: "14px" }}>Share your experience with {accountant?.name || "your accountant"} to help us improve our services.</p>
                                    <ReviewBox 
                                        file={{ taxReturn: overview?.taxReturn, accountant: overview?.accountant }} 
                                        token={session?.accessToken} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {showDraftModal && overview?.taxReturn && (
                        <DraftReviewModal 
                            show={showDraftModal}
                            onHide={() => setShowDraftModal(false)}
                            session={session}
                            taxReturnId={overview.taxReturn.id}
                            onSuccess={fetchOverview}
                        />
                    )}
                    
                    {showFinalModal && overview?.taxReturn && (
                        <FinalCertificateModal 
                            show={showFinalModal}
                            onHide={() => setShowFinalModal(false)}
                            session={session}
                            taxReturnId={overview.taxReturn.id}
                        />
                    )}

                    {showNewReturnModal && (
                        <NewTaxReturnModal 
                            show={showNewReturnModal}
                            onHide={() => setShowNewReturnModal(false)}
                            session={session}
                            onSuccess={fetchOverview}
                        />
                    )}

                    {showUploadModal && overview?.taxReturn && (
                        <UploadCurrentTaxDocumentModal 
                            show={showUploadModal}
                            onHide={() => {
                                setShowUploadModal(false);
                                setSelectedUploadType("general");
                            }}
                            session={session}
                            taxReturnId={overview.taxReturn.id}
                            onSuccess={fetchOverview}
                            initialType={selectedUploadType}
                        />
                    )}

                    {showChatModal && overview?.taxReturn && accountant && (
                        <Modal className="main-modal" show={showChatModal} onHide={() => setShowChatModal(false)} size="lg" centered>
                            <Modal.Header closeButton style={{ background: "#0d2b1e", borderBottom: "1px solid rgba(55, 162, 103,0.2)" }}>
                                <Modal.Title style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>
                                    <IoChatbubbles className="me-2" style={{ color: "#37a267" }} />
                                    Tax Return Chat
                                </Modal.Title>
                            </Modal.Header>
                            <Modal.Body style={{ padding: "24px" }}>
                                <MtdMessages 
                                    session={session} 
                                    accountantInfo={accountant} 
                                    taxReturnDbId={overview.taxReturn.id} 
                                />
                            </Modal.Body>
                        </Modal>
                    )}
                </>
            )}
        </div>
    );
}
