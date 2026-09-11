import React, { useState } from "react";
import { Modal, Button, Form, Row, Col, Spinner } from "react-bootstrap";
import { FiMail, FiX, FiSend, FiRefreshCw } from "react-icons/fi";

const EmailModal = ({ show, onClose, onSend, ids, token }) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // const [documents, setDocuments] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

    setLoading(true);
    await onSend({
      subject,
      body,
      accountantId: ids.accountantId,
      taxReturnId: ids.taxReturnId,
      token,
    });
    setLoading(false);

    // reset & close
    setSubject("");
    setBody("");
    onClose();
  };

  const resetEmailForm = () => {
    setSubject("");
    setBody("");
  }

  return (
    <Modal
      show={show}
      onHide={onClose}
      size="lg"
      centered
      backdrop="static"
      className="email-modal"
    >
      {/* Header */}
      <Modal.Header className="bg-light d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center">
          <FiMail className="text-primary me-2" size={22} />
          <div>
            <h5 className="mb-0">Email Client</h5>
            <small className="text-muted">To: TAXSIMBA</small>
          </div>
        </div>
        <Button variant="light" onClick={onClose} className="border-0">
          <FiX size={20} />
        </Button>
      </Modal.Header>

      {/* Body */}
      <Modal.Body>
        <Row>
          {/* Left Form */}
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Subject *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Tax Return Update"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Message Content *</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                placeholder="Write your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Form.Group>

                   </Col>

          {/* Right Preview */}
          <Col md={6}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label>Email Preview</Form.Label>
              <Button variant="link" className="p-0 text-primary" onClick={resetEmailForm}>
                <FiRefreshCw size={16} className="me-1" />
                Refresh
              </Button>
            </div>
            <div
              className="border rounded p-3 bg-light"
              style={{ height: "300px", overflowY: "auto" }}
            >
              <p className="mb-2 text-muted">
                <strong>Subject:</strong> {subject || "No subject"}
              </p>
              <div
                dangerouslySetInnerHTML={{
                  __html: body
                    ? body
                        .split("\n")
                        .map((line) => `<p>${line}</p>`)
                        .join("")
                    : "<p>Message preview will appear here.</p>",
                }}
              />
             
            </div>
          </Col>
        </Row>
      </Modal.Body>

      {/* Footer */}
      <Modal.Footer className="bg-light d-flex justify-content-between">
        <small className="text-muted">
          {body && subject
            ? "Ready to send"
            : "Email includes message content and document list"}
        </small>
        <div>
          <Button variant="secondary" onClick={onClose} className="me-2">
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!subject.trim() || !body.trim() || loading}
            onClick={handleSend}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Sending...
              </>
            ) : (
              <>
                <FiSend className="me-2" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default EmailModal;
