"use client";
import React from "react";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Badge from "@/components/ui/badge/Badge";
import { EyeIcon } from "@/icons";
import Image from "next/image";

interface AccountantDetailsModalProps {
    data: any;
}

export default function AccountantDetailsModal({ data }: AccountantDetailsModalProps) {
    const { isOpen, openModal, closeModal } = useModal();

    // Helper to format dates
    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

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
                {/* Modal Header with Gradient */}
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
                            <h3 className="text-2xl font-bold">{data?.name} {data?.surname}</h3>
                            <p className="text-white/80 flex items-center justify-center sm:justify-start gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-white/20 rounded-md text-xs font-semibold uppercase tracking-wider">
                                    {data?.Accountant?.employeeId || data?.employeeId || "ACC-XXXX"}
                                </span>
                                <span className="opacity-60">•</span>
                                <span>Accountant</span>
                            </p>
                        </div>
                        <div className="mt-4 sm:mt-0">
                            <Badge color={data?.status == 1 ? "success" : "error"} size="md">
                                {data?.status == 1 ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="p-6 lg:p-10 bg-white dark:bg-gray-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Section: Contact Info */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                                Contact Information
                            </h4>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Email Address</label>
                                <p className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">{data?.email || "N/A"}</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Phone Number</label>
                                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{data?.mobile || "N/A"}</p>
                            </div>
                        </div>

                        {/* Section: Professional Info */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                                Professional Details
                            </h4>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Qualification</label>
                                <p className="text-sm font-medium text-gray-800 dark:text-white/90 capitalize">{data?.Accountant?.qualification || data?.qualification || "N/A"}</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Experience</label>
                                <p className="text-sm font-medium text-gray-800 dark:text-white/90">{data?.Accountant?.experience || data?.experience ? `${data?.Accountant?.experience || data?.experience} Years` : "N/A"}</p>
                            </div>
                        </div>

                        {/* Section: System Info */}
                        <div className="md:col-span-2 space-y-4 pt-4 border-t border-gray-50">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Onboarded Date</label>
                                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">{formatDate(data?.Accountant?.onboardedAt || data?.onboardedAt)}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Availability</label>
                                    <p className="text-sm">
                                        <Badge variant="light" color={data?.Accountant?.isAvailable !== false ? "success" : "warning"}>
                                            {data?.Accountant?.isAvailable !== false ? "Available for Assignments" : "Busy"}
                                        </Badge>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end mt-10">
                        <button
                            onClick={closeModal}
                            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
