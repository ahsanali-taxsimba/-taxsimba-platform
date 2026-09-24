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
        { id: "overview", label: "MTD overview", icon: <FaFileInvoice /> },
        { id: "taxHistory", label: "Quarterly history", icon: <FaHistory /> },
        { id: "subscriptions", label: "Current MTD plan", icon: <FaFileInvoiceDollar /> },
        { id: "billingHistory", label: "Billing history", icon: <FaHistory /> },
        { id: "profile", label: "Profile & support", icon: <FaUserCircle /> },
        { id: "notifications", label: "Requests & messages", icon: <FaBell /> },
        { id: "changePassword", label: "Change password", icon: <FaKey /> },
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