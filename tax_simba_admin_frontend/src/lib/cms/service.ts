// src/lib/cms/service.ts
import { clientAxios } from "../axios-client";
import type { ApiResponse } from "./category";

/** -----------------------
 * Models
 * ---------------------- */

export type ServiceFaqItem = {
  q: string;
  a: string;
};
export type ServiceOutcome = {
    label: string;
    value: string;
    copy: string;
  };
  
  export interface ServiceCreatePayload {
    slug: string;
    title: string;
    tagline?: string;
    summary?: string;
  
    pillars?: string[];
    outcomes?: ServiceOutcome[];
  
    sections?: Record<string, any>[];
    faq?: ServiceFaqItem[];
  
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
  
    cta?: string;
    displayOrder?: number;
    isActive?: boolean;
  }
  

export type ServiceSection = Record<string, any>; 
// Keep flexible because sections can contain different blocks like bannerSection, etc.

export interface Service {
  id: number;
  slug: string;
  title: string;

  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;

  tagline?: string | null;
  summary?: string | null;

  sections?: ServiceSection[]; // as per API: [{ bannerSection: {...} }, ...]
  faq?: ServiceFaqItem[];

  cta?: string | null;

  displayOrder: number;
  isActive: boolean;

  createdAt?: string;
  updatedAt?: string;
}

/** -----------------------
 * List (Get All)
 * ---------------------- */

export interface ServiceListPayload {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface ServiceListResponse {
  services: Service[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * POST /api/admin/cms/services
 */
export const getServices = async (
  payload: ServiceListPayload = { page: 1, limit: 10 }
): Promise<ApiResponse<ServiceListResponse>> => {
  const { data } = await clientAxios.post<ApiResponse<ServiceListResponse>>(
    "/admin/cms/services",
    payload
  );
  return data;
};

/** -----------------------
 * Get By ID
 * ---------------------- */

/**
 * GET /api/admin/cms/services/:id
 */
export const getServiceById = async (
  id: number | string
): Promise<ApiResponse<Service>> => {
  const { data } = await clientAxios.get<ApiResponse<Service>>(
    `/admin/cms/services/${id}`
  );
  return data;
};

/** -----------------------
 * Create / Update
 * ---------------------- */

export interface ServiceCreatePayload {
  slug: string;
  title: string;

  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;

  tagline?: string;
  summary?: string;

  sections?: ServiceSection[];
  faq?: ServiceFaqItem[];

  cta?: string;

  displayOrder?: number;
  isActive?: boolean;
}

/**
 * POST /api/admin/cms/services/create
 */
export const createService = async (
  payload: ServiceCreatePayload
): Promise<ApiResponse<Service>> => {
  const { data } = await clientAxios.post<ApiResponse<Service>>(
    "/admin/cms/services/create",
    payload
  );
  return data;
};

export type ServiceUpdatePayload = Partial<ServiceCreatePayload>;

/**
 * PUT /api/admin/cms/services/:id
 */
export const updateService = async (
  id: number | string,
  payload: ServiceUpdatePayload
): Promise<ApiResponse<Service>> => {
  const { data } = await clientAxios.put<ApiResponse<Service>>(
    `/admin/cms/services/${id}`,
    payload
  );
  return data;
};

/** -----------------------
 * Delete
 * ---------------------- */

/**
 * DELETE /api/admin/cms/services/:id
 */
export const deleteService = async (
  id: number | string
): Promise<ApiResponse<null>> => {
  const { data } = await clientAxios.delete<ApiResponse<null>>(
    `/admin/cms/services/${id}`
  );
  return data;
};

/** -----------------------
 * Toggle Status
 * ---------------------- */

/**
 * PATCH /api/admin/cms/services/:id/toggle-status
 */
export const toggleServiceStatus = async (
  id: number | string
): Promise<ApiResponse<Service>> => {
  const { data } = await clientAxios.patch<ApiResponse<Service>>(
    `/admin/cms/services/${id}/toggle-status`
  );
  return data;
};

/** -----------------------
 * Reorder
 * ---------------------- */

export interface ServiceReorderItem {
  id: number;
  displayOrder: number;
}

export interface ServiceReorderPayload {
  services: ServiceReorderItem[];
}

/**
 * PATCH /api/admin/cms/services/reorder
 */
export const reorderServices = async (
  payload: ServiceReorderPayload
): Promise<ApiResponse<null>> => {
  const { data } = await clientAxios.patch<ApiResponse<null>>(
    "/admin/cms/services/reorder",
    payload
  );
  return data;
};
