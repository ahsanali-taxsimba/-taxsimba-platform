// src/lib/cms/category.ts
import { clientAxios } from "../axios-client";

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  statusCode: number;
  message?: string;
  data: T;
  success?: boolean;
}

/**
 * SubCategory model
 */
export interface SubCategory {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  isResource: boolean;
}

/**
 * Category model - matches your API
 */
export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null; // ✅ optional + nullable
  icon?: string | null;
  displayOrder: number;
  isActive: boolean;
  isResource: boolean;
  createdAt?: string;
  updatedAt?: string;
  subCategories?: SubCategory[];
}

/**
 * Pagination model for category list
 */
export interface CategoryListPagination {
  total: number;      // ✅ from your API
  page: number;
  limit: number;
  totalPages: number;

  // Optional fallback if backend ever uses different field
  totalItems?: number;
}

/**
 * Response shape for Get All Categories
 */
export interface CategoryListResponse {
  categories: Category[];
  pagination: CategoryListPagination;
}

/**
 * List / filter payload for Get All Categories
 */
export interface CategoryListPayload {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  isResource?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC" | string;
}

/**
 * Payload for Create / Update Category
 */
export interface CategoryPayload {
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  isResource: boolean;
}

/**
 * Get All Categories
 */
export const getCategories = async (
  payload: CategoryListPayload = {
    page: 1,
    limit: 10,
    search: "",
    isActive: true,
    isResource: true,
    sortBy: "displayOrder",
    sortOrder: "ASC",
  }
): Promise<ApiResponse<CategoryListResponse>> => {
  const { data } = await clientAxios.post<ApiResponse<CategoryListResponse>>(
    "/admin/cms/categories",
    payload
  );
  return data;
};

export const createCategory = async (
  payload: CategoryPayload
): Promise<ApiResponse<Category>> => {
  const { data } = await clientAxios.post<ApiResponse<Category>>(
    "/admin/cms/categories/create",
    payload
  );
  return data;
};

export const getCategoryById = async (
  id: number | string
): Promise<ApiResponse<Category>> => {
  const { data } = await clientAxios.post<ApiResponse<Category>>(
    `/admin/cms/categories/${id}`
  );
  return data;
};

export const updateCategory = async (
  id: number | string,
  payload: CategoryPayload
): Promise<ApiResponse<Category>> => {
  const { data } = await clientAxios.put<ApiResponse<Category>>(
    `/admin/cms/categories/${id}`,
    payload
  );
  return data;
};

export const deleteCategory = async (
  id: number | string
): Promise<ApiResponse<null>> => {
  const { data } = await clientAxios.delete<ApiResponse<null>>(
    `/admin/cms/categories/${id}`
  );
  return data;
};

export const toggleCategoryStatus = async (
  id: number | string
): Promise<ApiResponse<Category>> => {
  const { data } = await clientAxios.patch<ApiResponse<Category>>(
    `/admin/cms/categories/${id}/toggle-status`
  );
  return data;
};
