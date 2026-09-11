import React, { useState, useRef } from "react";
import axios from "axios";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import { FaUpload, FaFilePdf, FaTimes, FaCloudUploadAlt } from "react-icons/fa";
import toast from "react-hot-toast";

const DOCUMENT_TYPES = [
    { id: "bank_statement", label: "Bank Statements" },
    { id: "invoice", label: "Invoices / Receipts" },
    { id: "identity", label: "Identity Document" },
    { id: "vat_certificate", label: "VAT Certificate" },
    { id: "p60_p45", label: "P60 / P45" },
    { id: "general", label: "Other / General" },
];

export default function UploadCurrentTaxDocumentModal({ show, onHide, session, taxReturnId, onSuccess, initialType }) {
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState([]);
    const [clientNotes, setClientNotes] = useState("");
    const [selectedType, setSelectedType] = useState(initialType || "general");
    const fileInputRef = useRef(null);

    // Reset selectedType when modal opens with a new initialType
    React.useEffect(() => {
        if (show) {
            setSelectedType(initialType || "general");
        }
    }, [show, initialType]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            let selectedFiles = Array.from(e.target.files);
            
            // Check for restricted file types but don't prevent adding, just show a warning
            const invalidFiles = selectedFiles.filter(file => 
                !file.name.match(/\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i)
            );
            
            if (invalidFiles.length > 0) {
                toast.error("Some selected files are not allowed. Please remove them.");
            }

            if (files.length + selectedFiles.length > 10) {
                return toast.error("You can upload a maximum of 10 files at once.");
            }
            setFiles((prev) => [...prev, ...selectedFiles]);
        }
    };

    const removeFile = (indexToRemove) => {
        setFiles(files.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (files.length === 0) {
            return toast.error("Please select at least one document to upload.");
        }

        setLoading(true);
        try {
            const submitData = new FormData();
            if (clientNotes) {
                submitData.append("clientNotes", clientNotes);
            }

            // Map the selected type to all files being uploaded
            const types = files.map(() => selectedType);
            submitData.append("documentTypes", JSON.stringify(types));

            files.forEach((file) => {
                submitData.append("documents", file);
            });

            // Call the correct endpoint for uploading documents to a specific tax return
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/tax-returns/${taxReturnId}/upload-documents`,
                submitData,
                { 
                    headers: { 
                        Authorization: `Bearer ${session.accessToken}`,
                        'Content-Type': 'multipart/form-data'
                    } 
                }
            );

            toast.success("Documents uploaded successfully! They will be processed shortly.");
            setFiles([]);
            setClientNotes("");
            onHide();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error uploading documents:", error);
            toast.error(error.response?.data?.message || "Failed to upload documents.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title className="d-flex align-items-center gap-2">
                    <FaCloudUploadAlt color="#37a267" /> Upload Tax Documents
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Alert variant="info" className="mb-4" style={{ backgroundColor: '#f0fbf7', borderColor: '#37a267', color: '#107c50' }}>
                        <p className="mb-0 fs-6">
                            These documents will be securely attached directly to your current active tax return. 
                            Our accountants will be notified immediately upon processing.
                        </p>
                    </Alert>

                    <Form.Group className="mb-4">
                        <Form.Label className="fw-bold">Document Type <span className="text-danger">*</span></Form.Label>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                            {DOCUMENT_TYPES.map(t => (
                                <button 
                                    key={t.id} 
                                    className={`btn btn-sm ${selectedType === t.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                    onClick={() => !initialType && setSelectedType(t.id)}
                                    type="button"
                                    style={{
                                        ...(selectedType === t.id ? { backgroundColor: '#37a267', borderColor: '#37a267', color: '#fff' } : {}),
                                        ...(initialType && selectedType !== t.id ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                                    }}
                                    disabled={initialType && selectedType !== t.id}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-4">
                        <Form.Label className="fw-bold">Select Files <span className="text-danger">*</span></Form.Label>
                        <div 
                            className="border-dashed p-4 text-center rounded bg-light" 
                            style={{ border: "2px dashed #ccc", cursor: "pointer", transition: "all 0.2s ease" }}
                            onClick={() => fileInputRef.current?.click()}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = '#37a267'}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = '#ccc'}
                        >
                            <FaUpload size={28} color="#37a267" className="mb-3" />
                            <h6 className="mb-1">Click to browse or drag and drop</h6>
                            <p className="mb-0 text-muted" style={{ fontSize: "14px" }}>Max 10 files per upload.</p>
                            <p className="mb-0 mt-1 text-danger" style={{ fontSize: "12px" }}>* Only images (JPG, PNG, WEBP) and documents (PDF, DOCX) are allowed.</p>
                            <input 
                                type="file" 
                                multiple 
                                className="d-none" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                disabled={loading}
                            />
                        </div>

                        {files.length > 0 && (
                            <div className="mt-3 d-flex flex-column gap-2">
                                {files.map((file, idx) => {
                                    const isInvalid = !file.name.match(/\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i);
                                    return (
                                        <div key={idx} className={`d-flex align-items-center justify-content-between p-3 border rounded shadow-sm ${isInvalid ? 'bg-danger-subtle border-danger' : 'bg-white'}`} style={isInvalid ? { backgroundColor: '#fff1f2', borderColor: '#e11d48' } : {}}>
                                            <div className="d-flex align-items-center gap-3 text-truncate">
                                                <FaFilePdf size={20} color="#e11d48" />
                                                <div>
                                                    <div className={`text-truncate fw-bold ${isInvalid ? 'text-danger' : ''}`} style={{ maxWidth: "250px", fontSize: "14px" }}>
                                                        {file.name}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <small className={isInvalid ? "text-danger fw-bold" : "text-muted"}>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
                                                        {isInvalid && <span className="badge bg-danger" style={{ fontSize: '10px' }}>Not allowed</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button variant="link" className="text-danger p-0" onClick={() => removeFile(idx)} disabled={loading}>
                                                <FaTimes size={18} />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Form.Group>

                    <Form.Group>
                        <Form.Label className="fw-bold">Additional Notes (Optional)</Form.Label>
                        <Form.Control 
                            as="textarea" 
                            rows={3} 
                            placeholder="Add any specific instructions or context for the accountant regarding these files..."
                            value={clientNotes}
                            onChange={(e) => setClientNotes(e.target.value)}
                            disabled={loading}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => {
                        setFiles([]);
                        setClientNotes("");
                        setSelectedType("general");
                        onHide();
                    }} disabled={loading}>
                        Cancel
                    </Button>
                    <Button 
                        type="submit"
                        variant="success" 
                        disabled={loading || files.length === 0 || files.some(f => !f.name.match(/\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i))}
                        className="fw-bold px-4 text-white d-flex align-items-center gap-2"
                        style={{ background: "#37a267", borderColor: "#37a267" }}
                    >
                        {loading ? <><Spinner size="sm" /> Uploading...</> : <><FaUpload /> Upload Documents</>}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}
