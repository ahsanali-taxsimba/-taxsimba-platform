"use client";
import { Spinner, Table } from "react-bootstrap";
import { getCurrencySymbol } from "@/utils/commonHelper";

export default function BillingHistoryUI({ transactions = [], loading, onDownloadInvoice }) {
    if (loading) {
        return (
            <div className="d-flex justify-content-center py-5">
                <Spinner animation="border" variant="success" />
            </div>
        );
    }

    // Standardized date formatter for MM/DD/YYYY
    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    };

    const formatPaymentMethod = (methodStr) => {
        if (!methodStr) return "Card";
        const str = methodStr.toLowerCase();
        if (str.includes("klarna")) return "Klarna";
        if (str.includes("clearpay") || str.includes("afterpay")) return "Clearpay";
        if (str.includes("google") || str.includes("gpay")) return "Google Pay";
        if (str.includes("apple")) return "Apple Pay";
        if (str.includes("stripe_checkout")) return "Stripe Checkout";
        return "Card";
    };

    const txRecords = Array.isArray(transactions) ? transactions : [];

    return (
        <div className="edt_profile_box">
            <div className="edt_prof_head">
                <h3>Billing History</h3>
            </div>

            <div className="mt-4">
                <div className="table-responsive bg-white border rounded shadow-sm">
                    <Table hover className="mb-0 text-nowrap" style={{ fontSize: '0.95rem' }}>
                        <thead className="bg-light">
                            <tr>
                                <th className="py-3 px-4 border-bottom-0">Sn.</th>
                                <th className="py-3 px-4 border-bottom-0">Transaction ID</th>
                                <th className="py-3 px-4 border-bottom-0">Date</th>
                                <th className="py-3 px-4 border-bottom-0">Amount</th>
                                <th className="py-3 px-4 border-bottom-0">Description</th>
                                <th className="py-3 px-4 border-bottom-0">Payment Method</th>
                                <th className="py-3 px-4 border-bottom-0 text-center">Status</th>
                                <th className="py-3 px-4 border-bottom-0 text-center">Receipt / Invoice</th>
                            </tr>
                        </thead>
                        <tbody>
                            {txRecords.length > 0 ? (
                                txRecords.map((tx, i) => (
                                    <tr key={i}>
                                        <td className="py-3 px-4">{i + 1}</td>
                                        <td className="py-3 px-4 text-muted" style={{ fontSize: '0.85rem' }}>{tx.stripeSubscriptionId || tx.stripePaymentIntentId || tx.id}</td>
                                        <td className="py-3 px-4 text-muted">{formatDate(tx.createdAt)}</td>
                                        <td className="py-3 px-4 fw-bold">{getCurrencySymbol(tx.currency)}{tx.amount}</td>
                                        <td className="py-3 px-4 text-muted text-capitalize">{tx.description?.replace('Subscription purchase for ', '') || "Payment"}</td>
                                        <td className="py-3 px-4 text-muted">{tx.modeOfPayment || formatPaymentMethod(tx.paymentMethodId || tx.paymentMethodType)}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`badge px-2 py-1 text-capitalize`} style={{ fontSize: '0.75rem', backgroundColor: tx.status === 'succeeded' || tx.status === 'completed' ? '#14ab71' : '#dc3545' }}>
                                                {tx.status === 'succeeded' ? 'Complete' : tx.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-nowrap">
                                            {tx.receiptUrl ? (
                                                <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ backgroundColor: '#f0fdf4', color: '#14ab71', border: '1px solid #14ab71', marginRight: '6px' }}>
                                                    Receipt
                                                </a>
                                            ) : null}
                                            {tx.status === 'succeeded' || tx.status === 'completed' ? (
                                                <button onClick={() => onDownloadInvoice(tx.id)} className="btn btn-sm" style={{ backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #0284c7' }}>
                                                    VAT Invoice
                                                </button>
                                            ) : (
                                                !tx.receiptUrl && <span className="text-muted fst-italic" style={{ fontSize: '0.8rem' }}>N/A</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="text-center py-4 text-muted fst-italic">
                                        No billing history found yet. Future payments will appear here.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
