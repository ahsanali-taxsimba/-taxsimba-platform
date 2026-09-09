import React, { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import Badge from "@/components/ui/badge/Badge";
import Image from "next/image";
import { ChevronDownIcon } from "@/icons";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import clientAxios from "@/lib/axios-client";
import ConfirmationModal from "@/components/ConfirmationModal";
import UserViewModal from "./UserViewModal";
import { Eye, ChevronDown } from "lucide-react";

export default function ClientTable(props: any) {
    const { clientData, fetchData, gridUpdate, setGridUpdate, isLoading, page, setPage, limit, setLimit } = props;
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [chosenId, setChosenData] = useState(null);
    const [openDropdownId, setOpenDropdownId] = useState<Array<number>>([]); // Tracks the open dropdown's id
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const openModal = (props: any) => {
        const { id } = props;
        setChosenData(id);
        setShowConfirmModal(true);
    };

    const onConfirm = async () => {
        try {
            const response = await clientAxios.delete(`/admin/accountants/${chosenId}`, true);
            if (response) {
                setShowConfirmModal(false);
                setChosenData(null);
                fetchData();
                setGridUpdate(!gridUpdate);
            }
        } catch (error) {
            console.log(error);
        }
    };

    // Handle the status change
    const onStatusChange = async (status?: number, id?: any) => {
        try {
            const response = await clientAxios.put(`/admin/clients/${id}/status`, { status }, true);
            if (response) {
                setOpenDropdownId([]); // Close the dropdown after status change
                fetchData();
                setGridUpdate(!gridUpdate);
            }
        } catch (error) {
            console.log(error);
        }
    };

    // Toggle the dropdown for specific row
    const toggleDropdown = (id: number) => {
        if (openDropdownId.find((item: number) => item == id)) {
            const filteredIds = openDropdownId.filter((item: number) => item != id);
            setOpenDropdownId(filteredIds); // Close the dropdown if the same row is clicked again
        } else {
            setOpenDropdownId((prev: any) => [...prev, id]); // Open the dropdown for the selected row
        }
    };

    // Pagination component
    const Pagination = ({ current, total, onPageChange }: { current: number, total: number, onPageChange: (page: number) => void }) => {
        const totalPages = Math.ceil(total / limit);
        if (totalPages <= 1) return null;

        return (
            <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-4 dark:bg-gray-900 dark:border-gray-800">
                <div className="flex justify-between flex-1 sm:hidden">
                    <button
                        onClick={() => onPageChange(Math.max(1, current - 1))}
                        disabled={current === 1}
                        className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => onPageChange(Math.min(totalPages, current + 1))}
                        disabled={current === totalPages}
                        className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-700 dark:text-gray-400">
                            Showing <span className="font-medium">{(current - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(current * limit, total)}</span> of{' '}
                            <span className="font-medium">{total}</span> results
                        </p>
                    </div>
                    <div>
                        <nav className="relative z-0 inline-flex shadow-sm -space-x-px" aria-label="Pagination">
                            <button
                                onClick={() => onPageChange(Math.max(1, current - 1))}
                                disabled={current === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700"
                            >
                                Previous
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => onPageChange(i + 1)}
                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${current === i + 1
                                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/20'
                                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700'
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => onPageChange(Math.min(totalPages, current + 1))}
                                disabled={current === totalPages}
                                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700"
                            >
                                Next
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        );
    };

    // Skeleton row for loading state
    const SkeletonRow = () => (
        <TableRow>
            <TableCell className="px-5 py-4 sm:px-6 text-center">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
            </TableCell>
            <TableCell className="px-4 py-3 text-center">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20 mx-auto"></div>
            </TableCell>
            <TableCell className="px-4 py-3 text-center">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32 mx-auto"></div>
            </TableCell>
            <TableCell className="px-4 py-3 text-center">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24 mx-auto"></div>
            </TableCell>
        </TableRow>
    );

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto scrollbar-custom">
                <div className="min-w-[1102px]">
                    <Table className="text-nowrap">
                        <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                            <TableRow>
                                <TableCell className="px-5 py-4 font-bold text-gray-800 text-start text-xs dark:text-white uppercase tracking-wider">
                                    Name
                                </TableCell>
                                <TableCell className="px-5 py-4 font-bold text-gray-800 text-center text-xs dark:text-white uppercase tracking-wider">
                                    Email
                                </TableCell>
                                <TableCell className="px-5 py-4 font-bold text-gray-800 text-center text-xs dark:text-white uppercase tracking-wider">
                                    Mobile
                                </TableCell>

                                <TableCell className="px-5 py-4 font-bold text-gray-800 text-center text-xs dark:text-white uppercase tracking-wider">
                                    Username
                                </TableCell>
                                <TableCell className="px-5 py-4 font-bold text-gray-800 text-center text-xs dark:text-white uppercase tracking-wider">
                                    Platform
                                </TableCell>
                                <TableCell className="px-5 py-4 font-bold text-gray-800 text-center text-xs dark:text-white uppercase tracking-wider">
                                    Plan
                                </TableCell>
                                <TableCell className="px-5 py-4 font-bold text-gray-800 text-center text-xs dark:text-white uppercase tracking-wider">
                                    Status
                                </TableCell>
                                <TableCell className="px-5 py-4 font-bold text-gray-800 text-center text-xs dark:text-white uppercase tracking-wider">
                                    Action
                                </TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, index) => (
                                    <SkeletonRow key={`skeleton-${index}`} />
                                ))
                            ) : (
                                clientData?.data?.users?.map((order: any) => (
                                    <TableRow key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <TableCell className="px-5 py-4 sm:px-6 text-center text-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 overflow-hidden rounded-full">
                                                    <Image
                                                        width={40}
                                                        height={40}
                                                        src={"/images/logo/favicon.ico"}
                                                        alt={order.firstName}
                                                    />
                                                </div>
                                                <div>
                                                    <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90 text-nowrap">
                                                        {`${order.firstName} ${order.lastName}`}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            {order.email}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            {order.mobile}
                                        </TableCell>

                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            {order.username}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            {order.userRole || "-"}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400 text-nowrap">
                                            {order.subscription?.plan?.name || order.subscription?.amount || "-"}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            <div className="relative inline-block">
                                                <Badge
                                                    size="md"
                                                    color={order.status == 1 ? "success" : "error"}
                                                    endIcon={<ChevronDown size={14} />}
                                                    onClick={() => toggleDropdown(order.id)}
                                                    dynamicClassName={"cursor-pointer"}
                                                >
                                                    {order.status == 1 ? "Active" : "Inactive"}
                                                </Badge>
                                                {openDropdownId.find((item: number) => item == order.id) && (
                                                    <Dropdown
                                                        isOpen={true}
                                                        onClose={() => setOpenDropdownId([])}
                                                        className="w-100 p-2 flex flex-col justify-center"
                                                    >
                                                        <DropdownItem
                                                            onItemClick={() => onStatusChange(1, order.id)}
                                                            className="p-0 flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                                                        >
                                                            <Badge size="sm" color={"success"}>
                                                                {"Active"}
                                                            </Badge>
                                                        </DropdownItem>
                                                        <DropdownItem
                                                            onItemClick={() => onStatusChange(0, order.id)}
                                                            className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                                                        >
                                                            <Badge size="sm" color={"error"}>
                                                                {"Inactive"}
                                                            </Badge>
                                                        </DropdownItem>
                                                    </Dropdown>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            <Badge
                                                variant="light"
                                                color="success"
                                                startIcon={<Eye size={16} />}
                                                onClick={() => {
                                                    setSelectedUser(order);
                                                    setIsViewModalOpen(true);
                                                }}
                                                dynamicClassName={"cursor-pointer"}
                                            >
                                                View
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <Pagination
                current={page}
                total={clientData?.data?.pagination?.totalUsers || 0}
                onPageChange={setPage}
            />
            <ConfirmationModal
                isOpen={showConfirmModal}
                onConfirm={onConfirm}
                onCancel={() => setShowConfirmModal(false)}
                title="Delete User"
                confirmationText="Are you sure you want to delete this User?"
                confirmBtnText="Delete"
                isDanger={true}
            />
            <UserViewModal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                user={selectedUser}
            />
        </div>
    );
}
