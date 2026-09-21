"use client";
import React from "react";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Badge from "@/components/ui/badge/Badge";
import { EyeIcon } from "@/icons";
import Image from "next/image";
import {
    accountantStatusLabel,
    isAccountantActive,
} from "@/lib/accountantStatus";

interface AccountantDetailsModalProps {
    data: any;
}

export default function AccountantDetailsModal({ data }: AccountantDetailsModalProps) {
    const { isOpen, openModal, closeModal } = useModal();
    const active = isAccountantActive(data);

    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const phone = data?.mobile || data?.phone || null;
    const qualification =
        data?.Accountant?.qualification || data?.qualification || null;
    const experience =
        data?.Accountant?.experience || data?.experience || null;
    const onboarded =
        data?.Accountant?.onboardedAt ||
        data?.onboardedAt ||
        data?.createdAt ||
        null;

    // Value text must stay dark on light cards and light on dark cards (TS-UAT-030).
    const valueClass =
        "text-sm font-medium text-slate-900 dark:text-slate-100 break-words";
    const labelClass =
        "text-xs text-slate-500 dark:text-slate-400 block mb-1";

    return (
        <>
            <Badge
                variant="light"
                color="success"
                startIcon={<EyeIcon />}
                onClick={openModal}
                dynamicClassName={"cursor-pointer"}
            >
                View
            </Badge>

            <Modal
                isOpen={isOpen}
                onClose={closeModal}
                className="max-w-[640px] p-0 z-1000 overflow-hidden"
            >
                <div className="bg-gradient-to-r from-brand-600 to-brand-400 p-6 text-white text-center sm:text-left relative">
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                        <div className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden bg-white/10 flex-shrink-0">
                            <Image
                                width={96}
                                height={96}
                                src={"/images/logo/favicon.ico"}
                                alt={data?.name}
                                className="object-cover w-full h-full"
                            />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-white">
                                {data?.name} {data?.surname}
                            </h3>
                            <p className="text-white/80 flex items-center justify-center sm:justify-start gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-white/20 rounded-md text-xs font-semibold uppercase tracking-wider">
                                    {data?.Accountant?.employeeId ||
                                        data?.employeeId ||
                                        "ACC-XXXX"}
                                </span>
                                <span className="opacity-60">•</span>
                                <span>Accountant</span>
                            </p>
                        </div>
                        <div className="mt-4 sm:mt-0">
                            <Badge color={active ? "success" : "error"} size="md">
                                {accountantStatusLabel(data)}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="p-6 lg:p-10 bg-white dark:bg-slate-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                                Contact Information
                            </h4>
                            <div>
                                <label className={labelClass}>Email Address</label>
                                <p className={valueClass} data-testid="acc-detail-email">
                                    {data?.email || "N/A"}
                                </p>
                            </div>
                            <div>
                                <label className={labelClass}>Phone Number</label>
                                <p className={valueClass} data-testid="acc-detail-phone">
                                    {phone || "N/A"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                                Professional Details
                            </h4>
                            <div>
                                <label className={labelClass}>Qualification</label>
                                <p
                                    className={`${valueClass} capitalize`}
                                    data-testid="acc-detail-qualification"
                                >
                                    {qualification || "N/A"}
                                </p>
                            </div>
                            <div>
                                <label className={labelClass}>Experience</label>
                                <p className={valueClass} data-testid="acc-detail-experience">
                                    {experience ? `${experience} Years` : "N/A"}
                                </p>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Onboarded Date</label>
                                    <p className={valueClass} data-testid="acc-detail-onboarded">
                                        {formatDate(onboarded)}
                                    </p>
                                </div>
                                <div>
                                    <label className={labelClass}>Availability</label>
                                    <p className="text-sm">
                                        <Badge
                                            variant="light"
                                            color={
                                                data?.Accountant?.isAvailable !== false
                                                    ? "success"
                                                    : "warning"
                                            }
                                        >
                                            {data?.Accountant?.isAvailable !== false
                                                ? "Available for Assignments"
                                                : "Busy"}
                                        </Badge>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end mt-10">
                        <button
                            onClick={closeModal}
                            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-bold rounded-xl transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
