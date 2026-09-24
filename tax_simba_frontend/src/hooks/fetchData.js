import axios from "axios";
import { Logout } from "@/app/lib/api";
export const useFetchProfileData = async (token) => {
    if(!token) return;

    try {
        const res = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}auth/get-account-details`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if(res?.data?.success){
            const data = res?.data?.data || {};
            const first =
                data.firstName ||
                (typeof data.name === "string" ? data.name.trim().split(/\s+/)[0] : "") ||
                "";
            return {
                profilePhoto: data.profilePhoto,
                firstName: first,
                lastName: data.lastName || "",
                name: data.name || "",
                ownership: data.ownership || null,
                hasActiveMtd: data.hasActiveMtd,
                hasActiveSa: data.hasActiveSa,
                onboardingIntent: data.onboardingIntent || null,
                provider: data.provider,
            }
        }
    } catch (err) {
        Logout(token);
        return {
            profilePhoto: "",
            firstName: "",
            provider: "",
        }
    }
};

// Fetch tax return data
// {{baseUrl}}/api/client/all-tax-returns
export const useFetchTaxReturnData = async (token) => {
    if(!token) return;

    try {
        const res = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}client/all-tax-returns`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        if(res?.data?.success){
            return res?.data?.data || [];
        }
    } catch (err) {
        // Logout(token);
        return [];
    }
}

export const useFetchTaxReturnDataById = async (token, id)=> {
    if(!token) return;
    try {
        const res = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}tax-return/${id}/progress`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if(res?.data?.success){
            return res?.data?.data || [];
        }
    } catch (err) {
        // Logout(token);
        return [];
    }
}

export const useFetchMyFilesData = async (token) => {
    if (!token) return;
    
    try {
        const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/my-files`,
        {},
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
        );

        if (res?.data?.success) {
            return res?.data || {};
        }
    } catch (err) {
        // Logout(token);
        return err.response?.data || {};
    }

}
