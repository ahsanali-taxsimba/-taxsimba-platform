"use client";
import Notifications from "@/app/dashboard/_components/Notifications";
import { useSession } from "next-auth/react";

export default function NotificationsPageClient() {
    const { data: session } = useSession();
    const sessionData = session || {};

    return (
        <Notifications session={sessionData} />
    );
}
