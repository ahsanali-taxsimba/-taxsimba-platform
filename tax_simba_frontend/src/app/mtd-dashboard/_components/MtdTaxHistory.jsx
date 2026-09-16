import React, { useState, useEffect } from "react";
import axios from "axios";
import { Badge, Accordion, Card, Spinner } from "react-bootstrap";
import { FaFileInvoiceDollar, FaRegCalendarAlt, FaUserTie, FaCheckCircle, FaSpinner, FaFilePdf, FaDownload } from "react-icons/fa";
import toast from "react-hot-toast";
import ReviewBox from "@/components/re-used/ReviewBox";
import { formatQuarterDisplay } from "@/utils/commonHelper";

export default function MtdTaxHistory({ session }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.accessToken) fetchTaxHistory();
    }, [session]);

    const fetchTaxHistory = async () => {
        setLoading(true);
        try {
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/all-tax-returns`,
                {},
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            // Sort by taxYear descending or id descending
            const data = res.data?.data || [];
            data.sort((a, b) => b.taxReturn.id - a.taxReturn.id);
            setHistory(data);
        } catch (error) {
            console.error("Error fetching tax history", error);
            toast.error("Failed to load tax history.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "completed":
                return <Badge bg="success" className="px-3 py-2"><FaCheckCircle /> Completed</Badge>;
            case "final_submitted":
            case "submitted":
                return <Badge bg="info" className="px-3 py-2"><FaSpinner /> Awaiting Confirmation</Badge>;
            case "draft_ready":
            case "client_review":
                return <Badge bg="warning" text="dark" className="px-3 py-2">Client Review</Badge>;
            case "preparation_started":
            case "in_progress":
                return <Badge bg="primary" className="px-3 py-2">In Progress</Badge>;
            case "assigned":
                return <Badge bg="secondary" className="px-3 py-2">Assigned</Badge>;
            case "pending_assignment":
                return <Badge bg="light" text="dark" className="px-3 py-2 border">Pending Assignment</Badge>;
            default:
                return <Badge bg="light" text="dark" className="px-3 py-2 border">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="dashboard_card p-5 text-center">
                <Spinner animation="border" style={{ color: "#37a267" }} />
                <p className="mt-3 text-muted">Loading your tax history...</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="dashboard_card p-5 text-center">
                <FaFileInvoiceDollar size={48} color="#ccc" className="mb-3" />
                <h4>No Tax History Found</h4>
                <p className="text-muted">You have not submitted any tax returns yet.</p>
            </div>
        );
    }

    return (
        <div className="dashboard_card p-4">
            <h4 className="fw-bold mb-4" style={{ color: "#2c3e50" }}>Tax Return History</h4>
            
            <Accordion defaultActiveKey="0">
                {history.map((record, index) => {
                    const { taxReturn, accountant, finalCertificate, files } = record;
                    
                    return (
                        <Accordion.Item eventKey={index.toString()} key={taxReturn.id} className="mb-3 border rounded shadow-sm">
                            <Accordion.Header>
                                <div className="d-flex w-100 justify-content-between align-items-center pe-3 flex-wrap gap-3">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="p-2 rounded bg-light border">
                                            <FaRegCalendarAlt size={24} color="#37a267" />
                                        </div>
                                        <div>
                                            <h6 className="mb-0 fw-bold">Tax Year {taxReturn.taxYear} {taxReturn.mtdQuarter && <Badge bg="info" className="ms-2">{taxReturn.mtdQuarter}</Badge>}</h6>
                                            <small className="text-muted">Ref: {taxReturn.taxReturnId}</small>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center gap-4">
                                        <span className="d-none d-md-inline-block text-muted">
                                            {taxReturn.mtdQuarter ? formatQuarterDisplay(taxReturn.mtdQuarter) : (taxReturn.taxType || "Standard Return")}
                                        </span>
                                        {getStatusBadge(taxReturn.status)}
                                    </div>
                                </div>
                            </Accordion.Header>
                            <Accordion.Body className="bg-light">
                                <div className="row g-4">
                                    {/* Left Column: Details */}
                                    <div className="col-md-6">
                                        <Card className="border-0 shadow-sm h-100">
                                            <Card.Body>
                                                <h6 className="fw-bold border-bottom pb-2 mb-3">Return Details</h6>
                                                <ul className="list-unstyled mb-0" style={{ fontSize: "14px", lineHeight: "2" }}>
                                                    <li><strong>Type:</strong> {taxReturn.mtdQuarter ? formatQuarterDisplay(taxReturn.mtdQuarter) : taxReturn.taxType}</li>
                                                    <li>
                                                        <strong>Accountant:</strong>{" "}
                                                        {accountant?.isAssigned ? (
                                                            <span className="text-primary"><FaUserTie /> {accountant.name}</span>
                                                        ) : (
                                                            <span className="text-muted">Not assigned yet</span>
                                                        )}
                                                    </li>
                                                </ul>
                                            </Card.Body>
                                        </Card>
                                    </div>

                                    {/* Right Column: Final Certificate (if completed) */}
                                    <div className="col-md-6">
                                        <Card className="border-0 shadow-sm h-100">
                                            <Card.Body>
                                                <h6 className="fw-bold border-bottom pb-2 mb-3">Final Deliverables</h6>
                                                {finalCertificate ? (
                                                    <div className="d-flex align-items-center justify-content-between p-2 border rounded" style={{ backgroundColor: "#f8fdfa", borderColor: "#27ae60" }}>
                                                        <div className="d-flex align-items-center gap-2 overflow-hidden w-100 me-2">
                                                            <FaFilePdf size={24} color="#e11d48" className="flex-shrink-0" />
                                                            <div className="overflow-hidden w-100">
                                                                <div className="fw-bold text-dark text-truncate" style={{ fontSize: "13px" }} title={finalCertificate.filename}>
                                                                    {finalCertificate.filename}
                                                                </div>
                                                                <small className="text-muted" style={{ fontSize: "11px" }}>
                                                                    {(finalCertificate.fileSize / 1024).toFixed(1)} KB
                                                                </small>
                                                            </div>
                                                        </div>
                                                        <a 
                                                            href={finalCertificate.downloadUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="btn btn-sm btn-success d-flex align-items-center gap-1"
                                                        >
                                                            <FaDownload size={12} /> Get
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div className="text-muted" style={{ fontSize: "14px" }}>
                                                        {taxReturn.status === "completed" 
                                                            ? "Certificate unavailable." 
                                                            : "Your final certificate will appear here once the return is completed."}
                                                    </div>
                                                )}
                                            </Card.Body>
                                        </Card>
                                    </div>

                                    {/* Full Width: Uploaded Documents */}
                                    <div className="col-12">
                                        <Card className="border-0 shadow-sm">
                                            <Card.Body>
                                                <h6 className="fw-bold border-bottom pb-2 mb-3">
                                                    Uploaded Documents <Badge bg="secondary" className="ms-2">{files?.totalFiles || 0}</Badge>
                                                </h6>
                                                {files?.totalFiles > 0 ? (() => {
                                                    const currentUserId = session?.user?.id;
                                                    const userUploadedDocs = files.allFiles.filter(f => !f.uploadedBy || f.uploadedBy === currentUserId);
                                                    const accountantUploadedDocs = files.allFiles.filter(f => f.uploadedBy && f.uploadedBy !== currentUserId);

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

                                                    return (
                                                        <div className="d-flex flex-column gap-4">
                                                            {userUploadedDocs.length > 0 && (
                                                                <div>
                                                                    <h6 className="mb-3 text-muted" style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Uploaded by You</h6>
                                                                    <div className="already_uploads">
                                                                        {userUploadedDocs.map((file, idx) => {
                                                                            let downloadUrl = file.downloadUrl;
                                                                            const typLabel = docTypes[file.documentType] || file.documentType || "Document";
                                                                            return (
                                                                                <div className="after_upload h-100" key={file.id || idx} style={{ borderLeft: "4px solid #37a267" }}>
                                                                                    <div className="doc_dtls_prt overflow-hidden w-100">
                                                                                        <figure className="mb-0 flex-shrink-0">
                                                                                            <img src="/images/pdf.png" alt="doc" />
                                                                                        </figure>
                                                                                        <div className="doc_dtls overflow-hidden w-100" style={{ minWidth: 0 }}>
                                                                                            <h6 title={file.filename} className="mb-0">{file.filename}</h6>
                                                                                            <span className="size_kb d-block text-truncate w-100" title={`${(file.fileSize / 1024).toFixed(1)} KB • ${typLabel}`}>{(file.fileSize / 1024).toFixed(1)} KB • <span className="text-muted fw-semibold">{typLabel}</span></span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="upload_cntrol ms-2 flex-shrink-0">
                                                                                        <a className="upload_cntrls_btn d-flex align-items-center justify-content-center" href={downloadUrl} target="_blank" rel="noreferrer">
                                                                                            <FaDownload size={18} className="text-secondary" />
                                                                                        </a>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {accountantUploadedDocs.length > 0 && (
                                                                <div>
                                                                    <h6 className="mb-3 text-muted" style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sent by Accountant</h6>
                                                                    <div className="already_uploads">
                                                                        {accountantUploadedDocs.map(file => {
                                                                            let downloadUrl = file.downloadUrl;
                                                                            const typLabel = docTypes[file.documentType] || file.documentType || "Document";
                                                                            return (
                                                                                <div className="after_upload h-100" key={file.id} style={{ borderLeft: "4px solid #3498db" }}>
                                                                                    <div className="doc_dtls_prt overflow-hidden w-100">
                                                                                        <figure className="mb-0 flex-shrink-0">
                                                                                            <img src="/images/pdf.png" alt="doc" />
                                                                                        </figure>
                                                                                        <div className="doc_dtls overflow-hidden w-100" style={{ minWidth: 0 }}>
                                                                                            <h6 title={file.filename} className="mb-0">{file.filename}</h6>
                                                                                            <span className="size_kb d-block text-truncate w-100" title={`${(file.fileSize / 1024).toFixed(1)} KB • ${typLabel}`}>{(file.fileSize / 1024).toFixed(1)} KB • <span className="text-muted fw-semibold">{typLabel}</span></span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="upload_cntrol ms-2 flex-shrink-0">
                                                                                        <a className="upload_cntrls_btn d-flex align-items-center justify-content-center" href={downloadUrl} target="_blank" rel="noreferrer">
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
                                                    );
                                                })() : (
                                                    <p className="text-muted mb-0" style={{ fontSize: "14px" }}>No documents uploaded.</p>
                                                )}
                                            </Card.Body>
                                        </Card>
                                    </div>

                                    {taxReturn.status === "completed" && (
                                        <div className="col-12 mt-3 pt-4 border-top">
                                            <h6 className="fw-bold mb-2" style={{ color: "#2c3e50" }}>Rate your Accountant</h6>
                                            <p className="text-muted mb-3" style={{ fontSize: "14px" }}>Share your experience with {accountant?.name || "your accountant"} to help us improve our services.</p>
                                            <ReviewBox 
                                                file={{ taxReturn, accountant }} 
                                                token={session?.accessToken} 
                                            />
                                        </div>
                                    )}
                                </div>
                            </Accordion.Body>
                        </Accordion.Item>
                    );
                })}
            </Accordion>
            <style jsx>{`
                .hover-shadow:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1) !important;
                }
                .transition {
                    transition: all 0.2s ease-in-out;
                }
            `}</style>
        </div>
    );
}
