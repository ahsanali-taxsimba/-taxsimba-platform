'use client';
import { FileText } from "lucide-react";
import { useSession } from "next-auth/react";
import React, { useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { IoDocumentAttachSharp } from "react-icons/io5";
import toast from 'react-hot-toast';
const DraftFeedback = ({ state, item }) => {
  const { data: sessionData, status } = useSession();
  const access_token = sessionData?.accessToken;
  const [showModal, setShowModal] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [confirmFinalSubmission, setConfirmFinalSubmission] = useState(false);
  const isClickable = state === "active" || state === "completed";
  const taxReturnId = item?.taxReturn?.id;

  const handleOpen = () => {
    if (isClickable) setShowModal(true);
  };

  const handleSubmit = async (isApprove) => {
  if (!taxReturnId) {
    // alert("No taxReturnId found.");
    return;
  }
  if (status !== "authenticated" || !access_token) {
    // alert("Please sign in again.");
    return;
  }

  // Set confirmFinalSubmission as false for both approval and rejection
  const confirmFinalSubmission = false; // You may adjust this logic based on specific behavior for "approve" and "reject"
  const url = isApprove ? `${process.env.NEXT_PUBLIC_API_URL}client/drafts/${taxReturnId}/approve` : `${process.env.NEXT_PUBLIC_API_URL}client/drafts/${taxReturnId}/reject`;
  const payload = isApprove?
      {
        approvalNotes: feedback?.trim() || "",
        confirmFinalSubmission: true,
      } :
      {
        rejectionReason: feedback?.trim() || ""
      };

  if(isApprove){
    setSubmitting(true);
  }
  else{
    setRejecting(true);
  }
  try {
    const apiUrl = url;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message = `Approval failed (${res.status})`;
      try {
        const j = await res.json();
        if (j?.message) message = j.message;
        if (j?.errors) {
          // If server returns validation errors, append a compact view
          const v = Object.entries(j.errors)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" | ");
          if (v) message += ` — ${v}`;
        }
      } catch (_) { }
      throw new Error(message);
    }

    // Success UX: close + reset
    setShowModal(false);
    setFeedback("");
    // Confirm success for either approval or rejection
    toast.success(isApprove ? "Draft approved successfully." : "Draft rejected successfully.");
    window.location.reload();
  } catch (err) {
    console.error("Approve draft error:", err);
    toast.error(err?.message || "Failed to approve/reject draft.");
  } finally {
    setSubmitting(false);
    setRejecting(false);
  }
};



  // Add these helpers (top-level in the file)
  const extFromMime = (mime = "") => {
    const map = {
      "application/pdf": "pdf",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
    };
    return map[mime] || "";
  };

  const safeFilename = (name = "draft") =>
    name.split("/").pop().replace(/[\\/:*?"<>|]/g, "_");

  const forceDownload = (blob, filename = "draft") => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  // Replace your current downloadDraft with this:
  const downloadDraft = async () => {
  if (!taxReturnId) {
    // alert("No taxReturnId found.");
    return;
  }
  if (status !== "authenticated" || !access_token) {
    // alert("Please sign in again to download the draft.");
    return;
  }

  setDownloading(true);
  try {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}client/drafts/${taxReturnId}`;
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) {
      let msg = `Download failed (${res.status})`;
      try {
        const j = await res.json();
        if (j?.message) msg = j.message;
      } catch (_) { }
      throw new Error(msg);
    }
    
    const meta = await res.json();

    // Extract the document URL
    const drafts = meta?.data?.documents?.draftDocuments || [];
    if (!drafts.length) {
      throw new Error("No draft document available.");
    }

    // Pick the latest draft document (if there are multiple)
    const latest = drafts
      .slice()
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];

    const fileUrl = latest.downloadUrl;
    if (!fileUrl) throw new Error("Draft document URL is missing.");

    // Get file details and download
    let filename = safeFilename(latest.filename || "draft");
    const ext = extFromMime(latest.mimeType);
    if (!/\.[a-z0-9]+$/i.test(filename) && ext) {
      filename = `${filename}.${ext}`;
    }

    // Fetch the actual file from the URL
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to fetch draft file (${fileRes.status})`);
    }
    const blob = await fileRes.blob();
    forceDownload(blob, filename);
  } catch (err) {
    console.error("Draft download error:", err);
    toast.error(err?.message || "Failed to download draft");
  } finally {
    setDownloading(false);
  }
};



  return (
    <>
      {/* Step Box */}
      <div
        className="d-flex flex-column align-items-center justify-content-center gap-2"
        style={{ cursor: isClickable ? "pointer" : "default" }}
        onClick={handleOpen}
      >
        <div className="icon">
          {/* <i className="fa-regular fa-user" /> */}
          <FileText className="lucid_icon" />
        </div>
        <div className="px-2">Draft Ready</div>
      </div>

      {/* Modal */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        centered
        size="md"
        dialogClassName="rounded-4 border-0"
      >
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="fw-bold">Draft Feedback</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="d-grid gap-3">
            {/* Download Draft Button */}
            <Button
              variant="outline-primary"
              size="lg"
              className="d-flex align-items-center justify-content-center shadow-sm"
              onClick={downloadDraft}
              disabled={downloading || !taxReturnId}
            >
              {downloading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Downloading…
                </>
              ) : (
                <>
                  <IoDocumentAttachSharp className="me-2 fs-5" />
                  Download Draft
                </>
              )}
            </Button>

            {/* Feedback Input */}
            <Form.Group controlId="feedback">
              <Form.Label className="fw-semibold">Your Feedback</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                placeholder="Enter your feedback..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="shadow-sm border-1 rounded-3"
              />
            </Form.Group>
          </div>
        </Modal.Body>

        <Modal.Footer className="border-0">
          <Button
    variant="secondary"
    onClick={() => setShowModal(false)}
    className="rounded-3 px-4"
  >
    Close
  </Button>
  <Button
    variant="danger"
    onClick={() => handleSubmit(false)} // Reject
    className="rounded-3 px-4"
    disabled={submitting}
  > {
    rejecting ? 
    <>
        <Spinner animation="border" size="sm" className="me-2" />
        Rejecting…
      </>
    :
    "Reject"
  }
  </Button>
  <Button
    variant="success"
    onClick={() => handleSubmit(true)} // Approve
    className="rounded-3 px-4"
    disabled={submitting}
  >
    {submitting ? (
      <>
        <Spinner animation="border" size="sm" className="me-2" />
        Submitting…
      </>
    ) :  (
      "Approve"
    )}
  </Button>

        </Modal.Footer>

        <style jsx>{`
          .modal-content {
            border-radius: 1rem;
            overflow: hidden;
          }
          .btn-outline-primary {
            transition: all 0.2s;
          }
          .btn-outline-primary:hover {
            background-color: #0d6efd;
            color: #fff;
          }
        `}</style>
      </Modal>
    </>
  );
};

export default DraftFeedback;