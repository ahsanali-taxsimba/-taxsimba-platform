"use client";

import React, { useEffect, useMemo, useState } from "react";
import CommonTable, { Column } from "@/components/cms/CommonTable";
import SearchInput from "@/components/cms/SearchInput";
import { useRouter } from "next/navigation";

import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  reorderServices,
  type Service,
  type ServiceListResponse,
} from "@/lib/cms/service";

import ServiceCreateModal from "./_section/ServiceCreateModal";
import ServiceViewModal from "./_section/ServiceViewModal";
import Badge from "@/components/ui/badge/Badge";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ConfirmationModal from "@/components/ConfirmationModal";

type Pagination = ServiceListResponse["pagination"];

const ServiceMenu = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "inactive">("all");




  // View modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState<Service | null>(null);

  // Reorder local state
  const [dirtyOrder, setDirtyOrder] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  const currentPage = pagination?.page ?? 1;

  const fetchServices = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      let isActive: boolean | undefined = undefined;
      if (statusFilter === "active") isActive = true;
      if (statusFilter === "inactive") isActive = false;

      const res = await getServices({
        page,
        limit: 10,
        search: searchValue,
        isActive,
      });

      setServices(res.data?.services || []);
      setPagination(res.data?.pagination || null);
      setDirtyOrder(false);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to fetch services"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchServices(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // ---- actions ----


  const handleToggleStatus = async (row: Service) => {
    try {
      setLoading(true);
      setError(null);
      await toggleServiceStatus(row.id);
      await fetchServices(currentPage);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to toggle service status"
      );
    } finally {
      setLoading(false);
    }
  };



  const handleDelete = (row: Service) => {
    setServiceToDelete(row);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    try {
      setLoading(true);
      setError(null);
      await deleteService(serviceToDelete.id);
      await fetchServices(currentPage);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to delete service"
      );
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setServiceToDelete(null);
    }
  };




  // ---- reorder helpers ----
  const moveRow = (id: number, dir: "up" | "down") => {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;

      const nextIdx = dir === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;

      const clone = [...prev];
      const temp = clone[idx];
      clone[idx] = clone[nextIdx];
      clone[nextIdx] = temp;

      // re-assign displayOrder in UI order
      const normalized = clone.map((s, i) => ({
        ...s,
        displayOrder: i + 1,
      }));

      return normalized;
    });
    setDirtyOrder(true);
  };

  const saveOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      await reorderServices({
        services: services.map((s) => ({
          id: s.id,
          displayOrder: s.displayOrder,
        })),
      });

      setDirtyOrder(false);
      await fetchServices(currentPage);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to reorder services"
      );
    } finally {
      setLoading(false);
    }
  };
  const handleView = (row: Service) => {
    router.push(`/service/${row.id}/service-details`);
  };
  const columns: Column<Service>[] = useMemo(
    () => [
      { header: "ID", render: (s) => s.id },
      { header: "Title", render: (s) => <span className="font-medium">{s.title}</span> },
      { header: "Slug", render: (s) => s.slug },
      { header: "Tagline", render: (s) => s.tagline ?? "-" },
      { header: "Display Order", render: (s) => s.displayOrder },
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
      {
        header: "Reorder",
        render: (s) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => moveRow(s.id, "up")}
              className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveRow(s.id, "down")}
              className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
            >
              ↓
            </button>
          </div>
        ),
      },
    ],
    [services]
  );
  const handleEdit = (row: Service) => {
    router.push(`/service/${row.id}/edit`);
  };

  return (
    <>
      <PageBreadcrumb
        pageTitle="Service Menu"
        parentPage="Dashboard"
        parentPageUrl="/overview"
      />

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-3">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <SearchInput
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                fetchData={() => fetchServices(1)}
              />
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
                onClick={() => router.push("/service/create")}
                className="h-11 rounded-lg bg-[#37a267] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#37a267] md:whitespace-nowrap"
              >
                + Add Service
              </button>

              <button
                type="button"
                disabled={!dirtyOrder || loading}
                onClick={saveOrder}
                className="h-11 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Save Order
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                <div className="p-3">
                  <div className="min-w-[1102px]">
                    <CommonTable<Service>
                      categories={services}
                      loading={loading}
                      error={error}
                      pagination={pagination || undefined}
                      columns={columns}
                      onView={handleView}
                      onToggleStatus={handleToggleStatus}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setServiceToDelete(null);
        }}
        title="Delete Service"
        confirmationText={`Are you sure you want to delete service "${serviceToDelete?.title}"?`}
        confirmBtnText="Delete"
        isDanger={true}
      />


    </>
  );
};

export default ServiceMenu;
