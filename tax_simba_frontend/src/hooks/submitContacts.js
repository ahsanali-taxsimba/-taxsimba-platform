import axios from "axios";
export const useSubmitContactInfo = async (payload) => {
    try {
        const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}contact-us`, payload);

        return { type: true, message : response?.data?.message };
    } catch (error) {
        return { type: false, message : error?.response?.data?.message ||  "something went wrong"}
    }
}