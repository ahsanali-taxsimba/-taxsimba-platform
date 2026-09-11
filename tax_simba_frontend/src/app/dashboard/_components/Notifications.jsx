"use client";
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
    FaBell, FaCheckDouble, FaCheck, FaSearch, FaCloudUploadAlt,
    FaFileInvoice, FaUserTie, FaExclamationCircle, FaChevronLeft, FaChevronRight
} from "react-icons/fa";
import toast from "react-hot-toast";

export default function Notifications({ session }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [activeFilterType, setActiveFilterType] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalNotifications, setTotalNotifications] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [typeCounts, setTypeCounts] = useState({});

    const limit = 10;

    const fetchNotifications = useCallback(async () => {
        if (!session?.accessToken) return;
        try {
            setLoading(true);
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}all-notifications`,
                {
                    page: currentPage,
                    limit,
                    unreadOnly: unreadOnly ? 1 : 0,
                    type: activeFilterType,
                    search: searchQuery
                },
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );

            const data = res.data?.data;
            setNotifications(data?.notifications || []);
            setTotalPages(data?.pagination?.pages || 1);
            setTotalNotifications(data?.pagination?.total || 0);
            setUnreadCount(data?.pagination?.unreadCount || 0);
            setTypeCounts(data?.filters?.typeCounts || {});
        } catch (err) {
            console.error("Error fetching notifications:", err);
            toast.error("Failed to load notifications.");
        } finally {
            setLoading(false);
        }
    }, [session, currentPage, unreadOnly, activeFilterType, searchQuery]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleMarkAsRead = async (notificationId) => {
        try {
            await axios.patch(
                `${process.env.NEXT_PUBLIC_API_URL}notifications/${notificationId}/read`,
                {},
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            toast.success("Notification marked as read");
        } catch (err) {
            console.error("Error marking notification as read:", err);
            toast.error("Failed to mark notification as read.");
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await axios.patch(
                `${process.env.NEXT_PUBLIC_API_URL}notifications/mark-all-read`,
                {},
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
            toast.success("All notifications marked as read");
        } catch (err) {
            console.error("Error marking all notifications as read:", err);
            toast.error("Failed to mark all as read.");
        }
    };

    // P0 M4: notification delete is HIDE/DEFER — control removed; no backend delete API.

    const filterTypes = [
        { id: "all", label: "All" },
        { id: "document", label: "Documents" },
        { id: "payment", label: "Payments" },
        { id: "review", label: "Review Tasks" },
        { id: "message", label: "Messages" },
        { id: "deadline", label: "Deadlines" },
        { id: "general", label: "General" }
    ];

    return (
        <div className="mtd-info-card shadow-sm p-4">
            {/* Header section */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center border-bottom pb-3 mb-4 gap-3">
                <div>
                    <h3 className="fw-bold text-dark d-flex align-items-center gap-2 mb-1" style={{ fontSize: "22px" }}>
                        <FaBell style={{ color: "#37a267" }} /> All Notifications
                        {unreadCount > 0 && (
                            <span className="badge bg-danger rounded-pill" style={{ fontSize: "12px", padding: "4px 8px" }}>
                                {unreadCount} New
                            </span>
                        )}
                    </h3>
                    <p className="text-muted mb-0" style={{ fontSize: "14px" }}>
                        Keep track of all actions, updates, and messages from your accountant.
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button 
                         className="btn btn-sm text-white fw-bold d-flex align-items-center gap-2 px-3 py-2"
                         style={{ background: "#37a267", borderRadius: "8px", border: "none" }}
                         onClick={handleMarkAllAsRead}
                    >
                        <FaCheckDouble size={14} /> Mark all as read
                    </button>
                )}
            </div>

            {/* Filters and Search Bar */}
            <div className="d-flex flex-column gap-3 mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    {/* Search Input */}
                    <div className="input-group" style={{ maxWidth: "350px", borderRadius: "8px", overflow: "hidden" }}>
                        <span className="input-group-text bg-light border" style={{ borderColor: "#ced4da" }}>
                            <FaSearch className="text-muted" size={14} />
                        </span>
                        <input
                            type="text"
                            className="form-control border-start-0"
                            style={{ fontSize: "14px", borderColor: "#ced4da" }}
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    {/* Unread Toggle */}
                    <div className="form-check form-switch d-flex align-items-center gap-2">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="unreadToggle"
                            checked={unreadOnly}
                            onChange={(e) => {
                                setUnreadOnly(e.target.checked);
                                setCurrentPage(1);
                            }}
                            style={{ cursor: "pointer", width: "40px", height: "20px" }}
                        />
                        <label className="form-check-label fw-semibold text-muted" htmlFor="unreadToggle" style={{ cursor: "pointer", fontSize: "14px" }}>
                            Show Unread Only
                        </label>
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                    {filterTypes.map(type => {
                        const count = type.id === "all" ? totalNotifications : (typeCounts[type.id] || 0);
                        const isSelected = activeFilterType === type.id;
                        return (
                            <button
                                key={type.id}
                                className={`btn btn-sm fw-semibold rounded-pill px-3 py-1 transition-all ${
                                    isSelected 
                                        ? "text-white" 
                                        : "btn-light border text-muted"
                                }`}
                                style={{
                                    fontSize: "13px",
                                    backgroundColor: isSelected ? "#37a267" : "",
                                    borderColor: isSelected ? "#37a267" : "#e2e8f0"
                                }}
                                onClick={() => {
                                    setActiveFilterType(type.id);
                                    setCurrentPage(1);
                                }}
                            >
                                {type.label} {count > 0 && <span className={`badge ms-1 ${isSelected ? "bg-white text-success" : "bg-secondary text-white"}`}>{count}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Notifications Feed */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-success" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : notifications.length > 0 ? (
                <div className="d-flex flex-column gap-3">
                    {notifications.map(notif => {
                        let NotifIcon = FaBell;
                        let iconColor = "#95a5a6";
                        let bgColor = "#f8f9fa";

                        if (notif.type === "document_request" || notif.type === "document") {
                            NotifIcon = FaCloudUploadAlt;
                            iconColor = "#3498db";
                            bgColor = "#ebf5fb";
                        } else if (notif.type === "completion") {
                            NotifIcon = FaCheck;
                            iconColor = "#2ecc71";
                            bgColor = "#eafaf1";
                        } else if (notif.type === "assignment") {
                            NotifIcon = FaUserTie;
                            iconColor = "#9b59b6";
                            bgColor = "#f5eef8";
                        } else if (notif.type === "payment") {
                            NotifIcon = FaFileInvoice;
                            iconColor = "#f1c40f";
                            bgColor = "#fef9e7";
                        } else if (notif.type === "admin_flag") {
                            NotifIcon = FaExclamationCircle;
                            iconColor = "#e74c3c";
                            bgColor = "#fdedd8";
                        }

                        return (
                            <div 
                                key={notif.id} 
                                className={`d-flex align-items-center justify-content-between p-3 rounded border transition-all ${
                                    notif.read ? 'bg-light' : 'bg-white shadow-sm'
                                }`}
                                style={{ 
                                    borderLeft: `4px solid ${notif.read ? '#bdc3c7' : iconColor}`,
                                    transition: "all 0.2s ease-in-out"
                                }}
                            >
                                <div className="d-flex align-items-center gap-3 overflow-hidden w-100">
                                    <div 
                                        className="d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ 
                                            width: "44px", 
                                            height: "44px", 
                                            borderRadius: "50%", 
                                            backgroundColor: bgColor,
                                            color: iconColor 
                                        }}
                                    >
                                        <NotifIcon size={20} />
                                    </div>
                                    <div className="overflow-hidden" style={{ minWidth: 0 }}>
                                        <p 
                                            className={`mb-1 ${notif.read ? 'text-muted' : 'text-dark fw-semibold'}`} 
                                            style={{ fontSize: "14px", lineHeight: "1.5", margin: 0 }}
                                        >
                                            {notif.message}
                                        </p>
                                        <span className="text-muted d-block mt-1" style={{ fontSize: "12px" }}>
                                            {notif.time}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="d-flex align-items-center gap-2 ms-3 flex-shrink-0">
                                    {!notif.read && (
                                        <button 
                                            className="btn btn-sm btn-light border d-flex align-items-center justify-content-center"
                                            style={{ width: "32px", height: "32px", borderRadius: "50%", padding: 0 }}
                                            onClick={() => handleMarkAsRead(notif.id)}
                                            title="Mark as read"
                                        >
                                            <FaCheck size={12} className="text-success" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="d-flex justify-content-between align-items-center border-top pt-4 mt-3">
                            <span className="text-muted" style={{ fontSize: "13px" }}>
                                Showing page {currentPage} of {totalPages}
                            </span>
                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-sm btn-light border px-3 d-flex align-items-center gap-1 fw-semibold"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    style={{ fontSize: "13px" }}
                                >
                                    <FaChevronLeft size={10} /> Previous
                                </button>
                                <button
                                    className="btn btn-sm btn-light border px-3 d-flex align-items-center gap-1 fw-semibold"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    style={{ fontSize: "13px" }}
                                >
                                    Next <FaChevronRight size={10} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-5 text-muted border rounded bg-light">
                    <FaBell size={48} className="mb-3 text-light" style={{ opacity: 0.5 }} />
                    <h5 className="fw-bold mb-1">No notifications found</h5>
                    <p className="mb-0" style={{ fontSize: "14px" }}>
                        Try changing your filters or searching for something else.
                    </p>
                </div>
            )}
        </div>
    );
}
