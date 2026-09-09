import axios from "axios";

export const useReVerifyEmail = async (email) => {
    try {
        const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/re-verify-email`, { email });

        return { type: true, message: response?.data?.message };
    } catch (error) {
        return { type: false, message: error?.response?.data?.message || "something went wrong" };
    }
}