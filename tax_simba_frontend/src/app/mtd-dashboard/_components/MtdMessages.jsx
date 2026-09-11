"use client";
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { IoChatbubbles, IoPaperPlane } from "react-icons/io5";
import { FaUserTie, FaUserCircle } from "react-icons/fa";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import toast from "react-hot-toast";

export default function MtdMessages({ session, accountantInfo, taxReturnDbId }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [sending, setSending] = useState(false);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    useEffect(() => {
        if (session?.accessToken && taxReturnDbId) {
            fetchMessages();
        }
    }, [session, taxReturnDbId]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/communication-log/${taxReturnDbId}`,
                {},
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            const emails = res.data?.data?.emails || [];
            const formatted = emails.map((email) => ({
                id: email.id,
                sender: email.accountant?.name || "Accountant",
                message: email.parsedEmailData?.messageText || email.emailData?.messageContent || email.emailData?.body || "",
                time: email.sentAt,
                senderRole: email?.emailData?.senderRole || "ACCOUNTANT",
                subject: email.subject || email.emailData?.subject || "—",
            })).reverse();
            setMessages(formatted);
        } catch (err) {
            console.error("Error fetching messages", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!subject.trim() || !body.trim()) {
            return toast.error("Please fill in subject and message.");
        }
        if (!accountantInfo?.id) {
            return toast.error("No accountant assigned yet. Cannot send message.");
        }
        setSending(true);
        try {
            await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}client/send-to-specific-accountant`,
                {
                    subject,
                    message: body,
                    accountantId: accountantInfo.id,
                    priority: "normal",
                    taxReturnId: taxReturnDbId, // Link message to the tax return
                },
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            toast.success("Message sent successfully!");
            setSubject("");
            setBody("");
            setShowModal(false);
            await fetchMessages();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to send message.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div>
            <style>{`
                .mtd-msg-header {
                    display: flex; justify-content: space-between; align-items: flex-start;
                    margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
                }
                .mtd-msg-header-text h4 { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; }
                .mtd-msg-header-text p { color: #888; font-size: 14px; margin: 0; }

                .mtd-send-btn {
                    padding: 10px 22px; border-radius: 50px; font-size: 14px; font-weight: 700;
                    border: none; background: linear-gradient(135deg, #37a267, #2e8a56);
                    color: #fff; cursor: pointer; transition: 0.3s;
                    display: flex; align-items: center; gap: 8px; white-space: nowrap;
                }
                .mtd-send-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(55, 162, 103,0.35); }
                .mtd-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

                .mtd-accountant-banner {
                    display: flex; align-items: center; gap: 16px;
                    background: linear-gradient(135deg, #0d2b1e, #1a4a32);
                    border-radius: 16px; padding: 18px 22px; margin-bottom: 24px;
                    border: 1px solid rgba(55, 162, 103,0.2);
                }
                .mtd-acc-avatar {
                    width: 48px; height: 48px; border-radius: 50%;
                    background: linear-gradient(135deg, #37a267, #2e8a56);
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; font-size: 20px; font-weight: 700; flex-shrink: 0;
                }
                .mtd-acc-name { font-size: 16px; font-weight: 700; color: #fff; margin: 0 0 2px; }
                .mtd-acc-role { font-size: 12px; color: rgba(255,255,255,0.55); }

                .mtd-messages-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    max-height: 400px;
                    overflow-y: auto;
                    padding-right: 8px;
                }
                .mtd-messages-list::-webkit-scrollbar {
                    width: 6px;
                }
                .mtd-messages-list::-webkit-scrollbar-track {
                    background: transparent;
                }
                .mtd-messages-list::-webkit-scrollbar-thumb {
                    background: #e4e4e7;
                    border-radius: 10px;
                }
                .mtd-messages-list::-webkit-scrollbar-thumb:hover {
                    background: #d4d4d8;
                }

                .mtd-message-bubble {
                    max-width: 75%; padding: 14px 18px; border-radius: 18px;
                    position: relative; animation: fadeUp 0.3s ease;
                }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

                .mtd-msg-row { display: flex; gap: 10px; align-items: flex-end; }
                .mtd-msg-row.from-accountant { flex-direction: row; }
                .mtd-msg-row.from-client { flex-direction: row-reverse; }

                .mtd-msg-avatar {
                    width: 32px; height: 32px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 14px; flex-shrink: 0;
                }

                .bubble-accountant {
                    background: #f4f4f5; color: #222; border-bottom-left-radius: 4px;
                }
                .bubble-client {
                    background: linear-gradient(135deg, #37a267, #2e8a56);
                    color: #fff; border-bottom-right-radius: 4px;
                }
                .mtd-msg-subject { font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.5px; margin-bottom: 4px; opacity: 0.65; }
                .mtd-msg-text { font-size: 14px; line-height: 1.5; margin: 0; }
                .mtd-msg-time { font-size: 11px; opacity: 0.55; margin-top: 4px; display: block; }

                .mtd-empty-msgs { text-align: center; padding: 60px 20px; color: #ccc; }
                .mtd-empty-msgs svg { font-size: 52px; margin-bottom: 16px; display: block; margin: 0 auto 16px; }
                .mtd-empty-msgs p { font-size: 15px; margin: 0; }
            `}</style>

            {/* Header */}
            <div className="mtd-msg-header">
                <div className="mtd-msg-header-text">
                    <h4>Messages</h4>
                    <p>Communicate directly with your assigned accountant.</p>
                </div>
                <button
                    className="mtd-send-btn"
                    onClick={() => setShowModal(true)}
                    disabled={!accountantInfo}
                >
                    <IoPaperPlane /> New Message
                </button>
            </div>

            {/* Accountant Banner */}
            {accountantInfo ? (
                <div className="mtd-accountant-banner">
                    <div className="mtd-acc-avatar">
                        {accountantInfo.name?.[0]?.toUpperCase() || <FaUserTie />}
                    </div>
                    <div>
                        <p className="mtd-acc-name">
                            {accountantInfo.name} {accountantInfo.surname}
                        </p>
                        <p className="mtd-acc-role">Your Assigned Accountant</p>
                    </div>
                </div>
            ) : (
                <div style={{ background: "#fef9ee", border: "1px solid #f0c060", borderRadius: 14, padding: "14px 20px", marginBottom: 24, color: "#b7860c", fontSize: 14 }}>
                    No accountant has been assigned to you yet. Messaging will be available once an accountant is assigned.
                </div>
            )}

            {/* Messages */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border theme-color" role="status" />
                </div>
            ) : messages.length === 0 ? (
                <div className="mtd-empty-msgs">
                    <IoChatbubbles />
                    <p>No messages yet. Start the conversation with your accountant!</p>
                </div>
            ) : (
                <div className="mtd-messages-list">
                    {messages.map((msg) => {
                        const isClient = msg.senderRole === "CLIENT";
                        return (
                            <div
                                key={msg.id}
                                className={`mtd-msg-row ${isClient ? "from-client" : "from-accountant"}`}
                            >
                                <div
                                    className="mtd-msg-avatar"
                                    style={{
                                        background: isClient
                                            ? "linear-gradient(135deg, #37a267, #2e8a56)"
                                            : "#e8e8e8",
                                        color: isClient ? "#fff" : "#666",
                                    }}
                                >
                                    {isClient ? <FaUserCircle /> : <FaUserTie />}
                                </div>
                                <div className={`mtd-message-bubble ${isClient ? "bubble-client" : "bubble-accountant"}`}>
                                    {msg.subject && (
                                        <div className="mtd-msg-subject">{msg.subject}</div>
                                    )}
                                    <p className="mtd-msg-text">{msg.message || "(No content)"}</p>
                                    <span className="mtd-msg-time">
                                        {new Date(msg.time).toLocaleString("en-GB", {
                                            day: "numeric", month: "short", year: "numeric",
                                            hour: "2-digit", minute: "2-digit"
                                        })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            )}

            {/* Compose Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg" className="main-modal">
                <Modal.Header closeButton style={{ background: "#0d2b1e", borderBottom: "1px solid rgba(55, 162, 103,0.2)" }}>
                    <Modal.Title style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>
                        <IoPaperPlane className="me-2" style={{ color: "#37a267" }} />
                        New Message to {accountantInfo?.name} {accountantInfo?.surname}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: 28 }}>
                    <Form.Group className="mb-4">
                        <Form.Label style={{ fontWeight: 700, fontSize: 13, color: "#555" }}>Subject *</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="e.g. Question about my VAT documents"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            style={{ borderRadius: 10, padding: "10px 14px" }}
                        />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label style={{ fontWeight: 700, fontSize: 13, color: "#555" }}>Message *</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={5}
                            placeholder="Write your message here..."
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            style={{ borderRadius: 10, padding: "12px 14px", resize: "none" }}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer style={{ borderTop: "1px solid #f0f0f0", padding: "16px 24px" }}>
                    <Button variant="light" onClick={() => setShowModal(false)} style={{ borderRadius: 50, fontWeight: 600 }}>
                        Cancel
                    </Button>
                    <button
                        className="mtd-send-btn"
                        onClick={handleSend}
                        disabled={sending || !subject.trim() || !body.trim()}
                    >
                        {sending ? <Spinner animation="border" size="sm" /> : <IoPaperPlane />}
                        {sending ? "Sending..." : "Send Message"}
                    </button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}
