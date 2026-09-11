"use client";
import TaxTracker from "@/app/dashboard/_components/taxTracker/TaxTracker";
import { useState } from "react";

export default function TaxTrackerPage({ serverSession }) {
    const [isDocUpdated, setIsDocUpdated] = useState(false);
    const [isRefresh, setIsRefresh] = useState(false);

    return (
        <TaxTracker
            serverSession={serverSession}
            setIsDocUpdated={setIsDocUpdated}
            setIsRefresh={setIsRefresh}
            isRefresh={isRefresh}
        />
    );
}
