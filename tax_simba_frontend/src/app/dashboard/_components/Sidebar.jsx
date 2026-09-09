'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaFileInvoice, FaFileInvoiceDollar, FaKey, FaUserCircle, FaBell, FaHistory } from 'react-icons/fa';
import { IoDocumentText, IoLogOutSharp } from "react-icons/io5";
import { HiReceiptTax } from "react-icons/hi";
import { signOut } from 'next-auth/react';
import { MdNoAccounts } from 'react-icons/md';

const menuItems = [
    { id: 'tax-tracker', label: 'Tax Tracker', icon: <FaFileInvoice />, href: '/dashboard/tax-tracker' },

    { id: 'my-tax-return', label: 'My Tax Return', icon: <HiReceiptTax />, href: '/dashboard/my-tax-return' },
    { id: 'my-documents', label: 'My Documents', icon: <IoDocumentText />, href: '/dashboard/my-documents' },
    { id: 'notifications', label: 'Notifications', icon: <FaBell />, href: '/dashboard/notifications' },
    { id: 'my-subscriptions', label: 'Current Subscription', icon: <FaFileInvoiceDollar />, href: '/dashboard/my-subscriptions' },
    { id: 'billing-history', label: 'Billing History', icon: <FaHistory />, href: '/dashboard/billing-history' },
    { id: 'edit-profile', label: 'Profile Details', icon: <FaUserCircle />, href: '/dashboard/edit-profile' },
    { id: 'change-password', label: 'Change Password', icon: <FaKey />, href: '/dashboard/change-password' },
    // { id: 'delete-profile', label: 'Deactivate Account', icon: <MdNoAccounts />, href: '/dashboard/delete-profile' },
    { id: 'logout', label: 'Logout', icon: <IoLogOutSharp />, href: null },
];

export default function Sidebar() {
    const pathname = usePathname();

    const handleLogout = (e) => {
        e.preventDefault();
        signOut({ callbackUrl: '/' });
    };

    return (
        <div className="dashboard_layout">
            <div className="dashboard_sidebar_card">
                <ul className="dashboard_menu">
                    {menuItems.map((item) => {
                        const isActive = item.href && pathname === item.href;

                        if (!item.href) {
                            // Logout button
                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className="menu_btn"
                                        onClick={handleLogout}
                                    >
                                        <span className="me-2">{item.icon}</span>
                                        <span className="menu_label">{item.label}</span>
                                    </button>
                                </li>
                            );
                        }

                        return (
                            <li key={item.id}>
                                <Link
                                    href={item.href}
                                    className={`menu_btn ${isActive ? 'active' : ''}`}
                                >
                                    <span className="me-2">{item.icon}</span>
                                    <span className="menu_label">{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
