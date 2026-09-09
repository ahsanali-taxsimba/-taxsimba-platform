"use client";
import ChangeProfilePassword from "@/app/dashboard/_components/ChangeProfilePassword";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function ChangePasswordPage() {
    const { data: session } = useSession();
    const sessionData = session || {};
    const [trackUpdate, setTrackUpdate] = useState(false);

    return (
        <ChangeProfilePassword
            sessionData={sessionData}
            setTrackUpdate={setTrackUpdate}
        />
    );
}
