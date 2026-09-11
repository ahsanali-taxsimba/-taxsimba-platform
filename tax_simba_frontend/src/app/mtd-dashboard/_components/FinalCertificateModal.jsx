import React, { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Spinner, Alert, Badge } from "react-bootstrap";
import { FaFilePdf, FaDownload, FaCheckCircle } from "react-icons/fa";
import toast from "react-hot-toast";

export default function FinalCertificateModal({ show, onHide, session, taxReturnId }) {
    const [loading, setLoading] = useState(false);
    const [certificateDetails, setCertificateDetails] = useState(null);

    useEffect(() => {
        if (show && taxReturnId && session?.accessToken) {
            fetchCertificateDetails();
        }
    }, [show, taxReturnId, session]);

    const fetchCertificateDetails = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}client/tax-returns/${taxReturnId}/final-certificate`,
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setCertificateDetails(res.data?.data);
        } catch (error) {
            console.error("Error fetching final certificate details", error);
            toast.error(error.response?.data?.message || "Failed to load final certificate details");
            onHide();
        } finally {
            setLoading(false);
        }
    };

    if (loading || !certificateDetails) {
        return (
            <Modal show={show} onHide={onHide} centered>
                <Modal.Body className="text-center py-5">
                    <Spinner animation="border" style={{ color: "#37a267" }} />
                    <p className="mt-3 text-muted">Retrieving your final certificate...</p>
                </Modal.Body>
            </Modal>
        );
    }

    const { taxReturn, finalCertificate, accountantNotes, submissionSummary } = certificateDetails;

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title className="d-flex align-items-center gap-2">
                    <FaCheckCircle color="#27ae60" /> Final Tax Return Certificate <Badge bg="success">{taxReturn?.taxYear}</Badge>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Alert variant="success" className="mb-4">
                    <Alert.Heading>Congratulations!</Alert.Heading>
                    <p className="mb-0">
                        Your tax return has been successfully finalized. You can download your official completion certificate and review any closing notes from your accountant below.
                    </p>
                </Alert>

                <div className="mb-4">
                    <h6 className="fw-bold">Submission Summary:</h6>
                    <div className="p-3 border rounded bg-light d-flex justify-content-between align-items-center">
                        <div>
                            <strong>Status:</strong> <span className="text-success">{submissionSummary?.status}</span>
                        </div>
                        <div>
                            <strong>Date:</strong> {submissionSummary?.submittedOn ? new Date(submissionSummary.submittedOn).toLocaleDateString() : "N/A"}
                        </div>
                        <div>
                            <strong>Accountant:</strong> {taxReturn?.accountant?.name} {taxReturn?.accountant?.surname}
                        </div>
                    </div>
                </div>

                <div className="mb-4">
                    <h6 className="fw-bold">Accountant Closing Notes:</h6>
                    <div className="p-3 rounded bg-light border" style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>
                        {accountantNotes || "No specific closing notes provided."}
                    </div>
                </div>

                <div className="mb-4">
                    <h6 className="fw-bold">Your Certificate:</h6>
                    {finalCertificate ? (
                        <div className="d-flex align-items-center justify-content-between p-3 border rounded shadow-sm" style={{ backgroundColor: "#f8fdfa", borderColor: "#27ae60" }}>
                            <div className="d-flex align-items-center gap-3">
                                <FaFilePdf size={32} color="#e11d48" />
                                <div>
                                    <div className="fw-bold text-dark">{finalCertificate.filename}</div>
                                    <small className="text-muted">
                                        {(finalCertificate.fileSize / 1024).toFixed(1)} KB • Uploaded {new Date(finalCertificate.uploadedAt).toLocaleDateString()}
                                    </small>
                                </div>
                            </div>
                            <a 
                                href={finalCertificate.downloadUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="btn btn-success d-flex align-items-center gap-2 fw-bold px-4"
                                style={{ borderRadius: "50px" }}
                            >
                                <FaDownload /> Download
                            </a>
                        </div>
                    ) : (
                        <Alert variant="warning">Certificate document is currently unavailable.</Alert>
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} className="px-4 fw-bold">
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
