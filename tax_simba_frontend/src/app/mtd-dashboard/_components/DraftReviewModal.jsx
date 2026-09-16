import React, { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Form, Spinner, Alert, Badge } from "react-bootstrap";
import { FaFilePdf, FaCheck, FaExclamationTriangle, FaTimes, FaDownload } from "react-icons/fa";
import toast from "react-hot-toast";

export default function DraftReviewModal({ show, onHide, session, taxReturnId, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [draftDetails, setDraftDetails] = useState(null);
    const [action, setAction] = useState(null); // 'approve', 'request_changes', 'reject'
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (show && taxReturnId && session?.accessToken) {
            fetchDraftDetails();
            // Reset state
            setAction(null);
            setNotes("");
        }
    }, [show, taxReturnId, session]);

    const fetchDraftDetails = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}client/drafts/${taxReturnId}`,
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setDraftDetails(res.data?.data);
        } catch (error) {
            console.error("Error fetching draft details", error);
            toast.error(error.response?.data?.message || "Failed to load draft details");
            onHide();
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (action === "reject" && !notes.trim()) {
            return toast.error("Please provide a reason for rejection.");
        }
        if (action === "request_changes" && !notes.trim()) {
            return toast.error("Please detail the changes you'd like to request.");
        }

        setSubmitting(true);
        try {
            let endpoint = "";
            let payload = {};

            if (action === "approve") {
                endpoint = `client/drafts/${taxReturnId}/approve`;
                payload = { approvalNotes: notes };
            } else if (action === "request_changes") {
                endpoint = `client/drafts/${taxReturnId}/request-changes`;
                // endpoint expects changeRequests as an array
                payload = { changeRequests: notes.split('\n').filter(n => n.trim() !== "") };
            } else if (action === "reject") {
                endpoint = `client/drafts/${taxReturnId}/reject`;
                payload = { rejectionReason: notes };
            }

            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
                payload,
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );

            toast.success(res.data?.message || "Action processed successfully!");
            onHide();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error submitting action", error);
            toast.error(error.response?.data?.message || "Failed to submit your feedback");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !draftDetails) {
        return (
            <Modal show={show} onHide={onHide} centered>
                <Modal.Body className="text-center py-5">
                    <Spinner animation="border" style={{ color: "#37a267" }} />
                    <p className="mt-3 text-muted">Loading draft details...</p>
                </Modal.Body>
            </Modal>
        );
    }

    const { taxReturn, documents } = draftDetails;
    const draftDocs = documents?.draftDocuments || [];

    return (
        <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title>
                    Review Your Tax Return Draft <Badge bg="secondary">{taxReturn?.taxYear}</Badge>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="mb-4">
                    <h6 className="fw-bold">Accountant Notes:</h6>
                    <div className="p-3 rounded bg-light border" style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>
                        {taxReturn?.accountantNotes || "No specific notes provided by the accountant."}
                    </div>
                </div>

                <div className="mb-4">
                    <h6 className="fw-bold">Draft Documents:</h6>
                    {draftDocs.length > 0 ? (
                        <div className="d-flex flex-column gap-2">
                            {draftDocs.map(doc => (
                                <div key={doc.id} className="d-flex align-items-center justify-content-between p-3 border rounded shadow-sm">
                                    <div className="d-flex align-items-center gap-3">
                                        <FaFilePdf size={28} color="#e11d48" />
                                        <div>
                                            <div className="fw-bold">{doc.filename}</div>
                                            <small className="text-muted">
                                                {(doc.fileSize / 1024).toFixed(1)} KB • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                                            </small>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                                        onClick={async () => {
                                            try {
                                                let fileUrl = doc.downloadUrl;
                                                if (!fileUrl) throw new Error("Missing download URL");
                                                const headers = {
                                                    Authorization: `Bearer ${session.accessToken}`,
                                                };
                                                if (!/^https?:\/\//i.test(fileUrl)) {
                                                    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
                                                    fileUrl = `${apiBase}${String(fileUrl).replace(/^\//, "")}`;
                                                }
                                                const fileRes = await fetch(fileUrl, { headers });
                                                if (!fileRes.ok) throw new Error("Download failed");
                                                const blob = await fileRes.blob();
                                                const blobUrl = URL.createObjectURL(blob);
                                                const a = document.createElement("a");
                                                a.href = blobUrl;
                                                a.download = doc.filename || "draft.pdf";
                                                document.body.appendChild(a);
                                                a.click();
                                                a.remove();
                                                URL.revokeObjectURL(blobUrl);
                                            } catch (err) {
                                                toast.error(err?.message || "Download failed");
                                            }
                                        }}
                                    >
                                        <FaDownload /> Download
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Alert variant="warning">No draft documents found.</Alert>
                    )}
                </div>

                <h6 className="fw-bold mb-3">Your Decision:</h6>
                <div className="d-flex gap-3 mb-4">
                    <Button 
                        variant={action === "approve" ? "success" : "outline-success"} 
                        onClick={() => setAction("approve")}
                        className="d-flex align-items-center gap-2 flex-grow-1 justify-content-center py-2 fw-bold"
                    >
                        <FaCheck /> Approve Draft
                    </Button>
                    <Button 
                        variant={action === "request_changes" ? "warning" : "outline-warning"} 
                        onClick={() => setAction("request_changes")}
                        className="d-flex align-items-center gap-2 flex-grow-1 justify-content-center py-2 fw-bold"
                    >
                        <FaExclamationTriangle /> Request Changes
                    </Button>
                    <Button 
                        variant={action === "reject" ? "danger" : "outline-danger"} 
                        onClick={() => setAction("reject")}
                        className="d-flex align-items-center gap-2 flex-grow-1 justify-content-center py-2 fw-bold"
                    >
                        <FaTimes /> Reject Draft
                    </Button>
                </div>

                {action && (
                    <div className="p-3 border rounded bg-light slide-down">
                        <Form.Group>
                            <Form.Label className="fw-bold text-dark">
                                {action === "approve" && "Any final notes for the accountant? (Optional)"}
                                {action === "request_changes" && "What specific changes would you like? (Required)"}
                                {action === "reject" && "Please provide a reason for rejecting the draft. (Required)"}
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={4}
                                placeholder={
                                    action === "request_changes" 
                                    ? "1. Please correct the capital gains figure...\n2. Update the address..." 
                                    : "Type your message here..."
                                }
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                            {action === "request_changes" && (
                                <Form.Text className="text-muted">
                                    Put each change request on a new line for clarity.
                                </Form.Text>
                            )}
                        </Form.Group>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={submitting}>
                    Cancel
                </Button>
                <Button 
                    variant={action === "reject" ? "danger" : action === "request_changes" ? "warning" : "success"} 
                    onClick={handleSubmit}
                    disabled={!action || submitting}
                    className="fw-bold px-4 text-white"
                >
                    {submitting ? <Spinner size="sm" /> : "Submit Feedback"}
                </Button>
            </Modal.Footer>
            <style jsx>{`
                .slide-down {
                    animation: slideDown 0.3s ease-out forwards;
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </Modal>
    );
}
