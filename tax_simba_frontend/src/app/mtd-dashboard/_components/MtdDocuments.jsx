"use client";
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
    FaCloudUploadAlt, FaFileAlt, FaFilePdf, FaFileImage, FaCheck,
    FaHourglass, FaSearch, FaTrash, FaExclamationCircle
} from "react-icons/fa";
import toast from "react-hot-toast";

const DOCUMENT_TYPES = [
    { id: "bank_statement", label: "Bank Statements" },
    { id: "invoice", label: "Invoices / Receipts" },
    { id: "identity", label: "Identity Document" },
    { id: "vat_certificate", label: "VAT Certificate" },
    { id: "p60_p45", label: "P60 / P45" },
    { id: "general", label: "Other / General" },
];

const statusConfig = {
    Uploaded:      { label: "Uploaded",       color: "#3498db", bg: "#eaf4fb" },
    "Under Review":{ label: "Under Review",   color: "#f39c12", bg: "#fef9ee" },
    Approved:      { label: "Approved",       color: "#27ae60", bg: "#eafaf1" },
    Pending:       { label: "Pending",        color: "#e74c3c", bg: "#fdf0ef" },
};

function FileIcon({ mimeType }) {
    if (!mimeType) return <FaFileAlt />;
    if (mimeType.includes("pdf")) return <FaFilePdf style={{ color: "#e74c3c" }} />;
    if (mimeType.includes("image")) return <FaFileImage style={{ color: "#3498db" }} />;
    return <FaFileAlt style={{ color: "#888" }} />;
}

