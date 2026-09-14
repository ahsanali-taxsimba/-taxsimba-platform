'use client';
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Offcanvas } from "react-bootstrap";
import EmailModal from "./EmailModal";
import { toast } from "react-hot-toast";

const ChatBox = ({ show, handleClose, ids, token, id }) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [trackMessageSend, setTrackMessageSend] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);

    // Email send handler
    const handleOpenmailModal = () => {
        if (ids?.accountantId){
            setShowModal(true)
        } else {
            toast.error("Accountant not assigned yet. Cannot send message.");
        }
    }
    const handleMailSend = async ({ subject, body, accountantId, taxReturnId, token }) => {
        console.log("handleMailSend called", {subject, body, accountantId, taxReturnId, token});
        if (!subject || !body || !accountantId || !taxReturnId) {
            console.error("All fields are required");
            return;
        }

        try {
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/send-to-specific-accountant`,
                {
                    subject,
                    message: body,
                    accountantId,
                    taxReturnId,
                    priority: "high"
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.data.success) {
                toast.success("Email sent successfully");
                setTrackMessageSend(!trackMessageSend);
            } else {
                console.error("Failed to send email:", response.data.message);
                toast.error("Failed to send email");
            }
        } catch (err) {
            console.error("Error sending email:", err);
            toast.error("Failed to send email");
        } finally {
            setShowModal(false);
        }
    };

    const fetchMessages = async () => {
        if (!ids?.taxReturnId) return;
        setLoading(true);
        try {
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/communication-log/${ids?.taxReturnId}`,
                { page: 1, limit: 1000 },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

             if (res.data.success) {
        setChatHistory(res.data.data.emails || []);
      } else {
        console.error('Failed to fetch chat data:', res.data.message);
      }
            const emails = res.data?.data?.emails || [];

            const formatted = emails.map((email) => ({
                id: email.id,
                sender: email.accountant?.name || "Accountant",
                message: email.parsedEmailData?.messageText || "",
                time: email.sentAt,
                senderRole: email?.emailData?.senderRole || "CLIENT",
            }));
            setMessages(formatted.reverse());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (show && ids?.taxReturnId) fetchMessages();
    }, [show, ids?.taxReturnId, trackMessageSend]);

    return (
        <>
            <Offcanvas show={show} onHide={handleClose} placement="end" scroll backdrop={false}>
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title>Communication Log</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body className="d-flex flex-column p-0">
                    <div className="flex-grow-1 overflow-auto p-3" style={{ backgroundColor: "#f8f9fa", minHeight: "400px" }}>
                        {loading ? (
                            <p className="text-center">Loading...</p>
                        ) : messages.length === 0 ? (
                            <p className="text-center">No messages yet.</p>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className={`mb-2 d-flex flex-column ${msg.senderRole === "ACCOUNTANT" ? "reciever" : msg.senderRole === "ADMIN" ? "reciever admin_reciever" : "sender"}`}>
                                    <small>{msg.senderRole === "ACCOUNTANT" ? "Accountant" : msg.sender}</small>
                                    <p>
                                        {msg.message}
                                    </p>
                                    <small className="mt-1" style={{ fontSize: "0.7rem" }}>
                                        {new Date(msg.time).toLocaleString()}
                                    </small>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Send Message */}
                    <div className="d-flex justify-content-center p-3 m-3">
                        <button
                            className="common-btn d-flex align-items-center justify-content-center"
                            style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem" }}
                            onClick={() => handleOpenmailModal()}
                        >
                            <i className="fa-solid fa-paper-plane me-2"></i>
                            Send Message
                        </button>
                    </div>

                </Offcanvas.Body>
            </Offcanvas>
            {/* Email Modal */}
            <EmailModal
                show={showModal}
                onClose={() => setShowModal(false)}
                onSend={handleMailSend}
                ids={ids}
                token={token}
            />
        </>
    );
};

export default ChatBox;
