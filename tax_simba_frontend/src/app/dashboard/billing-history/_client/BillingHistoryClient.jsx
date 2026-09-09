"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import axios from "axios";
import BillingHistoryUI from "./BillingHistoryUI";

export default function BillingHistoryClient() {
    const { data: session } = useSession();
    const sessionData = session || {};
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        if (!sessionData?.accessToken) return;

        const fetchDetails = async () => {
            try {
                const transactionRes = await axios.get(
                    `${process.env.NEXT_PUBLIC_API_URL}client/transaction/list`,
                    { headers: { Authorization: `Bearer ${sessionData.accessToken}` } }
                );

                if (transactionRes?.data?.data?.transactions) {
                    setTransactions(transactionRes.data.data.transactions);
                }
            } catch (error) {
                console.error("Failed to load transaction info", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [sessionData?.accessToken]);

    const handleDownloadInvoice = async (transactionId) => {
        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}client/transaction/${transactionId}/invoice/download`,
                {
                    headers: { Authorization: `Bearer ${sessionData.accessToken}` },
                    responseType: 'blob'
                }
            );
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `VAT-Invoice-${transactionId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download VAT Invoice", error);
        }
    };

    return <BillingHistoryUI
        transactions={transactions}
        loading={loading}
        onDownloadInvoice={handleDownloadInvoice}
    />;
}
