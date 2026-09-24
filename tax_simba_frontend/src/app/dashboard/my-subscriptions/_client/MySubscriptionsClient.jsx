"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import axios from "axios";
import { Logout } from "@/app/lib/api";
import MySubscriptionsUI from "./MySubscriptionsUI";
import BillingHistoryClient from "../../billing-history/_client/BillingHistoryClient";
import { resolveCatalogueCategory } from "@/lib/catalogueJourney";

export default function MySubscriptionsClient() {
    const { data: session } = useSession();
    const sessionData = session || {};
    const pathname = usePathname();
    const [userData, setUserData] = useState({});
    const [loading, setLoading] = useState(true);

    const [confirmData, setConfirmData] = useState(null);
    const [allPlans, setAllPlans] = useState([]);

    useEffect(() => {
        if (!sessionData?.accessToken) return;

        const fetchDetails = async () => {
            try {
                // Scope catalogue to the workspace in use — never mix SA + MTD cards.
                let category = resolveCatalogueCategory(sessionData, null);
                if (pathname?.startsWith("/mtd-dashboard")) {
                    category = "mtd";
                } else if (pathname?.startsWith("/dashboard")) {
                    category = "taxSimba";
                }
                const [accountRes, confirmRes, plansRes] = await Promise.all([
                    axios.post(
                        `${process.env.NEXT_PUBLIC_API_URL}auth/get-account-details`,
                        {},
                        { headers: { Authorization: `Bearer ${sessionData.accessToken}` } }
                    ),
                    axios.get(
                        `${process.env.NEXT_PUBLIC_API_URL}client/active/subscription/list`,
                        { headers: { Authorization: `Bearer ${sessionData.accessToken}` } }
                    ).catch(e => {
                        console.error("Confirm API Error:", e);
                        return { data: null };
                    }),
                    axios.get(
                        `${process.env.NEXT_PUBLIC_API_URL}subscription-plans?category=${category}`
                    ).catch(e => {
                        console.error("Plans API Error:", e);
                        return { data: { data: [] } };
                    })
                ]);

                setUserData(accountRes?.data?.data);
                if (confirmRes?.data?.data) {
                    setConfirmData(confirmRes.data.data);
                }
                if (plansRes?.data?.data) {
                    setAllPlans(plansRes.data.data);
                }
            } catch (error) {
                console.error("Failed to load subscription info", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [sessionData?.accessToken, pathname]);

    return (
        <>
            <MySubscriptionsUI
                userData={userData}
                confirmData={confirmData}
                allPlans={allPlans}
                loading={loading}
                sessionData={sessionData}
            />
            
            <div className="mt-4">
                <BillingHistoryClient />
            </div>
        </>
    );
}
