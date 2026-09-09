"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
    FaCheckCircle, FaHourglassHalf, FaFileUpload,
    FaClipboardCheck, FaFlagCheckered, FaTrophy
} from "react-icons/fa";

const COMPLIANCE_STEPS = [
    {
        key: "Incomplete",
        label: "Not Started",
        subLabel: "Awaiting document submission",
        icon: <FaHourglassHalf />,
        color: "#e74c3c",
        bg: "#fdf0ef",
    },
    {
        key: "Documents Submitted",
        label: "Documents Submitted",
        subLabel: "Your documents have been uploaded",
        icon: <FaFileUpload />,
        color: "#f39c12",
        bg: "#fef9ee",
    },
    {
        key: "Under Review",
        label: "Under Review",
        subLabel: "Our accountant is reviewing your documents",
        icon: <FaClipboardCheck />,
        color: "#3498db",
        bg: "#eaf4fb",
    },
    {
        key: "Filed",
        label: "Filed with HMRC",
        subLabel: "Your MTD return has been submitted to HMRC",
        icon: <FaFlagCheckered />,
        color: "#8e44ad",
        bg: "#f5eef8",
    },
    {
        key: "Completed",
        label: "Completed",
        subLabel: "Your MTD compliance is fully complete",
        icon: <FaTrophy />,
        color: "#27ae60",
        bg: "#eafaf1",
    },
];

