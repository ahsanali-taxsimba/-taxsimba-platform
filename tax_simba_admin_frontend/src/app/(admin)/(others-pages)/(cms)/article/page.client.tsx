"use client";

import React, { useEffect, useState } from "react";
import SearchInput from "@/components/cms/SearchInput";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { useRouter } from "next/navigation";
import { Eye, Edit, Trash2 } from "lucide-react";
import Badge from "@/components/ui/badge/Badge";
import {
    getArticles,
    getArticleById,
    deleteArticle,
    toggleArticlePublishStatus,
    toggleArticleFeaturedStatus,
    type Article,
    type ArticleListResponse,
} from "@/lib/cms/article";

import { getCategories, type Category } from "@/lib/cms/category";
import { getSubCategoriesByCategory, type SubCategory } from "@/lib/cms/subcategory";

import ArticleModal from "./_section/ArticleModal";
import ArticleViewModal from "./_section/ArticleViewModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { EyeIcon, PencilIcon, TrashBinIcon } from "@/icons";
import ConfirmationModal from "@/components/ConfirmationModal";

type Pagination = ArticleListResponse["pagination"];

const ArticleMenu = () => {
    const router = useRouter();
    const [articles, setArticles] = useState<Article[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchValue, setSearchValue] = useState("");
    const [categoryId, setCategoryId] = useState<string>("");
    const [subCategoryId, setSubCategoryId] = useState<string>("");

    const [publishedFilter, setPublishedFilter] = useState<"all" | "yes" | "no">("all");
    const [featuredFilter, setFeaturedFilter] = useState<"all" | "yes" | "no">("all");

    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");

    // Dropdown data
    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

    // Create/Edit modal
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Article | null>(null);

    // View modal
    const [viewOpen, setViewOpen] = useState(false);
    const [viewData, setViewData] = useState<Article | null>(null);

    // Delete modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);

    const fetchArticles = async (page = 1) => {
        try {
            setLoading(true);
            setError(null);

            const isPublished =
                publishedFilter === "all" ? undefined : publishedFilter === "yes";
            const isFeatured =
                featuredFilter === "all" ? undefined : featuredFilter === "yes";

            const res = await getArticles({
                page,
                limit: 10,
                search: searchValue || undefined,
                categoryId: categoryId ? Number(categoryId) : undefined,
                subCategoryId: subCategoryId ? Number(subCategoryId) : undefined,
                isPublished,
                isFeatured,
                sortBy,
                sortOrder,
            });

            // your API: { statusCode, data: { articles, pagination } }
            const api = res.data?.data ?? res.data;
            setArticles(api.articles || []);
            setPagination(api.pagination || null);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || "Failed to fetch articles");
        } finally {
            setLoading(false);
        }
    };

    // Load categories once
    useEffect(() => {
        (async () => {
            try {
                const res = await getCategories({
                    page: 1,
                    limit: 200,
                    sortBy: "displayOrder",
                    sortOrder: "ASC",
                });

                setCategories(Array.isArray(res.data?.categories) ? res.data.categories : []);
            } catch { }
        })();
    }, []);


    // Load subcategories when category changes
    // Load subcategories when category changes
    useEffect(() => {
        const cid = Number(categoryId);

        if (!cid) {
            setSubCategories([]);
            setSubCategoryId("");
            return;
        }

        (async () => {
            try {
                const res = await getSubCategoriesByCategory(cid);
                // ✅ ApiResponse<SubCategory[]>
                setSubCategories(Array.isArray(res.data) ? res.data : []);
            } catch {
                setSubCategories([]);
            }
        })();
    }, [categoryId]);


    // Fetch list on filters change
    useEffect(() => {
        fetchArticles(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [publishedFilter, featuredFilter, sortBy, sortOrder, categoryId, subCategoryId]);

    const currentPage = pagination?.page ?? 1;

    // Actions
    const openCreate = () => {
        setEditing(null);
        setModalOpen(true);
    };

    const openEdit = (row: Article) => {
        setEditing(row);
        setModalOpen(true);
    };

    const openView = async (row: Article) => {
        try {
            const res = await getArticleById(row.id);
            const api = res.data?.data ?? res.data;
            setViewData(api);
            setViewOpen(true);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || "Failed to fetch article details");
        }
    };

    const onDelete = (row: Article) => {
        setArticleToDelete(row);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!articleToDelete) return;
        try {
            setLoading(true);
            setDeleteModalOpen(false);
            await deleteArticle(articleToDelete.id);
            await fetchArticles(currentPage);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || "Failed to delete article");
        } finally {
            setLoading(false);
            setArticleToDelete(null);
        }
    };

    const togglePublish = async (row: Article) => {
        try {
            setLoading(true);
            await toggleArticlePublishStatus(row.id);
            await fetchArticles(currentPage);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || "Failed to toggle publish");
        } finally {
            setLoading(false);
        }
    };

    const toggleFeatured = async (row: Article) => {
        try {
            setLoading(true);
            await toggleArticleFeaturedStatus(row.id);
            await fetchArticles(currentPage);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || "Failed to toggle featured");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
             <PageBreadcrumb
              pageTitle="Article Management"
              parentPage="Dashboard"
              parentPageUrl="/overview"
          />

          <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="p-3">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <div className="w-full md:w-72">
                                <SearchInput
                                    searchValue={searchValue}
                                    setSearchValue={setSearchValue}
                                    fetchData={() => fetchArticles(1)}
                                />
                            </div>
                            <button onClick={() => router.push("/article/create-article")}
                                className="h-11 rounded-lg bg-[#37a267] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#37a267]">
                                + Add Article
                            </button>
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6">
                        <div className="space-y-6">
                            <div className="p-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                                
                                {/* Filters */}
                                <div className="flex flex-wrap flex-col gap-3 md:flex-row md:items-center md:justify-start">
                                    <select
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        className="h-11 w-full md:w-35 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                                    >
                                        <option value="">All Categories</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={subCategoryId}
                                        onChange={(e) => setSubCategoryId(e.target.value)}
                                        className="h-11 w-full md:w-35 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                                    >
                                        <option value="">All SubCategories</option>
                                        {subCategories.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={publishedFilter}
                                        onChange={(e) => setPublishedFilter(e.target.value as any)}
                                        className="h-11 w-full md:w-35 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                                    >
                                        <option value="all">All Publish</option>
                                        <option value="yes">Published</option>
                                        <option value="no">Unpublished</option>
                                    </select>

                                    <select
                                        value={featuredFilter}
                                        onChange={(e) => setFeaturedFilter(e.target.value as any)}
                                        className="h-11 w-full md:w-35 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                                    >
                                        <option value="all">All Featured</option>
                                        <option value="yes">Featured</option>
                                        <option value="no">Normal</option>
                                    </select>

                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="h-11 w-full md:w-35 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                                    >
                                        <option value="createdAt">CreatedAt</option>
                                        <option value="displayOrder">DisplayOrder</option>
                                        <option value="title">Title</option>
                                    </select>

                                    <select
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(e.target.value as any)}
                                        className="h-11 w-full md:w-36 rounded-lg border border-gray-200 bg-white px-3 text-sm"
                                    >
                                        <option value="DESC">DESC</option>
                                        <option value="ASC">ASC</option>
                                    </select>
                                </div>

                                {/* Error */}
                                {error && (
                                    <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                                )}

                                {/* Table */}
                                <div className="overflow-x-auto rounded border border-gray-200 bg-white my-3">
                                    <table className="min-w-full text-sm">
                                        <thead className="border-b border-gray-100 dark:border-white/[0.05] text-nowrap">
                                            <tr>
                                                <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">ID</th>
                                                <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Title</th>
                                                <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Category</th>
                                                <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">SubCategory</th>
                                                <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Published</th>
                                                <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Featured</th>
                                                <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {loading ? (
                                                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400" colSpan={7}>
                                                        Loading...
                                                    </td>
                                                </tr>
                                            ) : articles.length === 0 ? (
                                                <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400" colSpan={7}>
                                                        No articles found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                articles.map((a) => (
                                                    <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">{a.id}</td>
                                                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                                            <div className="font-medium">{a.title}</div>
                                                            <div className="text-xs text-gray-500">{a.slug ?? ""}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                                            {a.category?.name ?? a.categoryId}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                                            {(a as any)?.subCategory?.name ?? a.subCategoryId ?? "-"}
                                                        </td>

                                                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                                            <div className="flex items-center gap-2">
                                                                <Badge color={a.isPublished ? "success" : "light"} size="sm">
                                                                    {a.isPublished ? "Published" : "Draft"}
                                                                </Badge>
                                                                <ToggleSwitch checked={!!a.isPublished} onChange={() => togglePublish(a)} />
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                                            <div className="flex items-center gap-2">
                                                                <Badge color={a.isFeatured ? "warning" : "light"} size="sm">
                                                                    {a.isFeatured ? "Featured" : "Regular"}
                                                                </Badge>
                                                                <ToggleSwitch checked={!!a.isFeatured} onChange={() => toggleFeatured(a)} />
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                                            <div className="flex justify-centre gap-2">
                                                                <button
                                                                    onClick={() => router.push(`/article/${a.id}`)}
                                                                    className="inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500 cursor-pointer"
                                                                    title="View"
                                                                >
                                                                    <EyeIcon className="me-1" /> View
                                                                </button>
                                                                <button
                                                                    onClick={() => router.push(`/article/${a.id}/edit-article`)}
                                                                    className="w-auto inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400 cursor-pointer"
                                                                    title="Edit"
                                                                >
                                                                    <PencilIcon className="me-1" /> Edit 
                                                                </button>
                                                                <button
                                                                    onClick={() => onDelete(a)}
                                                                    className="w-auto inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500 cursor-pointer"
                                                                    title="Delete"
                                                                >
                                                                    <TrashBinIcon className="me-1" /> Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {pagination && (
                                    <div className="flex items-center justify-between text-sm text-gray-600">
                                        <div>
                                            Total: {pagination.total} | Page {pagination.page} of {pagination.totalPages}
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                disabled={pagination.page <= 1 || loading}
                                                onClick={() => fetchArticles(pagination.page - 1)}
                                                className="rounded border px-3 py-1 disabled:opacity-50"
                                            >
                                                Prev
                                            </button>
                                            <button
                                                disabled={pagination.page >= pagination.totalPages || loading}
                                                onClick={() => fetchArticles(pagination.page + 1)}
                                                className="rounded border px-3 py-1 disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>




            {/* View Modal */}
            <ArticleViewModal
                isOpen={viewOpen}
                onClose={() => setViewOpen(false)}
                data={viewData}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteModalOpen}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setDeleteModalOpen(false);
                    setArticleToDelete(null);
                }}
                title="Delete Article"
                confirmationText={`Are you sure you want to delete "${articleToDelete?.title}"?`}
                confirmBtnText="Delete"
                isDanger={true}
            />
        </div>
    );
};

export default ArticleMenu;
