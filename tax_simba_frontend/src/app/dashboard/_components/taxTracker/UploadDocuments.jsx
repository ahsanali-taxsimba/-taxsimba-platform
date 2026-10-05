import { useSession } from 'next-auth/react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Modal, Button } from 'react-bootstrap';
import { useFetchTaxReturnData } from '@/hooks/fetchData';

const UploadDocuments = ({ requiredDocs, item, ids, setTaxReturns, setIsDocUpdated }) => {
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState({});
    const { data: sessionData, status } = useSession();
    const access_token = sessionData?.accessToken;
    const taxReturnId = item?.taxReturn?.id;
    const [show, setShow] = useState(false);
    const [error, setError] = useState({});

    const handleModalClose = () => {
        setShow(false);
        setError({});
        setFiles({});
    };

    const handleModalShow = () => {
        setShow(true);
        setError({});
        setFiles({});
    };

    const handleFileChange = (e, docId) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFiles(prevState => ({
                ...prevState,
                [docId]: selectedFile
            }));
            setError(prevState => {
                const newError = { ...prevState };
                delete newError[docId];
                return newError;
            });
        }
    };

    const validateDocuments = () => {
        let isValid = true;
        let errorMessages = {};

        requiredDocs.forEach(doc => {
            if (!files[doc.id]) {
                isValid = false;
                errorMessages[doc.id] = 'You must upload this document';
            }
        });

        if (!isValid) {
            setError(errorMessages);
        }

        return isValid;
    };

    const handleUpload = async () => {
        if (!validateDocuments()) {
            return;
        }
        if (!taxReturnId) {
            toast.error('Tax return is missing. Please refresh and try again.');
            return;
        }
        if (!access_token) {
            toast.error('You must be signed in to upload documents.');
            return;
        }

        setLoading(true);

        try {
            // One request per document so each upload is tied to its request placeholder.
            for (const doc of requiredDocs) {
                const selected = files[doc.id];
                if (!selected) continue;

                const formData = new FormData();
                // Canonical multipart field expected by backend Multer (`file`).
                formData.append('file', selected);
                formData.append('documentId', String(doc.id));
                formData.append('document_id', String(doc.id));
                if (doc.requestId || doc.request_id) {
                    formData.append('requestId', String(doc.requestId || doc.request_id));
                }
                formData.append(
                    'documentType',
                    doc.documentType || doc.document_type || 'client_upload',
                );

                // Do NOT set Content-Type — the browser must attach multipart boundary.
                // Setting `multipart/form-data` alone causes Multer "Boundary not found"
                // and the client toast "Failed to upload documents" (Toxsl F-004).
                const response = await axios.post(
                    `${process.env.NEXT_PUBLIC_API_URL}client/tax-returns/${taxReturnId}/upload-documents`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${access_token}`,
                        },
                    }
                );

                if (!response.data?.success) {
                    const msg = response.data?.message || 'Failed to upload the documents.';
                    throw new Error(msg);
                }
            }

            const data = await useFetchTaxReturnData(access_token);
            if (setTaxReturns) {
                setTaxReturns(data);
            }
            if (setIsDocUpdated) {
                setIsDocUpdated(true);
            }
            toast.success('Documents uploaded successfully!');
            setShow(false);
            setFiles({});
            setError({});
        } catch (err) {
            console.error('Error uploading documents:', err);
            const apiMsg =
                err?.response?.data?.message ||
                err?.message ||
                'Failed to upload the documents. Please try again.';
            toast.error(apiMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="upload_valid" data-testid="client-document-upload-banner">
                <p>
                    <span>
                        <i className="fa-solid fa-circle-info" />
                    </span>
                    Your accountant has requested documents. Please upload them here.
                </p>
                <button
                    className="border_btn upload_btn"
                    data-testid="client-upload-documents-btn"
                    onClick={handleModalShow}
                    disabled={loading || status !== 'authenticated'}
                >
                    Upload Documents
                </button>
            </div>

            <Modal show={show} onHide={handleModalClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Upload Documents</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="row">
                        {requiredDocs.map((doc) => (
                            <div key={doc.id} className="col-md-6 mb-3">
                                <div className="global_upload_box h-100 d-flex flex-column p-3 border rounded shadow-sm">
                                    <h6 className="fw-bold mb-2 text-primary">{doc?.documentType || doc?.filename}</h6>
                                    
                                    <div className="mb-3 flex-grow-1">
                                        {doc?.message && (
                                            <div className="text-muted small mb-1">
                                                <strong>Message:</strong> {doc.message}
                                            </div>
                                        )}
                                        {doc?.priority && (
                                            <div className="text-muted small mb-1 d-flex align-items-center gap-1">
                                                <strong>Priority:</strong> 
                                                <span className={`badge ${doc.priority === 'high' ? 'bg-danger' : doc.priority === 'medium' ? 'bg-warning text-dark' : 'bg-info'}`}>
                                                    {doc.priority.charAt(0).toUpperCase() + doc.priority.slice(1)}
                                                </span>
                                            </div>
                                        )}
                                        {doc?.deadline && (
                                            <div className="text-muted small mb-1">
                                                <strong>Deadline:</strong> {new Date(doc.deadline).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>

                                    <label className="form-label small fw-semibold">Upload File</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        data-testid={`client-upload-input-${doc.id}`}
                                        onChange={(e) => handleFileChange(e, doc.id)}
                                        className={`form-control mt-auto ${error[doc.id] ? 'is-invalid' : ''}`}
                                    />
                                    {error[doc.id] && (
                                        <div className="invalid-feedback d-block">
                                            {error[doc.id]}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleModalClose}>
                        Close
                    </Button>
                    <Button
                        variant="primary"
                        data-testid="client-upload-submit-btn"
                        onClick={handleUpload}
                        disabled={loading}
                    >
                        Upload
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default UploadDocuments;