export default function MtdDocuments({ session }) {
    const [documents, setDocuments] = useState([]);
    const [requestedDocs, setRequestedDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadingRequestId, setUploadingRequestId] = useState(null);
    const [selectedType, setSelectedType] = useState("general");
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (session?.accessToken) fetchDocuments();
    }, [session]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}mtd/documents`,
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            // Handle both legacy payload (array) and new payload (object)
            if (Array.isArray(res.data?.data)) {
                setDocuments(res.data.data);
                setRequestedDocs([]);
            } else {
                setDocuments(res.data?.data?.uploadedDocuments || []);
                setRequestedDocs(res.data?.data?.requestedDocuments || []);
            }
        } catch (err) {
            console.error("Error fetching MTD documents", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (files, requestId = null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        if (requestId) setUploadingRequestId(requestId);

        const formData = new FormData();
        Array.from(files).forEach((f) => formData.append("documents", f));
        formData.append("documentType", selectedType);
        if (requestId) formData.append("requestId", requestId);

        try {
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}mtd/documents/upload`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${session.accessToken}`,
                        "Content-Type": "multipart/form-data",
                    },
                }
            );
            toast.success("Document uploaded successfully!");
            await fetchDocuments();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Upload failed.");
        } finally {
            setUploading(false);
            setUploadingRequestId(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleUpload(e.dataTransfer.files);
    };

    const formatSize = (bytes) => {
        if (!bytes) return "—";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    return (
        <div>
            <style>{`
                .mtd-doc-header { margin-bottom: 24px; }
                .mtd-doc-header h4 { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; }
                .mtd-doc-header p { color: #888; font-size: 14px; margin: 0; }

                .mtd-upload-zone {
                    border: 2px dashed #d1d5db;
                    border-radius: 18px;
                    padding: 40px 24px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                    background: #fafafa;
                    margin-bottom: 24px;
                }
                .mtd-upload-zone.drag-over {
                    border-color: #37a267;
                    background: rgba(55, 162, 103, 0.04);
                    transform: scale(1.01);
                }
                .mtd-upload-zone:hover { border-color: #37a267; background: rgba(55, 162, 103, 0.04); }
                .mtd-upload-icon {
                    width: 64px; height: 64px; border-radius: 50%;
                    background: linear-gradient(135deg, rgba(55, 162, 103,0.12), rgba(55, 162, 103,0.06));
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 16px; color: #37a267; font-size: 26px;
                }
                .mtd-upload-title { font-size: 16px; font-weight: 700; color: #222; margin-bottom: 6px; }
                .mtd-upload-sub { font-size: 13px; color: #aaa; margin-bottom: 20px; }

                .mtd-type-select {
                    display: flex; flex-wrap: wrap; gap: 8px;
                    justify-content: center; margin-bottom: 16px;
                }
                .mtd-type-btn {
                    padding: 6px 14px; border-radius: 50px; font-size: 12px; font-weight: 600;
                    border: 1.5px solid #e0e0e0; background: #fff; color: #555; cursor: pointer;
                    transition: all 0.2s;
                }
                .mtd-type-btn.selected {
                    border-color: #37a267; background: rgba(55, 162, 103,0.08); color: #2e8a56;
                }

                .mtd-upload-btn {
                    padding: 10px 28px; border-radius: 50px; font-size: 14px; font-weight: 700;
                    border: none; background: linear-gradient(135deg, #37a267, #2e8a56);
                    color: #fff; cursor: pointer; transition: 0.3s; display: inline-flex;
                    align-items: center; gap: 8px;
                }
                .mtd-upload-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(55, 162, 103,0.35); }
                .mtd-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

                .mtd-doc-list { display: flex; flex-direction: column; gap: 12px; }
                .mtd-doc-item {
                    display: flex; align-items: center; gap: 16px;
                    background: #fff; border-radius: 14px; padding: 16px 20px;
                    border: 1px solid #f0f0f0; box-shadow: 0 1px 8px rgba(0,0,0,0.04);
                    transition: box-shadow 0.25s;
                }
                .mtd-doc-item:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.08); }
                .mtd-doc-file-icon { font-size: 28px; flex-shrink: 0; }
                .mtd-doc-info { flex: 1; min-width: 0; }
                .mtd-doc-name { font-size: 14px; font-weight: 700; color: #222;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .mtd-doc-meta { font-size: 12px; color: #aaa; margin-top: 2px; }
                .mtd-status-badge {
                    padding: 4px 12px; border-radius: 50px; font-size: 12px;
                    font-weight: 700; white-space: nowrap; flex-shrink: 0;
                }
                .mtd-doc-view-link { color: #37a267; font-size: 13px; font-weight: 600;
                    text-decoration: none; flex-shrink: 0; }
                .mtd-doc-view-link:hover { text-decoration: underline; }

                .mtd-empty-docs { text-align: center; padding: 40px 0; color: #bbb; }
                .mtd-empty-docs svg { font-size: 48px; margin-bottom: 16px; }

                /* Requested Documents Section */
                .mtd-req-section {
                    background: #fff; border: 2px solid #ffbc34; border-radius: 14px;
                    padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(255, 188, 52, 0.1);
                    position: relative; overflow: hidden;
                }
                .mtd-req-section::before {
                    content: ''; position: absolute; top: 0; left: 0; width: 6px; height: 100%;
                    background: #ffbc34;
                }
                .mtd-req-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
                .mtd-req-header h5 { color: #d35400; font-size: 18px; font-weight: 800; margin: 0; }
                .mtd-req-header svg { color: #d35400; font-size: 20px; }
                .mtd-req-list { display: flex; flex-direction: column; gap: 12px; }
                .mtd-req-item {
                    display: flex; align-items: center; justify-content: space-between; gap: 16px;
                    background: #fffdf5; border: 1px solid #ffe6a6; border-radius: 12px; padding: 16px;
                }
                .mtd-req-info h6 { font-size: 15px; font-weight: 700; color: #333; margin: 0 0 4px 0; }
                .mtd-req-info p { font-size: 13px; color: #777; margin: 0; }
                .mtd-req-upload-btn {
                    padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
                    border: none; background: #ffbc34; color: #fff; cursor: pointer; transition: 0.2s;
                    white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;
                }
                .mtd-req-upload-btn:hover { background: #f39c12; }
                .mtd-req-upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>

            <div className="mtd-doc-header">
                <h4>My Documents</h4>
                <p>Upload your supporting documents below. Each file will be reviewed by your assigned accountant.</p>
            </div>

            {/* Action Required: Requested Documents */}
            {requestedDocs.length > 0 && (
                <div className="mtd-req-section">
                    <div className="mtd-req-header">
                        <FaExclamationCircle />
                        <h5>Action Required: Pending Requests</h5>
                    </div>
                    <div className="mtd-req-list">
                        {requestedDocs.map(reqDoc => (
                            <div key={reqDoc.id} className="mtd-req-item">
                                <div className="mtd-req-info" style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                                        <h6 style={{ margin: 0 }}>{DOCUMENT_TYPES.find(t => t.id === reqDoc.documentType)?.label || reqDoc.documentType}</h6>
                                        {reqDoc.priority && (
                                            <span style={{
                                                fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "12px",
                                                backgroundColor: reqDoc.priority === "urgent" || reqDoc.priority === "high" ? "#fee2e2" : reqDoc.priority === "medium" ? "#fef3c7" : "#e0e7ff",
                                                color: reqDoc.priority === "urgent" || reqDoc.priority === "high" ? "#dc2626" : reqDoc.priority === "medium" ? "#d97706" : "#4f46e5",
                                                textTransform: "uppercase"
                                            }}>
                                                {reqDoc.priority} Priority
                                            </span>
                                        )}
                                        {reqDoc.deadline && (
                                            <span style={{ fontSize: "12px", color: "#e11d48", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                                                <FaHourglass size={10} /> Due: {new Date(reqDoc.deadline).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    {reqDoc.message ? (
                                        <div style={{ background: "#fff", padding: "8px 12px", borderRadius: "6px", borderLeft: "3px solid #ffbc34", fontSize: "13px", color: "#555", marginTop: "8px" }}>
                                            <strong>Note from Accountant:</strong> {reqDoc.message}
                                        </div>
                                    ) : (
                                        <p>Your accountant has requested this document to proceed.</p>
                                    )}
                                </div>
                                <div>
                                    <input 
                                        type="file" 
                                        id={`req-upload-${reqDoc.id}`} 
                                        style={{ display: "none" }} 
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        onChange={(e) => handleUpload(e.target.files, reqDoc.id)}
                                    />
                                    <button 
                                        className="mtd-req-upload-btn"
                                        disabled={uploadingRequestId === reqDoc.id}
                                        onClick={() => document.getElementById(`req-upload-${reqDoc.id}`).click()}
                                    >
                                        {uploadingRequestId === reqDoc.id ? (
                                            <><div className="spinner-border spinner-border-sm" /> Uploading...</>
                                        ) : (
                                            <><FaCloudUploadAlt /> Upload File</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload Zone */}
            <div
                className={`mtd-upload-zone ${dragOver ? "drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="mtd-upload-icon">
                    {uploading ? <div className="spinner-border" role="status" style={{ width: 28, height: 28, borderWidth: 3, color: "#37a267" }} /> : <FaCloudUploadAlt />}
                </div>
                <div className="mtd-upload-title">
                    {uploading ? "Uploading..." : "Drag & drop files or click to browse"}
                </div>
                <div className="mtd-upload-sub">PDF, JPG, PNG, DOCX — up to 10 MB each</div>

                <div className="mtd-type-select" onClick={(e) => e.stopPropagation()}>
                    {DOCUMENT_TYPES.map((t) => (
                        <button
                            key={t.id}
                            className={`mtd-type-btn ${selectedType === t.id ? "selected" : ""}`}
                            onClick={() => setSelectedType(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <button
                    className="mtd-upload-btn"
                    disabled={uploading}
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                    <FaCloudUploadAlt /> {uploading ? "Uploading..." : "Choose Files"}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: "none" }}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => handleUpload(e.target.files)}
                />
            </div>

            {/* Document List */}
            <div className="mtd-doc-list">
                {loading ? (
                    <div className="text-center py-4">
                        <div className="spinner-border theme-color" role="status" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="mtd-empty-docs">
                        <FaCloudUploadAlt />
                        <p>No documents uploaded yet. Use the upload zone above to get started.</p>
                    </div>
                ) : (
                    documents.map((doc) => {
                        const st = statusConfig[doc.status] || statusConfig["Uploaded"];
                        const typLabel = DOCUMENT_TYPES.find(t => t.id === doc.documentType)?.label || doc.documentType;
                        return (
                            <div className="mtd-doc-item" key={doc.id}>
                                <div className="mtd-doc-file-icon">
                                    <FileIcon mimeType={doc.mimeType} />
                                </div>
                                <div className="mtd-doc-info">
                                    <div className="mtd-doc-name">{doc.originalFileName}</div>
                                    <div className="mtd-doc-meta">
                                        {typLabel} · {formatSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                </div>
                                <span
                                    className="mtd-status-badge"
                                    style={{ background: st.bg, color: st.color }}
                                >
                                    {st.label}
                                </span>
                                {doc.cloudinaryUrl && (
                                    <a
                                        href={doc.cloudinaryUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mtd-doc-view-link"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        View
                                    </a>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
