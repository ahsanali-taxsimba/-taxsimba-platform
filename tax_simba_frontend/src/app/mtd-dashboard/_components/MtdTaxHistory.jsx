import React, { useState, useEffect } from "react";
import axios from "axios";
import { Badge, Accordion, Card, Spinner } from "react-bootstrap";
import { FaFileInvoiceDollar, FaRegCalendarAlt, FaUserTie, FaCheckCircle, FaSpinner, FaFilePdf, FaDownload } from "react-icons/fa";
import toast from "react-hot-toast";
import { formatQuarterDisplay } from "@/utils/commonHelper";

/**
 * Quarterly History — authoritative mtd_periods from dashboard-overview.
 * Never invents quarters. Empty → HTTP-equivalent empty UI (no crash).
 */
export default function MtdTaxHistory({ session }) {
    const [periods, setPeriods] = useState([]);
    const [packageName, setPackageName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [entitlementOnly, setEntitlementOnly] = useState(false);

    useEffect(() => {
        if (session?.accessToken) fetchTaxHistory();
    }, [session]);

    const fetchTaxHistory = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}mtd/dashboard-overview`,
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            const data = res.data?.data || {};
            setEntitlementOnly(Boolean(data.entitlementOnly));
            setPackageName(data.packageName || data.packageCode || null);
            const rows = Array.isArray(data.periods) ? [...data.periods] : [];
            rows.sort((a, b) => {
                const aq = Number(a.quarter ?? (a.kind === "FINAL_DECLARATION" ? 99 : 0));
                const bq = Number(b.quarter ?? (b.kind === "FINAL_DECLARATION" ? 99 : 0));
                return aq - bq;
            });
            setPeriods(rows);
        } catch (error) {
            console.error("Error fetching tax history", error);
            // Prefer empty state over a hard crash / inventing data.
            setPeriods([]);
            toast.error("Failed to load quarterly history.");
        } finally {
            setLoading(false);
        }
    };

    const formatDays = (days) => {
        if (days == null || !Number.isFinite(Number(days))) return null;
        const n = Number(days);
        if (n < 0) return `Overdue by ${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"}`;
        if (n === 0) return "Due today";
        return `${n} day${n === 1 ? "" : "s"} remaining`;
    };

    const getStatusBadge = (status) => {
        const s = String(status || "").toUpperCase();
        if (s === "SUBMITTED") {
            return <Badge bg="success" className="px-3 py-2"><FaCheckCircle /> Submitted</Badge>;
        }
        if (s.includes("APPROVED")) {
            return <Badge bg="info" className="px-3 py-2">Approved</Badge>;
        }
        if (s.includes("AWAITING") || s.includes("REVIEW")) {
            return <Badge bg="warning" text="dark" className="px-3 py-2">In review</Badge>;
        }
        if (s.includes("PROGRESS")) {
            return <Badge bg="primary" className="px-3 py-2">In Progress</Badge>;
        }
        return <Badge bg="light" text="dark" className="px-3 py-2 border">{status || "Not started"}</Badge>;
    };

    if (loading) {
        return (
            <div className="dashboard_card p-5 text-center">
                <Spinner animation="border" style={{ color: "#37a267" }} />
                <p className="mt-3 text-muted">Loading your quarterly history...</p>
            </div>
        );
    }

    if (entitlementOnly || periods.length === 0) {
        return (
            <div className="dashboard_card p-5 text-center" data-testid="mtd-quarterly-history-empty">
                <FaFileInvoiceDollar size={48} color="#ccc" className="mb-3" />
                <h4>No quarterly history available yet</h4>
                <p className="text-muted mb-0">
                    {entitlementOnly
                        ? "Your MTD service is active. Quarterly obligations will appear here after your application creates an operational case."
                        : "No quarterly obligation records are available for this tax year yet."}
                </p>
                {packageName && (
                    <p className="text-muted mt-2" style={{ fontSize: 13 }}>Package: {packageName}</p>
                )}
            </div>
        );
    }

    return (
        <div className="dashboard_card p-4" data-testid="mtd-quarterly-history">
            <h4 className="fw-bold mb-4" style={{ color: "#2c3e50" }}>Quarterly History</h4>
            <Accordion defaultActiveKey="0">
                {periods.map((period, index) => {
                    const label =
                        period.label ||
                        (period.kind === "FINAL_DECLARATION"
                            ? "Final Declaration"
                            : period.quarter
                              ? `Q${period.quarter}`
                              : `Period ${index + 1}`);
                    const daysText = formatDays(period.daysToDeadline);
                    const overdue = period.deadlineWarning === "OVERDUE" || (period.daysToDeadline != null && period.daysToDeadline < 0);

                    return (
                        <Accordion.Item eventKey={index.toString()} key={period.id || label} className="mb-3 border rounded shadow-sm">
                            <Accordion.Header>
                                <div className="d-flex w-100 justify-content-between align-items-center pe-3 flex-wrap gap-3">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="p-2 rounded bg-light border">
                                            <FaRegCalendarAlt size={24} color="#37a267" />
                                        </div>
                                        <div>
                                            <h6 className="mb-0 fw-bold">
                                                {formatQuarterDisplay(label)}
                                            </h6>
                                            <small className="text-muted">
                                                {period.periodStart && period.periodEnd
                                                    ? `${period.periodStart} → ${period.periodEnd}`
                                                    : period.kind || "MTD period"}
                                            </small>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center gap-3">
                                        {getStatusBadge(period.status)}
                                    </div>
                                </div>
                            </Accordion.Header>
                            <Accordion.Body>
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <div className="text-muted" style={{ fontSize: 12 }}>Deadline</div>
                                        <div className="fw-semibold">
                                            {period.deadline
                                                ? new Date(period.deadline).toLocaleDateString("en-GB", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                  })
                                                : "—"}
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="text-muted" style={{ fontSize: 12 }}>Days</div>
                                        <div className={`fw-semibold ${overdue ? "text-danger" : ""}`}>
                                            {daysText || "—"}
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="text-muted" style={{ fontSize: 12 }}>Status</div>
                                        <div className="fw-semibold">{period.status || "—"}</div>
                                    </div>
                                </div>
                            </Accordion.Body>
                        </Accordion.Item>
                    );
                })}
            </Accordion>
        </div>
    );
}
