// src/lib/cms/subcategory.ts
import { clientAxios } from "../axios-client";
import type { ApiResponse } from "./category";

import type { Category } from "./category";

export type SubCategoriesByCategoryResponse = {
  category: Category;
  subCategories: SubCategory[];
};

/**
 * SubCategory model
 */
export interface SubCategory {
  id: number;
  categoryId: number;
  name: string;

  // 🔹 ADD THESE FIELDS to match API
  slug?: string; // API returns slug
  description?: string | null;
  icon?: string | null;
  displayOrder: number;
  isActive: boolean;
  isResource: boolean;
  createdAt?: string;
  updatedAt?: string;

  // 🔹 nested category info from API
  category?: {
    id: number;
    name: string;
    slug: string;
  };

  // 🔹 articles array from API
  articles?: {
    id: number;
    title: string;
    slug: string;
    isPublished: boolean;
  }[];
}

/**
 * Payload for Create / Update SubCategory
 */
export interface SubCategoryPayload {
  categoryId: number;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  isResource: boolean;
}

/**
 * List / filter payload for Get All SubCategories
 */
export interface SubCategoryListPayload {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC" | string;
}

/**
 * Response shape for Get All SubCategories
 */
export interface SubCategoryListResponse {
  subCategories: SubCategory[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get All SubCategories
 * POST {{baseUrl}}/admin/cms/subcategories
 */
export const getSubCategories = async (
  payload: SubCategoryListPayload = {
    page: 1,
    limit: 10,
    categoryId: undefined,
    isActive: true,
    sortBy: "displayOrder",
    sortOrder: "ASC",
  }
): Promise<ApiResponse<SubCategoryListResponse>> => {
  const { data } = await clientAxios.post<ApiResponse<SubCategoryListResponse>>(
    "/admin/cms/subcategories",
    payload
  );
  return data;
};

/**
 * Create SubCategory
 * POST {{baseUrl}}/admin/cms/subcategories/create
 */
export const createSubCategory = async (
  payload: SubCategoryPayload
): Promise<ApiResponse<SubCategory>> => {
  const { data } = await clientAxios.post<ApiResponse<SubCategory>>(
    "/admin/cms/subcategories/create",
    payload
  );
  return data;
};

/**
 * Get SubCategory by ID
 * POST {{baseUrl}}/admin/cms/subcategories/:id
 */
export const getSubCategoryById = async (
  id: number | string
): Promise<ApiResponse<SubCategory>> => {
  const { data } = await clientAxios.post<ApiResponse<SubCategory>>(
    `/admin/cms/subcategories/${id}`
  );
  return data;
};


export const getSubCategoriesByCategory = async (
  categoryId: number | string
): Promise<ApiResponse<SubCategoriesByCategoryResponse>> => {
  const { data } = await clientAxios.post<ApiResponse<SubCategoriesByCategoryResponse>>(
    `/admin/cms/categories/${categoryId}/subcategories`
  );
  return data;
};

/**
 * Update SubCategory
 * PUT {{baseUrl}}/admin/cms/subcategories/:id
 */
export const updateSubCategory = async (
  id: number | string,
  payload: Partial<SubCategoryPayload>
): Promise<ApiResponse<SubCategory>> => {
  const { data } = await clientAxios.put<ApiResponse<SubCategory>>(
    `/admin/cms/subcategories/${id}`,
    payload
  );
  return data;
};

/**
 * Delete SubCategory
 * DELETE {{baseUrl}}/admin/cms/subcategories/:id
 */
export const deleteSubCategory = async (
  id: number | string
): Promise<ApiResponse<null>> => {
  const { data } = await clientAxios.delete<ApiResponse<null>>(
    `/admin/cms/subcategories/${id}`
  );
  return data;
};

/**
 * Toggle SubCategory Status
 * PATCH {{baseUrl}}/admin/cms/subcategories/:id/toggle-status
 */
export const toggleSubCategoryStatus = async (
  id: number | string
): Promise<ApiResponse<SubCategory>> => {
  const { data } = await clientAxios.patch<ApiResponse<SubCategory>>(
    `/admin/cms/subcategories/${id}/toggle-status`
  );
  return data;
};
