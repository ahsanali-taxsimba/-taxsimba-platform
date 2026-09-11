import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Modal, Button, Form, Spinner, Alert, Badge } from "react-bootstrap";
import { FaUpload, FaFilePdf, FaTimes, FaPlusCircle } from "react-icons/fa";
import toast from "react-hot-toast";

export default function NewTaxReturnModal({ show, onHide, session, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [taxReturnTypes, setTaxReturnTypes] = useState([]);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        taxYear: new Date().getFullYear().toString(),
        taxReturnTypeId: "",
        financialYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        isUkResident: "true",
        studentLoanType: "none",
        clientNotes: ""
    });

    const [files, setFiles] = useState([]);

    useEffect(() => {
        if (show && session?.accessToken) {
            fetchTaxReturnTypes();
            // Reset form
            setFormData({
                taxYear: new Date().getFullYear().toString(),
                taxReturnTypeId: "",
                financialYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
                isUkResident: "true",
                studentLoanType: "none",
                clientNotes: ""
            });
            setFiles([]);
        }
    }, [show, session]);

    const fetchTaxReturnTypes = async () => {
        setLoading(true);
        try {
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/tax-return-type`,
                { isActive: true, limit: 100 },
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setTaxReturnTypes(res.data?.data?.taxReturnTypes || []);
        } catch (error) {
            console.error("Error fetching tax return types", error);
            toast.error("Failed to load tax return types");
        } finally {
            setLoading(false);
        }
    };

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
                return toast.error("You can upload a maximum of 10 files.");
            }
            setFiles((prev) => [...prev, ...selectedFiles]);
        }
    };

    const removeFile = (indexToRemove) => {
        setFiles(files.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.taxReturnTypeId) {
            return toast.error("Please select a tax return type.");
        }
        if (!formData.taxYear) {
            return toast.error("Please enter a tax year.");
        }

        setSubmitting(true);
        try {
            const submitData = new FormData();
            submitData.append("taxReturnTypeId", formData.taxReturnTypeId);
            submitData.append("taxYear", formData.taxYear);
            submitData.append("financialYear", formData.financialYear);
            submitData.append("isUkResident", formData.isUkResident);
            submitData.append("studentLoanType", formData.studentLoanType);
            if (formData.clientNotes) {
                submitData.append("clientNotes", formData.clientNotes);
            }

            files.forEach((file) => {
                submitData.append("documents", file);
            });

            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/apply-tax-return`,
                submitData,
                { 
                    headers: { 
                        Authorization: `Bearer ${session.accessToken}`,
                        'Content-Type': 'multipart/form-data'
                    } 
                }
            );

            toast.success("New tax return created successfully!");
            onHide();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error creating tax return", error);
            toast.error(error.response?.data?.message || "Failed to create new tax return");
        } finally {
            setSubmitting(false);
        }
    };

    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title className="d-flex align-items-center gap-2">
                    <FaPlusCircle color="#37a267" /> Start New Tax Return
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Alert variant="info" className="mb-4">
                        <Alert.Heading className="fs-5">Ready for another year?</Alert.Heading>
                        <p className="mb-0 fs-6">
                            Fill out the details below to initiate a new tax return process. Our admin team will review your application and assign an expert accountant to handle it.
                        </p>
                    </Alert>

                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" style={{ color: "#37a267" }} />
                        </div>
                    ) : (
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Group>
                                    <Form.Label className="fw-bold">Tax Year <span className="text-danger">*</span></Form.Label>
                                    <Form.Select 
                                        value={formData.taxYear}
                                        onChange={(e) => setFormData({...formData, taxYear: e.target.value})}
                                        required
                                    >
                                        <option value="">Select Tax Year</option>
                                        {yearOptions.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </div>
                            
                            <div className="col-md-6 mb-3">
                                <Form.Group>
                                    <Form.Label className="fw-bold">Financial Year</Form.Label>
                                    <Form.Control 
                                        type="text" 
                                        value={formData.financialYear}
                                        onChange={(e) => setFormData({...formData, financialYear: e.target.value})}
                                        placeholder="e.g. 2026-2027"
                                    />
                                </Form.Group>
                            </div>

                            <div className="col-md-12 mb-3">
                                <Form.Group>
                                    <Form.Label className="fw-bold">Tax Return Type <span className="text-danger">*</span></Form.Label>
                                    <Form.Select 
                                        value={formData.taxReturnTypeId}
                                        onChange={(e) => setFormData({...formData, taxReturnTypeId: e.target.value})}
                                        required
                                    >
                                        <option value="">-- Select Type --</option>
                                        {taxReturnTypes.map(type => (
                                            <option key={type.id} value={type.id}>
                                                {type.typeName} - £{type.baseFee || '0'}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Group>
                                    <Form.Label className="fw-bold">Are you a UK Resident?</Form.Label>
                                    <Form.Select 
                                        value={formData.isUkResident}
                                        onChange={(e) => setFormData({...formData, isUkResident: e.target.value})}
                                    >
                                        <option value="true">Yes</option>
                                        <option value="false">No</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>

                            <div className="col-md-6 mb-3">
                                <Form.Group>
                                    <Form.Label className="fw-bold">Student Loan Type</Form.Label>
                                    <Form.Select 
                                        value={formData.studentLoanType}
                                        onChange={(e) => setFormData({...formData, studentLoanType: e.target.value})}
                                    >
                                        <option value="none">None</option>
                                        <option value="plan1">Plan 1</option>
                                        <option value="plan2">Plan 2</option>
                                        <option value="plan4">Plan 4</option>
                                        <option value="postgraduate">Postgraduate</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>

                            <div className="col-md-12 mb-4">
                                <Form.Group>
                                    <Form.Label className="fw-bold">Upload Required Documents</Form.Label>
                                    <div 
                                        className="border-dashed p-4 text-center rounded bg-light" 
                                        style={{ border: "2px dashed #ccc", cursor: "pointer" }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <FaUpload size={24} color="#37a267" className="mb-2" />
                                        <p className="mb-0 text-muted">Click to browse or drag and drop files here (Max 10 files)</p>
                                        <p className="mb-0 mt-1 text-danger" style={{ fontSize: "12px" }}>* Only images (JPG, PNG, WEBP) and documents (PDF, DOCX) are allowed.</p>
                                        <input 
                                            type="file" 
                                            multiple 
                                            className="d-none" 
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                        />
                                    </div>

                                    {files.length > 0 && (
                                        <div className="mt-3 d-flex flex-column gap-2">
                                            {files.map((file, idx) => {
                                                const isInvalid = !file.name.match(/\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i);
                                                return (
                                                    <div key={idx} className={`d-flex align-items-center justify-content-between p-2 border rounded shadow-sm ${isInvalid ? 'bg-danger-subtle border-danger' : 'bg-white'}`} style={isInvalid ? { backgroundColor: '#fff1f2', borderColor: '#e11d48' } : {}}>
                                                        <div className="d-flex align-items-center gap-2 text-truncate">
                                                            <FaFilePdf color="#e11d48" />
                                                            <div className="d-flex flex-column">
                                                                <span className={`text-truncate fw-bold ${isInvalid ? 'text-danger' : ''}`} style={{ maxWidth: "250px", fontSize: "14px" }}>
                                                                    {file.name}
                                                                </span>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <small className={isInvalid ? "text-danger fw-bold" : "text-muted"}>({(file.size / 1024 / 1024).toFixed(2)} MB)</small>
                                                                    {isInvalid && <Badge bg="danger" style={{ fontSize: '10px' }}>Not allowed</Badge>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button variant="link" className="text-danger p-0" onClick={() => removeFile(idx)}>
                                                            <FaTimes />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </Form.Group>
                            </div>

                            <div className="col-md-12 mb-3">
                                <Form.Group>
                                    <Form.Label className="fw-bold">Additional Notes</Form.Label>
                                    <Form.Control 
                                        as="textarea" 
                                        rows={3} 
                                        placeholder="Any specific instructions or details for the accountant..."
                                        value={formData.clientNotes}
                                        onChange={(e) => setFormData({...formData, clientNotes: e.target.value})}
                                    />
                                </Form.Group>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={onHide} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button 
                        type="submit"
                        variant="success" 
                        disabled={submitting || loading || files.some(f => !f.name.match(/\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i))}
                        className="fw-bold px-4 text-white"
                        style={{ background: "#37a267", borderColor: "#37a267" }}
                    >
                        {submitting ? <Spinner size="sm" /> : "Submit Application"}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}
