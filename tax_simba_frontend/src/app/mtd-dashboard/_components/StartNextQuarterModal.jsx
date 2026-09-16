import React, { useState, useRef } from "react";
import axios from "axios";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import { FaUpload, FaTimes, FaCloudUploadAlt, FaFileAlt } from "react-icons/fa";
import toast from "react-hot-toast";
import { formatQuarterDisplay } from "@/utils/commonHelper";

export default function StartNextQuarterModal({ show, onHide, session, onSuccess, nextQuarter }) {
    const [loading, setLoading] = useState(false);
    
    const [bankStatements, setBankStatements] = useState([]);
    const [incomeRecords, setIncomeRecords] = useState([]);
    const [expenseRecords, setExpenseRecords] = useState([]);

    const bankInputRef = useRef(null);
    const incomeInputRef = useRef(null);
    const expenseInputRef = useRef(null);

    const handleFileChange = (e, setFilesState) => {
        if (e.target.files) {
            let selectedFiles = Array.from(e.target.files);
            const invalidFiles = selectedFiles.filter(file => 
                !file.name.match(/\.(jpg|jpeg|png|webp|pdf|doc|docx)$/i)
            );
            
            if (invalidFiles.length > 0) {
                toast.error("Some selected files are not allowed. Please remove them.");
            }

            // For simplicity in this modal, we only allow 1 file per field
            if (selectedFiles.length > 1) {
                toast.error("Please upload one merged file or zip for each category.");
                selectedFiles = [selectedFiles[0]];
            }

            setFilesState(selectedFiles);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (bankStatements.length === 0 || incomeRecords.length === 0 || expenseRecords.length === 0) {
            return toast.error("Please upload all mandatory documents (Bank Statements, Income Records, Expense Records) to start the quarter.");
        }
        
        setLoading(true);
        try {
            const submitData = new FormData();
            
            if (bankStatements.length > 0) submitData.append("bankStatements", bankStatements[0]);
            if (incomeRecords.length > 0) submitData.append("incomeRecords", incomeRecords[0]);
            if (expenseRecords.length > 0) submitData.append("expenseRecords", expenseRecords[0]);

            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}mtd/start-next-quarter`,
                submitData,
                { 
                    headers: { 
                        Authorization: `Bearer ${session.accessToken}`,
                        'Content-Type': 'multipart/form-data'
                    } 
                }
            );

            toast.success(`${formatQuarterDisplay(nextQuarter?.quarterName)} started successfully!`);
            setBankStatements([]);
            setIncomeRecords([]);
            setExpenseRecords([]);
            onHide();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error starting next quarter:", error);
            toast.error(error.response?.data?.message || "Failed to start next quarter.");
        } finally {
            setLoading(false);
        }
    };

    const renderFileUpload = (title, filesState, setFilesState, inputRef) => (
        <div className="mb-4 p-3 border rounded bg-light">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-bold">{title}</span>
                {filesState.length > 0 && (
                    <Button variant="link" className="text-danger p-0" onClick={() => setFilesState([])} disabled={loading}>
                        <FaTimes /> Remove
                    </Button>
                )}
            </div>
            
            {filesState.length === 0 ? (
                <div 
                    className="border-dashed p-3 text-center rounded bg-white" 
                    style={{ border: "2px dashed #ccc", cursor: "pointer", transition: "all 0.2s ease" }}
                    onClick={() => inputRef.current?.click()}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#37a267'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#ccc'}
                >
                    <FaUpload size={20} color="#37a267" className="mb-2" />
                    <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>Click to upload document</p>
                </div>
            ) : (
                <div className="d-flex align-items-center gap-2 p-2 border rounded bg-white border-success">
                    <FaFileAlt color="#37a267" />
                    <span className="text-truncate" style={{ fontSize: "14px", flex: 1 }}>{filesState[0].name}</span>
                    <small className="text-muted">{(filesState[0].size / 1024 / 1024).toFixed(2)} MB</small>
                </div>
            )}
            
            <input 
                type="file" 
                className="d-none" 
                ref={inputRef}
                onChange={(e) => handleFileChange(e, setFilesState)}
                disabled={loading}
                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
            />
        </div>
    );

    return (
        <Modal show={show} onHide={onHide} size="md" centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title className="d-flex align-items-center gap-2" style={{ fontSize: "18px" }}>
                    <FaCloudUploadAlt color="#37a267" /> Start {formatQuarterDisplay(nextQuarter?.quarterName)}
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Alert variant="info" className="mb-4" style={{ backgroundColor: '#f0fbf7', borderColor: '#37a267', color: '#107c50' }}>
                        <p className="mb-0" style={{ fontSize: "14px" }}>
                            To begin processing your next quarter, please upload any available documents below. 
                            These will be assigned to a tax professional immediately.
                        </p>
                    </Alert>

                    {renderFileUpload("Bank Statements", bankStatements, setBankStatements, bankInputRef)}
                    {renderFileUpload("Income Records", incomeRecords, setIncomeRecords, incomeInputRef)}
                    {renderFileUpload("Expense Records", expenseRecords, setExpenseRecords, expenseInputRef)}

                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => {
                        setBankStatements([]);
                        setIncomeRecords([]);
                        setExpenseRecords([]);
                        onHide();
                    }} disabled={loading}>
                        Cancel
                    </Button>
                    <Button 
                        type="submit"
                        variant="success" 
                        disabled={loading || bankStatements.length === 0 || incomeRecords.length === 0 || expenseRecords.length === 0}
                        className="fw-bold px-4 text-white d-flex align-items-center gap-2"
                        style={{ background: "#37a267", borderColor: "#37a267" }}
                    >
                        {loading ? <><Spinner size="sm" /> Processing...</> : <>Start Quarter</>}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}
