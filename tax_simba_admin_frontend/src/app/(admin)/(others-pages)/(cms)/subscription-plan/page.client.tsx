"use client";

import React, { useEffect, useMemo, useState } from "react";
import CommonTable, { Column } from "@/components/cms/CommonTable";
import SearchInput from "@/components/cms/SearchInput";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import {
    getSubscriptionPlans,
    deleteSubscriptionPlan,
    toggleSubscriptionPlanStatus,
    type SubscriptionPlan,
} from "@/lib/cms/subscriptionPlan";
import SubscriptionPlanModal from "./_section/SubscriptionPlanModal";
import SubscriptionPlanViewModal from "./_section/SubscriptionPlanViewModal";
import Badge from "@/components/ui/badge/Badge";
import ConfirmationModal from "@/components/ConfirmationModal";

const SubscriptionPlanMenu = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchValue, setSearchValue] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingPlan, setViewingPlan] = useState<SubscriptionPlan | null>(null);

    // Delete modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);

    const getCurrencySymbol = (currency: string) => {
        if (!currency) return "£";
        try {
            const parts = new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: currency.toUpperCase(),
            }).formatToParts(0);
            return parts.find(p => p.type === 'currency')?.value || currency;
        } catch (e) {
            return currency;
        }
    };

    const fetchPlans = async () => {
        try {
            setLoading(true);
            setError(null);

            let isActive: boolean | undefined = undefined;
            if (statusFilter === "active") isActive = true;
            if (statusFilter === "inactive") isActive = false;

            const res = await getSubscriptionPlans({
                search: searchValue,
                isActive,
            });

            setPlans(Array.isArray(res.data) ? res.data : []);
        } catch (err: any) {
            setError(
                err?.response?.data?.message || err?.message || "Failed to fetch subscription plans"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const handleToggleStatus = async (row: SubscriptionPlan) => {
        try {
            setLoading(true);
            await toggleSubscriptionPlanStatus(row.id);
            await fetchPlans();
        } catch (err: any) {
            setError(
                err?.response?.data?.message || err?.message || "Failed to toggle status"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (row: SubscriptionPlan) => {
        setPlanToDelete(row);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!planToDelete) return;
        try {
            setLoading(true);
            await deleteSubscriptionPlan(planToDelete.id);
            await fetchPlans();
        } catch (err: any) {
            setError(
                err?.response?.data?.message || err?.message || "Failed to delete plan"
            );
        } finally {
            setLoading(false);
            setDeleteModalOpen(false);
            setPlanToDelete(null);
        }
    };

    const openAddModal = () => {
        setEditingPlan(null);
        setIsModalOpen(true);
    };

    const openEditModal = (row: SubscriptionPlan) => {
        setEditingPlan(row);
        setIsModalOpen(true);
    };

    const openViewModal = (row: SubscriptionPlan) => {
        setViewingPlan(row);
        setIsViewModalOpen(true);
    };

    const columns: Column<SubscriptionPlan>[] = useMemo(
        () => [
            { header: "ID", render: (p) => p.id },
            {
                header: "Name",
                render: (p) => (
                    <div>
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {p.isPopular && (
                            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                                POPULAR
                            </span>
                        )}
                    </div>
                )
            },
            {
                header: "Price",
                render: (p) => (
                    <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{getCurrencySymbol(p.currency)} {p.price}</span>
                        {p.originalPrice && (
                            <span className="text-xs text-gray-400 line-through">{getCurrencySymbol(p.currency)} {p.originalPrice}</span>
                        )}
                    </div>
                )
            },
            {
                header: "Category",
                render: (p) => (
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 rounded-md px-2 py-1">
                        {p.category === 'mtd' ? 'MTD' : 'Tax Simba'}
                    </span>
                )
            },
            {
                header: "Interval",
                render: (p) => (
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 rounded-md px-2 py-1 capitalize">
                        {p.interval || "month"}
                    </span>
                )
            },
            { header: "Order", render: (p) => p.displayOrder },
            {
                header: "Status",
                render: (p) => (
                    <Badge
                        color={p.isActive ? "success" : "light"}
                        size="sm"
                    >
                        {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                ),
            },
        ],
        []
    );

    return (
        <div>
        <PageBreadcrumb pageTitle="Subscription Plans" parentPage="Dashboard" parentPageUrl="/overview" />

            <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    {/* Card Header */}
                    <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="w-full sm:w-auto flex flex-wrap items-center gap-3">
                                <div className="w-full sm:w-72">
                                    <SearchInput
                                        searchValue={searchValue}
                                        setSearchValue={setSearchValue}
                                        fetchData={fetchPlans}
                                        placeholder="Search subscription plans..."
                                    />
                                </div>

                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                    className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-theme-xs outline-hidden focus:border-brand-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <button
                                onClick={openAddModal}
                                className="h-11 rounded-lg bg-[#37a267] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#37a267]/90 transition-colors"
                            >
                                + Add Plan
                            </button>
                        </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 sm:p-6">
                        {error && (
                            <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="overflow-hidden">
                            <CommonTable<SubscriptionPlan>
                                categories={plans}
                                loading={loading}
                                error={null}
                                columns={columns}
                                onView={openViewModal}
                                onToggleStatus={handleToggleStatus}
                                onEdit={openEditModal}
                                onDelete={handleDelete}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <SubscriptionPlanModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchPlans}
                editingPlan={editingPlan}
            />

            <SubscriptionPlanViewModal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                plan={viewingPlan}
            />

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setDeleteModalOpen(false);
                    setPlanToDelete(null);
                }}
                title="Delete Plan"
                confirmationText={`Are you sure you want to delete plan "${planToDelete?.name}"?`}
                confirmBtnText="Delete"
                isDanger={true}
            />
        </div>
    );
};

export default SubscriptionPlanMenu;
