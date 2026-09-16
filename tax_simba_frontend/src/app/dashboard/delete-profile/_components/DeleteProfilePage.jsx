"use client";
import DeleteProfile from "@/app/dashboard/_components/DeleteProfile";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function DeleteProfilePage() {
    const { data: session } = useSession();
    const sessionData = session || {};
    const [trackUpdate, setTrackUpdate] = useState(false);

    return (
        <DeleteProfile sessionData={sessionData} setTrackUpdate={setTrackUpdate} />
    );
}
