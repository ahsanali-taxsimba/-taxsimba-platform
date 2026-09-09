import { clientAxios } from "@/lib/axios-client";

export interface SubscriptionPlan {
    id: number;
    name: string;
    price: number;
    originalPrice: number | null;
    currency: string;
    category: string;
    interval?: string;
    features: string[];
    idealFor?: string[];
    benefits?: string[];
    description: string | null;
    savePercentage: number;
    vatPercentage?: number;
    isPopular: boolean;
    isActive: boolean;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface SubscriptionPlanListResponse {
    status: number;
    data: SubscriptionPlan[];
    message: string;
}

export const getSubscriptionPlans = async (params: {
    search?: string;
    isActive?: boolean;
}) => {
    const response = await clientAxios.post<SubscriptionPlanListResponse>(
        "/admin/cms/subscription-plans",
        params
    );
    return response.data;
};

export const getSubscriptionPlanById = async (id: number) => {
    const response = await clientAxios.post<{ data: SubscriptionPlan }>(
        `/admin/cms/subscription-plans/${id}`
    );
    return response.data;
};

export const createSubscriptionPlan = async (data: Partial<SubscriptionPlan>) => {
    const response = await clientAxios.post<{ data: SubscriptionPlan }>(
        "/admin/cms/subscription-plans/create",
        data
    );
    return response.data;
};

export const updateSubscriptionPlan = async (
    id: number,
    data: Partial<SubscriptionPlan>
) => {
    const response = await clientAxios.put<{ data: SubscriptionPlan }>(
        `/admin/cms/subscription-plans/${id}`,
        data
    );
    return response.data;
};

export const deleteSubscriptionPlan = async (id: number) => {
    const response = await clientAxios.delete(`/admin/cms/subscription-plans/${id}`);
    return response.data;
};

export const toggleSubscriptionPlanStatus = async (id: number) => {
    const response = await clientAxios.patch(
        `/admin/cms/subscription-plans/${id}/toggle-status`
    );
    return response.data;
};
