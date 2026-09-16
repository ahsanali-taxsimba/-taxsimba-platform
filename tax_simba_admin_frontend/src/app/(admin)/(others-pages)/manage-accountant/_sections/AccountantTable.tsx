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
import { ChevronDownIcon, PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import FormAddEditModal from "./FormAddEdit";
import AccountantDetailsModal from "./AccountantDetailsModal";
import ConfirmationModal from "@/components/ConfirmationModal";
import clientAxios from "@/lib/axios-client";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import { toast } from "react-toastify";

interface Order {
    id: number;
    user: {
        image: string;
        name: string;
        role: string;
    };
    projectName: string;
    team: {
        images: string[];
    };
    status: string;
    budget: string;
}

// Define the table data using the interface
const tableData: Order[] = [
    {
        id: 1,
        user: {
            image: "/images/user/user-17.jpg",
            name: "Lindsey Curtis",
            role: "Web Designer",
        },
        projectName: "Agency Website",
        team: {
            images: [
                "/images/user/user-22.jpg",
                "/images/user/user-23.jpg",
                "/images/user/user-24.jpg",
            ],
        },
        budget: "3.9K",
        status: "Active",
    },
    {
        id: 2,
        user: {
            image: "/images/user/user-18.jpg",
            name: "Kaiya George",
            role: "Project Manager",
        },
        projectName: "Technology",
        team: {
            images: ["/images/user/user-25.jpg", "/images/user/user-26.jpg"],
        },
        budget: "24.9K",
        status: "Pending",
    },
    {
        id: 3,
        user: {
            image: "/images/user/user-17.jpg",
            name: "Zain Geidt",
            role: "Content Writing",
        },
        projectName: "Blog Writing",
        team: {
            images: ["/images/user/user-27.jpg"],
        },
        budget: "12.7K",
        status: "Active",
    },
    {
        id: 4,
        user: {
            image: "/images/user/user-20.jpg",
            name: "Abram Schleifer",
            role: "Digital Marketer",
        },
        projectName: "Social Media",
        team: {
            images: [
                "/images/user/user-28.jpg",
                "/images/user/user-29.jpg",
                "/images/user/user-30.jpg",
            ],
        },
        budget: "2.8K",
        status: "Cancel",
    },
    {
        id: 5,
        user: {
            image: "/images/user/user-21.jpg",
            name: "Carla George",
            role: "Front-end Developer",
        },
        projectName: "Website",
        team: {
            images: [
                "/images/user/user-31.jpg",
                "/images/user/user-32.jpg",
                "/images/user/user-33.jpg",
            ],
        },
        budget: "4.5K",
        status: "Active",
    },
];

export default function AccountantTable(props: any) {
    const { accountantData, fetchData, gridUpdate, setGridUpdate, isLoading } = props
    console.log("acc", accountantData?.data?.accountants)
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [chosenId, setChosenData] = useState(null)
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [openDropdownId, setOpenDropdownId] = useState<Array<number>>([]);
console.log('openDropdownId', openDropdownId)
    const openModal = (props: any) => {
        const { id } = props;
        console.log("is ", id)
        setChosenData(id)
        setShowConfirmModal(true)
    }

    const onConfirm = async () => {
        try {
            const response = await clientAxios.delete(`/admin/accountants/${chosenId}`, true)
            console.log("response ", response?.data)
            if (response) {
                toast.success(response.data?.message || "Accountant deleted successfully.");
                setShowConfirmModal(false)
                setChosenData(null)
                if (typeof fetchData === "function") fetchData();
                if (typeof setGridUpdate === "function") setGridUpdate(!gridUpdate);
            }
        } catch (error: any) {
            console.log(error)
            toast.error(error.response?.data?.message || "Failed to delete accountant.");
        }
    }

    const onStatusChange = async (status?: number, id?: any) => {
        console.log("status ", status, " id ", id)
        try {
            const response = await clientAxios.post(`/admin/accountants/${id}/status`, { status }, true)
            console.log("response ", response?.data)
            if (response) {
                toast.success(response.data?.message || "Status updated successfully.");
                setOpenDropdownId([]);
                if (typeof fetchData === "function") fetchData();
                if (typeof setGridUpdate === "function") setGridUpdate(!gridUpdate);
            }
        } catch (error: any) {
            console.log(error)
            toast.error(error.response?.data?.message || "Failed to update status.");
        }
    }

    const toggleDropdown = (id: number) => {
        if (openDropdownId.find((item:number)=> item == id)) {
            const filteredIds = openDropdownId.filter((item:number) => item != id);
            setOpenDropdownId(filteredIds); // Close the dropdown if the same row is clicked again
        } else {
            setOpenDropdownId((prev:any)=> [...prev, id]); // Open the dropdown for the selected row
        }
    };

    useEffect(() => {
        console.log("updating...")
    }, [gridUpdate])

    // Skeleton Row Component
    const SkeletonRow = () => (
        <TableRow>
            <TableCell className="px-5 py-4 sm:px-6 text-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
                </div>
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
            <TableCell className="px-5 py-4 sm:px-6 text-center">
                <div className="flex justify-center">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                </div>
            </TableCell>
            <TableCell className="px-5 py-4 sm:px-6 text-center">
                <div className="flex justify-center">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                </div>
            </TableCell>
        </TableRow>
    );

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto scrollbar-custom">
                <div className="min-w-[1102px]">
                    <Table className="text-nowrap">
                        {/* Table Header */}
                        <TableHeader className="border-b border-gray-100 dark:border-white/[0.05] text-nowrap">
                            <TableRow>
                                <TableCell
                                    isHeader
                                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-c"
                                >
                                    First Name
                                </TableCell>
                                <TableCell
                                    isHeader
                                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                                >
                                    Surname
                                </TableCell>
                                <TableCell
                                    isHeader
                                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                                >
                                    Email
                                </TableCell>
                                <TableCell
                                    isHeader
                                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                                >
                                    Mobile
                                </TableCell>
                                <TableCell
                                    isHeader
                                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                                >
                                    Status
                                </TableCell>
                                <TableCell
                                    isHeader
                                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                                >
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                            {isLoading ? (
                                // Show skeleton rows during loading
                                Array.from({ length: 5 }).map((_, index) => (
                                    <SkeletonRow key={`skeleton-${index}`} />
                                ))
                            ) : (
                                // Show actual data
                                accountantData?.data?.accountants?.length > 0 && accountantData?.data?.accountants.map((order: any) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="px-5 py-4 sm:px-6 text-center text-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 overflow-hidden rounded-full">
                                                    <Image
                                                        width={40}
                                                        height={40}
                                                        src={"/images/logo/favicon.ico"}
                                                        alt={order.name}
                                                    />
                                                </div>
                                                <div>
                                                    <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90 text-nowrap">
                                                        {order.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            {order.surname}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            {order.email}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            {order.mobile}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                                            <div className="relative inline-block">
                                                <Badge
                                                    size="md"
                                                    color={
                                                        order.status == 1
                                                            ? "success"
                                                            :
                                                            // order.status === "Pending"
                                                            //     ? "warning"
                                                            //     : 
                                                            "error"
                                                    }
                                                    endIcon={<ChevronDownIcon />}
                                                    onClick={() => toggleDropdown(order.id)}
                                                    dynamicClassName={"cursor-pointer"}
                                                >
                                                    {order.status == 1 ? "Active" : "Inactive"}
                                                </Badge>
                                                 {openDropdownId.find((item:number)=> item == order.id) && (
                                                    <Dropdown
                                                        isOpen={true}
                                                        onClose={() => setOpenDropdownId([])} 
                                                        className="w-100 p-2 flex flex-col justify-center"
                                                    >
                                                        <DropdownItem
                                                            onItemClick={() => onStatusChange(1, order.id)}
                                                            className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                                                        >
                                                            <Badge
                                                                size="sm"
                                                                color={ "success"}
                                                            >
                                                                {"Active"}
                                                            </Badge>
                                                        </DropdownItem>
                                                        <DropdownItem
                                                            onItemClick={() => onStatusChange(0, order.id)}
                                                            className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                                                        >
                                                            <Badge
                                                                size="sm"
                                                                color={ "error"}
                                                            >
                                                                {"Inactive"}
                                                            </Badge>
                                                        </DropdownItem>
                                                    </Dropdown>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-5 py-4 sm:px-6 text-center">
                                            <div className="flex justify-center items-center gap-3">
                                                <div className="flex flex-row justify-center items-center gap-2">
                                                    <AccountantDetailsModal data={order} />
                                                    <FormAddEditModal formType="Edit" getFormData={order} fetchData={fetchData} gridUpdate={gridUpdate} setGridUpdate={setGridUpdate} />
                                                    <Badge variant="light" color="error" startIcon={<TrashBinIcon />} dynamicClassName={"cursor-pointer"} onClick={() => openModal(order)}>
                                                        Delete
                                                    </Badge>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <ConfirmationModal
                isOpen={showConfirmModal}
                onConfirm={onConfirm}
                onCancel={() => setShowConfirmModal(false)}
                title="Delete Accountant"
                confirmationText="Are you sure you want to delete this Accountant?"
                confirmBtnText="Delete"
                isDanger={true}
            />
        </div>
    );
}
