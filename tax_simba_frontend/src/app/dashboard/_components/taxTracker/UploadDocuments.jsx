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
    const taxReturnId = item?.taxReturn?.id; // Assuming taxReturnId is available in item.
    const [show, setShow] = useState(false);
    const [error, setError] = useState({}); // To track error for each document
    // Reset error and modal visibility when modal is closed
    const handleModalClose = () => {
        setShow(false);
        setError({}); // Clear errors when modal closes
        setFiles({}); // Clear selected files when modal closes
    };

    // Open the modal and clear any existing errors
    const handleModalShow = () => {
        setShow(true);
        setError({}); // Clear errors when modal is opened
        setFiles({}); // Clear selected files when modal is opened
    };

    // Handle file input change
    const handleFileChange = (e, docId) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFiles(prevState => ({
                ...prevState,
                [docId]: selectedFile // Store the file by document id
            }));
            // Clear error for the specific document when file is selected
            setError(prevState => {
                const newError = { ...prevState };
                delete newError[docId]; // Remove error for this document
                return newError;
            });
        }
    };

    // Validate that all required documents have files
    const validateDocuments = () => {
        let isValid = true;
        let errorMessages = {};

        requiredDocs.forEach(doc => {
            if (!files[doc.id]) {
                isValid = false;
                errorMessages[doc.id] = 'You must upload this document'; // Add error for missing file
            }
        });

        if (!isValid) {
            setError(errorMessages); // Set error messages for invalid files
        }

        return isValid; // Return whether all documents are uploaded
    };

    // Handle document upload
    const handleUpload = async () => {
        // Validate before uploading
        if (!validateDocuments()) {
            return; // Don't proceed with upload if validation fails
        }

        setLoading(true);

        try {
            const formData = new FormData();
            
            const documentNames = [];
            const documentTypes = [];
            const documentCategories = [];

            // Append all files to formData
            requiredDocs.forEach(doc => {
                if (files[doc.id]) {
                    formData.append('documents', files[doc.id]); // Append file for each document
                    documentNames.push(doc.filename || doc.originalFileName || "");
                    documentTypes.push(doc.documentType || "client_upload");
                    documentCategories.push(doc.documentCategory || "additional_info");
                }
            });

            formData.append('documentNames', JSON.stringify(documentNames));
            formData.append('documentTypes', JSON.stringify(documentTypes));
            formData.append('documentCategories', JSON.stringify(documentCategories));

            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/tax-returns/${taxReturnId}/upload-documents`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${access_token}`,
                    },
                }
            );

            if (response.data.success) {
                const data = await useFetchTaxReturnData(access_token);
                if (setTaxReturns) {
                    setTaxReturns(data); // Update parent component's state
                }
                if (setIsDocUpdated) {
                    setIsDocUpdated(true); // Notify parent component about the document update
                }
                toast.success('Documents uploaded successfully!');
                setShow(false); // Close modal after successful upload
            } else {
                toast.error('Failed to upload the documents.');
            }
        } catch (error) {
            console.error('Error uploading documents:', error);
            toast.error('Failed to upload the documents. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="upload_valid">
                <p>
                    <span>
                        <i className="fa-solid fa-circle-info" />
                    </span>
                    Some of your documents are rejected. Please upload valid documents here.
                </p>
                <button
                    className="border_btn upload_btn"
                    onClick={handleModalShow}
                    disabled={loading}
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
                    <Button variant="primary" onClick={handleUpload} disabled={loading}>
                        Upload
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default UploadDocuments;
