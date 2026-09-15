// src/lib/cms/article.ts
import { clientAxios } from "@/lib/axios-client";

export interface Article {
  id: number;
  categoryId: number;
  subCategoryId?: number | null;
  type: "MTD" | "TaxSimba";

  title: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;

  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;

  displayOrder?: number;
  isFeatured: boolean;
  isPublished: boolean;

  featuredImage?: string | null;
  images?: string[] | null;

  authorName?: string | null;
  createdAt?: string;
  updatedAt?: string;

  category?: { id: number; name: string; slug?: string };
  subCategory?: { id: number; name: string; slug?: string };
}

export interface ArticleListPayload {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  subCategoryId?: number;
  type?: "MTD" | "TaxSimba";
  isPublished?: boolean;
  isFeatured?: boolean;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface ArticleListResponse {
  articles: Article[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type ArticleCreatePayload = {
  categoryId: number;
  subCategoryId?: number;
  type: "MTD" | "TaxSimba";

  title: string;
  excerpt?: string;
  content: string;
  authorName?: string;

  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;

  displayOrder?: number;
  isFeatured?: boolean;
  isPublished?: boolean;

  featuredImage?: File | null;
  images?: File[];
};

export type ArticleUpdatePayload = Partial<ArticleCreatePayload>;

const toFormData = (payload: ArticleCreatePayload | ArticleUpdatePayload) => {
  const fd = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (key === "featuredImage") {
      if (value instanceof File) fd.append("featuredImage", value);
      return;
    }

    if (key === "images") {
      if (Array.isArray(value)) {
        value.forEach((file) => {
          if (file instanceof File) fd.append("images", file);
        });
      }
      return;
    }

    fd.append(key, String(value));
  });

  return fd;
};

export const getArticles = (payload: ArticleListPayload) =>
  clientAxios.post("/admin/cms/articles", payload);

export const getArticleById = (id: number | string) =>
  clientAxios.post(`/admin/cms/articles/${id}`);

export const createArticle = (payload: ArticleCreatePayload) =>
  clientAxios.post("/admin/cms/articles/create", toFormData(payload), true, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateArticle = (id: number | string, payload: ArticleUpdatePayload) =>
  clientAxios.put(`/admin/cms/articles/${id}`, toFormData(payload), true, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteArticle = (id: number | string) =>
  clientAxios.delete(`/admin/cms/articles/${id}`);

export const toggleArticlePublishStatus = (id: number | string) =>
  clientAxios.patch(`/admin/cms/articles/${id}/toggle-publish`);

export const toggleArticleFeaturedStatus = (id: number | string) =>
  clientAxios.patch(`/admin/cms/articles/${id}/toggle-featured`);

export const deleteArticleImage = (
  id: number | string,
  body: { imageUrl: string; isFeatured: boolean }
) =>
  clientAxios.delete(`/admin/cms/articles/${id}/images`, true, {
    data: body,
  });
