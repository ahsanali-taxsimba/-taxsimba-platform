"use client";

import React, { useEffect, useState } from "react";
import {
  getCategories,
  getCategoryById,
  deleteCategory,
  toggleCategoryStatus,
  type Category,
  type CategoryListResponse,
} from "@/lib/cms/category";
import CommonTable, { Column } from "@/components/cms/CommonTable";
import SearchInput from "@/components/cms/SearchInput";
import CategoryCreateModal from "./_section/CategoryCreateModal";
import CategoryViewModal from "./_section/CategoryViewModal";
import Pagination from "@/components/cms/Pagination";
import Badge from "@/components/ui/badge/Badge";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ConfirmationModal from "@/components/ConfirmationModal";

type Pagination = CategoryListResponse["pagination"];

// Columns
const columns: Column<Category>[] = [
  {
    header: "ID",
    render: (cat: Category) => cat.id,
  },
  {
    header: "Name",
    render: (cat: Category) => <span className="font-medium">{cat.name}</span>,
  },
  {
    header: "Slug",
    render: (cat: Category) => cat.slug,
  },
  {
    header: "Description",
    render: (cat: Category) => {
      if (!cat.description) return "-";
      return cat.description.length > 50
        ? cat.description.substring(0, 50) + "..."
        : cat.description;
    },
  },
  {
    header: "Icon",
    render: (cat: Category) => cat.icon ?? "-",
  },
  {
    header: "Display Order",
    render: (cat: Category) => cat.displayOrder,
  },
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
  {
    header: "Status",
    render: (cat: Category) => (
      <Badge
        color={cat.isActive ? "success" : "light"}
        size="sm"
      >
        {cat.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    header: "Subcategories",
    render: (cat: Category) =>
      cat.subCategories?.length
        ? cat.subCategories.map((s) => s.name).join(", ")
        : "-",
  },
];

const CategoryMenu = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchValue, setSearchValue] = useState<string>("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "inactive">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // View modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState<Category | null>(null);

  // Edit modal
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const fetchCategories = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      let isActive: boolean | undefined = undefined;
      if (statusFilter === "active") isActive = true;
      if (statusFilter === "inactive") isActive = false;

      const res = await getCategories({
        page,
        limit: 10,
        search: searchValue,
        isActive,
        sortBy: "displayOrder",
        sortOrder: "ASC",
      });

      const apiData = res.data;
      setCategories(apiData.categories || []);
      setPagination(apiData.pagination || null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch categories"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCategories(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const currentPage = pagination?.page ?? 1;

  // View handler → opens view modal
  const handleViewCategory = async (cat: Category) => {
    try {
      const res = await getCategoryById(cat.id);
      setViewData(res.data);
      setViewOpen(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to fetch category details"
      );
    }
  };

  const handleToggleStatus = async (cat: Category) => {
    try {
      setLoading(true);
      setError(null);
      await toggleCategoryStatus(cat.id);
      await fetchCategories(currentPage);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to toggle category status"
      );
    } finally {
      setLoading(false);
    }
  };

  // ✏️ Edit handler → open modal with prefilled data
  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setIsCreateOpen(true);
  };

  // Delete handler
  const handleDeleteCategory = (cat: Category) => {
    setCategoryToDelete(cat);
    setDeleteModalOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setLoading(true);
      setError(null);
      await deleteCategory(categoryToDelete.id);
      await fetchCategories(currentPage);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete category"
      );
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setCategoryToDelete(null);
    }
  };

  const handleOpenCreate = () => {
    setEditingCategory(null); // ensure fresh create mode
    setIsCreateOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateOpen(false);
    setEditingCategory(null);
  };

  return (
    <div>
      {/* Top toolbar */}
      <PageBreadcrumb
              pageTitle="Category Menu"
              parentPage="Dashboard"
              parentPageUrl="/overview"
          />
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="p-3">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <div className="w-full sm:w-auto">
                       
                            <SearchInput
                              searchValue={searchValue}
                              setSearchValue={setSearchValue}
                              fetchData={() => fetchCategories(1)}
                            />
                          </div>

                          <div className="w-full md:w-40">
                            <select
                              value={statusFilter}
                              onChange={(e) =>
                                setStatusFilter(e.target.value as "all" | "active" | "inactive")
                              }
                              className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
                            >
                              <option value="all">All Statuses</option>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="h-11 rounded-lg bg-[#37a267] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#37a267] md:whitespace-nowrap"
                          >
                            + Add Category
                          </button>
                              
                  </div>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6">
                  <div className="space-y-6">
                      <div className="p-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                            <div className="min-w-[1102px]">
                                <CommonTable<Category>
                                  categories={categories}
                                  loading={loading}
                                  error={error}
                                  pagination={pagination || undefined}
                                  columns={columns}
                                  onView={handleViewCategory}
                                  onToggleStatus={handleToggleStatus}
                                  onEdit={handleEditCategory}
                                  onDelete={handleDeleteCategory}
                                />
                            </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>


      

      {/* Create / Edit Modal */}
      <CategoryCreateModal
        isOpen={isCreateOpen}
        onClose={handleCloseCreateModal}
        onCreated={() => fetchCategories(1)}
        editingCategory={editingCategory}
      />

      {/* View Modal */}
      <CategoryViewModal
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        data={viewData}
      />

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onConfirm={confirmDeleteCategory}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCategoryToDelete(null);
        }}
        title="Delete Category"
        confirmationText={`Are you sure you want to delete category "${categoryToDelete?.name}"?`}
        confirmBtnText="Delete"
        isDanger={true}
      />
    </div>
  );
};

export default CategoryMenu;
