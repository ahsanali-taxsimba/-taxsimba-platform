"use client";
import MyDocuments from "@/app/dashboard/_components/MyDocuments";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function MyDocumentsPage() {
    const { data: session } = useSession();
    const sessionData = session || {};
    const [trackUpdate, setTrackUpdate] = useState(false);

    return (
        <MyDocuments sessionData={sessionData} setTrackUpdate={setTrackUpdate} />
    );
}
