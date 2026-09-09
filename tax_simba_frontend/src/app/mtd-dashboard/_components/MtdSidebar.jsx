"use client";
import React from "react";
import { FaFileInvoice, FaUserCircle, FaHistory, FaFileInvoiceDollar, FaKey, FaBell } from "react-icons/fa";
import { IoDocumentText, IoLogOutSharp, IoChatbubbles } from "react-icons/io5";
import { signOut } from "next-auth/react";

export default function MtdSidebar({ activeTab, setActiveTab }) {
    const handleLogout = (e) => {
        e.preventDefault();
        signOut({ callbackUrl: "/" });
    };

    const menuItems = [
        { id: "overview", label: "Dashboard Overview", icon: <FaFileInvoice /> },
        // { id: "notifications", label: "Notifications", icon: <FaBell /> },
        { id: "taxHistory", label: "Tax History", icon: <FaHistory /> },
        { id: "subscriptions", label: "Current Subscription", icon: <FaFileInvoiceDollar /> },
        { id: "billingHistory", label: "Billing History", icon: <FaHistory /> },
        { id: "profile", label: "Profile Settings", icon: <FaUserCircle /> },
        { id: "notifications", label: "Notifications", icon: <FaBell /> },
        { id: "changePassword", label: "Change Password", icon: <FaKey /> },
    ];

    return (
        <div className="dashboard_layout">
            <div className="dashboard_sidebar_card">
                <ul className="dashboard_menu">
                    {menuItems.map((item) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                className={`menu_btn ${activeTab === item.id ? "active" : ""}`}
                                onClick={() => setActiveTab(item.id)}
                            >
                                <span className="me-2">{item.icon}</span>
                                <span className="menu_label">{item.label}</span>
                            </button>
                        </li>
                    ))}
                    <li>
                        <button type="button" className="menu_btn" onClick={handleLogout}>
                            <span className="me-2"><IoLogOutSharp /></span>
                            <span className="menu_label">Logout</span>
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    );
}