export default function MtdComplianceStatus({ session }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.accessToken) fetchCompliance();
    }, [session]);

    const fetchCompliance = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}mtd/compliance`,
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setRecords(res.data?.data || []);
        } catch (err) {
            console.error("Error fetching compliance", err);
        } finally {
            setLoading(false);
        }
    };

    const currentRecord = records[0] || null;
    const currentStatus = currentRecord?.status || "Incomplete";
    const currentStepIdx = COMPLIANCE_STEPS.findIndex((s) => s.key === currentStatus);
    const effectiveIdx = currentStepIdx === -1 ? 0 : currentStepIdx;

    return (
        <div>
            <style>{`
                .mtd-comp-header { margin-bottom: 28px; }
                .mtd-comp-header h4 { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; }
                .mtd-comp-header p { color: #888; font-size: 14px; margin: 0; }

                .mtd-comp-banner {
                    border-radius: 20px;
                    padding: 28px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 28px;
                    border: 1px solid transparent;
                    transition: all 0.3s;
                }
                .mtd-comp-banner-icon {
                    width: 60px; height: 60px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 26px; flex-shrink: 0;
                    background: rgba(255,255,255,0.5);
                }
                .mtd-comp-banner-text h5 { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
                .mtd-comp-banner-text p { font-size: 14px; margin: 0; opacity: 0.75; }

                .mtd-comp-track { position: relative; margin-bottom: 32px; }

                /* Horizontal stepper */
                .mtd-stepper-h {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    position: relative;
                    padding: 0 8px;
                }
                .mtd-stepper-h::before {
                    content: '';
                    position: absolute;
                    top: 22px;
                    left: 40px;
                    right: 40px;
                    height: 3px;
                    background: #e8e8e8;
                    z-index: 0;
                }
                .mtd-progress-line {
                    position: absolute;
                    top: 22px;
                    left: 40px;
                    height: 3px;
                    background: linear-gradient(90deg, #37a267, #2e8a56);
                    z-index: 1;
                    transition: width 0.8s ease;
                }
                .mtd-step-h {
                    display: flex; flex-direction: column; align-items: center;
                    gap: 10px; flex: 1; position: relative; z-index: 2;
                }
                .mtd-step-h-dot {
                    width: 44px; height: 44px; border-radius: 50%;
                    border: 3px solid #e0e0e0;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 18px; background: #fff;
                    transition: all 0.4s; color: #ccc;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }
                .mtd-step-h-dot.done {
                    background: linear-gradient(135deg, #37a267, #2e8a56);
                    border-color: #37a267; color: #fff;
                    box-shadow: 0 4px 16px rgba(55, 162, 103, 0.4);
                }
                .mtd-step-h-dot.current {
                    background: #fff; border-color: #37a267; color: #37a267;
                    box-shadow: 0 0 0 5px rgba(55, 162, 103, 0.15), 0 4px 16px rgba(55, 162, 103, 0.25);
                    animation: pulse-dot 2s infinite;
                }
                @keyframes pulse-dot {
                    0%   { box-shadow: 0 0 0 5px rgba(55, 162, 103,0.15), 0 4px 16px rgba(55, 162, 103,0.25); }
                    50%  { box-shadow: 0 0 0 10px rgba(55, 162, 103,0.08), 0 4px 16px rgba(55, 162, 103,0.3); }
                    100% { box-shadow: 0 0 0 5px rgba(55, 162, 103,0.15), 0 4px 16px rgba(55, 162, 103,0.25); }
                }
                .mtd-step-h-label {
                    font-size: 11px; font-weight: 700; text-align: center;
                    color: #bbb; text-transform: uppercase; letter-spacing: 0.5px;
                    max-width: 80px; line-height: 1.3;
                }
                .mtd-step-h-label.done, .mtd-step-h-label.current { color: #2e8a56; }

                /* Detail card */
                .mtd-comp-detail-card {
                    background: #fff; border-radius: 18px;
                    padding: 24px; border: 1px solid #f0f0f0;
                    box-shadow: 0 2px 16px rgba(0,0,0,0.05);
                    margin-bottom: 20px;
                }
                .mtd-comp-detail-card h6 {
                    font-size: 13px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 1px; color: #aaa; margin-bottom: 16px;
                }

                .mtd-step-list { display: flex; flex-direction: column; gap: 14px; }
                .mtd-step-list-item {
                    display: flex; align-items: center; gap: 14px; padding: 14px 18px;
                    border-radius: 14px; background: #fafafa;
                    border: 1px solid #f0f0f0; transition: all 0.3s;
                }
                .mtd-step-list-item.done-item { background: #f0faf5; border-color: rgba(55, 162, 103,0.2); }
                .mtd-step-list-item.current-item { background: #f0faf5; border-color: #37a267;
                    box-shadow: 0 2px 12px rgba(55, 162, 103,0.15); }
                .mtd-step-list-icon {
                    width: 40px; height: 40px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 17px; flex-shrink: 0;
                }
                .mtd-step-list-text { flex: 1; }
                .mtd-step-list-title { font-size: 14px; font-weight: 700; color: #222; margin-bottom: 2px; }
                .mtd-step-list-sub { font-size: 12px; color: #aaa; }
                .mtd-step-check { font-size: 18px; color: #37a267; flex-shrink: 0; }

                .mtd-tax-year-card {
                    background: linear-gradient(135deg, #0d2b1e 0%, #1a4a32 100%);
                    border-radius: 18px; padding: 24px;
                    display: flex; justify-content: space-between; align-items: center;
                    color: #fff;
                }
                .mtd-tax-year-card h6 { font-size: 12px; color: rgba(255,255,255,0.55); text-transform: uppercase;
                    letter-spacing: 1px; margin-bottom: 6px; }
                .mtd-tax-year-card .year-val { font-size: 26px; font-weight: 900; }
                .mtd-tax-year-badge {
                    padding: 8px 18px; border-radius: 50px; font-size: 13px; font-weight: 700;
                    background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
                    color: #fff;
                }

                @media (max-width: 576px) {
                    .mtd-stepper-h { flex-direction: column; align-items: flex-start; gap: 0; }
                    .mtd-stepper-h::before { display: none; }
                    .mtd-progress-line { display: none; }
                    .mtd-step-h { flex-direction: row; align-items: center; gap: 14px; padding: 10px 0; }
                    .mtd-step-h-label { text-align: left; max-width: none; font-size: 13px; }
                }
            `}</style>

            <div className="mtd-comp-header">
                <h4>Compliance Status</h4>
                <p>Track the progress of your MTD compliance journey from document submission to HMRC filing.</p>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border theme-color" role="status" />
                </div>
            ) : (
                <>
                    {/* Status Banner */}
                    {(() => {
                        const s = COMPLIANCE_STEPS[effectiveIdx];
                        return (
                            <div className="mtd-comp-banner" style={{ background: s.bg, borderColor: s.color + "33" }}>
                                <div className="mtd-comp-banner-icon" style={{ color: s.color }}>
                                    {s.icon}
                                </div>
                                <div className="mtd-comp-banner-text">
                                    <h5 style={{ color: s.color }}>Current Status: {s.label}</h5>
                                    <p style={{ color: s.color }}>{s.subLabel}</p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Horizontal Progress Tracker */}
                    <div className="mtd-comp-detail-card">
                        <h6>Progress Tracker</h6>
                        <div className="mtd-comp-track">
                            <div className="mtd-stepper-h">
                                {/* Animated progress line */}
                                <div
                                    className="mtd-progress-line"
                                    style={{
                                        width: effectiveIdx === 0
                                            ? "0%"
                                            : `${((effectiveIdx) / (COMPLIANCE_STEPS.length - 1)) * 100}%`,
                                    }}
                                />
                                {COMPLIANCE_STEPS.map((step, idx) => {
                                    const isDone = idx < effectiveIdx;
                                    const isCurrent = idx === effectiveIdx;
                                    return (
                                        <div className="mtd-step-h" key={step.key}>
                                            <div className={`mtd-step-h-dot ${isDone ? "done" : isCurrent ? "current" : ""}`}>
                                                {isDone ? <FaCheckCircle size={18} /> : step.icon}
                                            </div>
                                            <div className={`mtd-step-h-label ${isDone || isCurrent ? "done" : ""}`}>
                                                {step.label}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Detailed step list */}
                    <div className="mtd-comp-detail-card">
                        <h6>Step Details</h6>
                        <div className="mtd-step-list">
                            {COMPLIANCE_STEPS.map((step, idx) => {
                                const isDone = idx < effectiveIdx;
                                const isCurrent = idx === effectiveIdx;
                                return (
                                    <div
                                        key={step.key}
                                        className={`mtd-step-list-item ${isDone ? "done-item" : isCurrent ? "current-item" : ""}`}
                                    >
                                        <div
                                            className="mtd-step-list-icon"
                                            style={{
                                                background: isDone
                                                    ? "rgba(55, 162, 103,0.12)"
                                                    : isCurrent
                                                        ? "rgba(55, 162, 103,0.08)"
                                                        : "#f0f0f0",
                                                color: isDone ? "#37a267" : isCurrent ? step.color : "#ccc",
                                            }}
                                        >
                                            {isDone ? <FaCheckCircle /> : step.icon}
                                        </div>
                                        <div className="mtd-step-list-text">
                                            <div className="mtd-step-list-title" style={{ color: isDone || isCurrent ? "#111" : "#bbb" }}>
                                                {step.label}
                                            </div>
                                            <div className="mtd-step-list-sub">{step.subLabel}</div>
                                        </div>
                                        {isDone && <FaCheckCircle className="mtd-step-check" />}
                                        {isCurrent && (
                                            <span style={{ fontSize: 11, fontWeight: 700, color: "#37a267",
                                                background: "rgba(55, 162, 103,0.1)", padding: "4px 10px",
                                                borderRadius: 50, whiteSpace: "nowrap" }}>
                                                In Progress
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tax Year Card */}
                    {currentRecord && (
                        <div className="mtd-tax-year-card">
                            <div>
                                <h6>Tax Year</h6>
                                <div className="year-val">
                                    {currentRecord.taxYear} / {parseInt(currentRecord.taxYear) + 1}
                                </div>
                            </div>
                            <div className="mtd-tax-year-badge">
                                {currentRecord.submissionDate
                                    ? `Submitted: ${new Date(currentRecord.submissionDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                                    : "Not yet submitted"}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
