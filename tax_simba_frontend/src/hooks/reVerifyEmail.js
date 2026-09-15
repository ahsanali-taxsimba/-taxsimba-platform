import axios from "axios";
import { getSafeErrorMessage, getSafeSuccessMessage } from "@/lib/toastMessage";

export const useReVerifyEmail = async (email) => {
    try {
        const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/re-verify-email`, { email });

        return {
            type: true,
            message: getSafeSuccessMessage(response?.data, "Verification email sent."),
        };
    } catch (error) {
        return {
            type: false,
            message: getSafeErrorMessage(error, "Something went wrong. Please try again."),
        };
    }
}