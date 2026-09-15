"use client";

import React, { useEffect, useState } from "react";
import {
  getSubCategories,
  getSubCategoryById,
  deleteSubCategory,
  toggleSubCategoryStatus,
  type SubCategory,
  type SubCategoryListResponse,
} from "@/lib/cms/subcategory";

import CommonTable, { Column } from "@/components/cms/CommonTable";
import SearchInput from "@/components/cms/SearchInput";
import SubCategoryCreateModal from "./_section/SubCategoryCreateModal";
import SubCategoryViewModal from "./_section/SubCategoryViewModal";
import Pagination from "@/components/cms/Pagination";
import Badge from "@/components/ui/badge/Badge";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ConfirmationModal from "@/components/ConfirmationModal";

type Pagination = SubCategoryListResponse["pagination"];

const columns: Column<SubCategory>[] = [
  { header: "ID", render: (s) => s.id },
  {
    header: "Category",
    render: (s) =>
      (s as any).category ? `${(s as any).category.name}` : s.categoryId ?? "-",
  },
  { header: "Name", render: (s) => <span className="font-medium">{s.name}</span> },
  { header: "Slug", render: (s: any) => s.slug ?? "-" },
  {
    header: "Description",
    render: (s) => {
      if (!s.description) return "-";
      return s.description.length > 50
        ? s.description.substring(0, 50) + "..."
        : s.description;
    },
  },
  { header: "Icon", render: (s) => s.icon ?? "-" },
  { header: "Order", render: (s) => s.displayOrder },

  // ✅ NEW: isResource column
  {
    header: "Resource",
    render: (s: any) => (
      <Badge
        color={s.isResource ? "primary" : "light"}
        size="sm"
      >
        {s.isResource ? "Yes" : "No"}
      </Badge>
    ),
  },

  // (optional) ✅ show articles count
  {
    header: "Articles",
    render: (s: any) => (Array.isArray(s.articles) ? s.articles.length : 0),
  },

  {
    header: "Status",
    render: (s) => (
      <Badge
        color={s.isActive ? "success" : "light"}
        size="sm"
      >
        {s.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];


const SubCategoryMenu = () => {
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
const [viewModalOpen, setViewModalOpen] = useState(false);
const [viewData, setViewData] = useState<SubCategory | null>(null);

  // modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] =
    useState<SubCategory | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [subCategoryToDelete, setSubCategoryToDelete] = useState<SubCategory | null>(null);

  const fetchSubCategories = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const isActive =
        statusFilter === "all" ? undefined : statusFilter === "active";

      const res = await getSubCategories({
        page,
        limit: 10,
        search: searchValue,
        isActive,
        sortBy: "displayOrder",
        sortOrder: "ASC",
      });

      const data = res.data as SubCategoryListResponse;
      setSubCategories(data.subCategories || []);
      setPagination(data.pagination || null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch subcategories"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubCategories(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const currentPage = pagination?.page ?? 1;

  // VIEW
const handleView = async (s: SubCategory) => {
  try {
    const res = await getSubCategoryById(s.id);
    setViewData(res.data);
    setViewModalOpen(true);
  } catch (err: any) {
    setError(
      err?.response?.data?.message ||
        err?.message ||
        "Failed to fetch subcategory details"
    );
  }
};


  // TOGGLE STATUS
  const handleToggleStatus = async (s: SubCategory) => {
    try {
      setLoading(true);
      await toggleSubCategoryStatus(s.id);
      await fetchSubCategories(currentPage);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to toggle status"
      );
    } finally {
      setLoading(false);
    }
  };

  // EDIT – open modal with prefilled data
  const handleEdit = (s: SubCategory) => {
    setEditingSubCategory(s);
    setIsModalOpen(true);
  };

  // DELETE
  const handleDelete = (s: SubCategory) => {
    setSubCategoryToDelete(s);
    setDeleteModalOpen(true);
  };

  const confirmDeleteSubCategory = async () => {
    if (!subCategoryToDelete) return;
    try {
      setLoading(true);
      await deleteSubCategory(subCategoryToDelete.id);
      await fetchSubCategories(currentPage);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete subcategory"
      );
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setSubCategoryToDelete(null);
    }
  };

  // OPEN CREATE MODAL
  const handleOpenCreate = () => {
    setEditingSubCategory(null);
    setIsModalOpen(true);
  };

  return (
    <div>
      {/* HEADER */}
      <PageBreadcrumb
              pageTitle="SubCategory Management"
              parentPage="Dashboard"
              parentPageUrl="/overview"
          />
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="p-3">
                {/* Filters */}
                <div className="flex flex-wrap md:flex-nowrap gap-3 justify-end">
                  <div className="w-auto">
                    <SearchInput
                      searchValue={searchValue}
                      setSearchValue={setSearchValue}
                      fetchData={() => fetchSubCategories(1)}
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as "all" | "active" | "inactive")
                    }
                    className="w-full md:w-auto border p-2 rounded-lg text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button
                    onClick={handleOpenCreate}
                    className="rounded-lg bg-[#37a267] px-4 py-2 text-white hover:bg-[#37a267]"
                  >
                    + Add SubCategory
                  </button>
                </div>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6">
                <div className="space-y-6">
                    <div className="p-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                        <div className="max-w-full scrollbar-custom">
                            <div className="min-w-[1102px]">
                                      {/* TABLE */}
                                <CommonTable<SubCategory>
                                  categories={subCategories}
                                  loading={loading}
                                  error={error}
                                  pagination={pagination || undefined}
                                  columns={columns}
                                  onView={handleView}
                                  onToggleStatus={handleToggleStatus}
                                  onEdit={handleEdit}
                                  onDelete={handleDelete}
                                />
                              {pagination?.totalPages ? (
                                <Pagination
                                  page={pagination.page}
                                  totalPages={pagination.totalPages}
                                totalItems={pagination.total} 
                                  limit={pagination.limit}
                                  disabled={loading}
                                  onPageChange={(p) => fetchSubCategories(p)}
                                />
                              ) : null}

                                    {/* CREATE / EDIT MODAL */}
                                    <SubCategoryCreateModal
                                      isOpen={isModalOpen}
                                      onClose={() => setIsModalOpen(false)}
                                      mode={editingSubCategory ? "edit" : "create"}
                                      initialData={editingSubCategory || undefined}
                                      onCreated={() => fetchSubCategories(1)}
                                      onUpdated={() => fetchSubCategories(currentPage)}
                                    />
                                    <SubCategoryViewModal
                                isOpen={viewModalOpen}
                                onClose={() => setViewModalOpen(false)}
                                data={viewData}
                              />

                              <ConfirmationModal
                                isOpen={deleteModalOpen}
                                onConfirm={confirmDeleteSubCategory}
                                onCancel={() => {
                                  setDeleteModalOpen(false);
                                  setSubCategoryToDelete(null);
                                }}
                                title="Delete SubCategory"
                                confirmationText={`Are you sure you want to delete subcategory "${subCategoryToDelete?.name}"?`}
                                confirmBtnText="Delete"
                                isDanger={true}
                              />

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    </div>
  );
};

export default SubCategoryMenu;
