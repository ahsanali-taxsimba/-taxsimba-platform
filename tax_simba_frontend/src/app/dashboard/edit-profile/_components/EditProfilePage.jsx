"use client";
import EditProfile from "@/app/dashboard/_components/EditProfile";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import axios from "axios";
import emitter from "@/utils/eventBus";
import { Logout } from "@/app/lib/api";

export default function EditProfilePage() {
    const { data: session } = useSession();
    const sessionData = session || {};
    const [userData, setUserData] = useState({});
    const [trackUpdate, setTrackUpdate] = useState(false);

    useEffect(() => {
        if (!sessionData?.accessToken) return;
        axios
            .post(
                `${process.env.NEXT_PUBLIC_API_URL}auth/get-account-details`,
                {},
                { headers: { Authorization: `Bearer ${sessionData.accessToken}` } }
            )
            .then((res) => {
                setUserData(res?.data?.data);
                emitter.emit("user-updated");
            })
            .catch(() => Logout(sessionData));
    }, [sessionData?.accessToken, trackUpdate]);

    return (
        <EditProfile
            userData={userData}
            sessionData={sessionData}
            setTrackUpdate={setTrackUpdate}
        />
    );
}
