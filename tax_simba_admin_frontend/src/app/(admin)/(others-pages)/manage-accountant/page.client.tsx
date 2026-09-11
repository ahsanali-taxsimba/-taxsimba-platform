"use client";
import ComponentCard from '@/components/common/ComponentCard';
import PageBreadcrumb from '@/components/common/PageBreadCrumb';
import TableComponentCard from '@/components/common/TableComponentCard';
import BasicTableOne from '@/components/tables/BasicTableOne';
import React, { useEffect } from 'react';
import FormAddEditModal from './_sections/FormAddEdit';
import axiosInstance from '@/lib/axiosInstance';
import clientAxios from '@/lib/axios-client';
import AccountantTable from './_sections/AccountantTable';
import SearchInput from './_sections/SearchInput';

interface ManageAccountantProps {
    // Define your props here, for example:
    // clientId?: string;
}

const ManageAccountantPage: React.FC<ManageAccountantProps> = (props) => {
    const [accountantsData, setAccountantsData] = React.useState<any>(null);
    const [gridUpdate, setGridUpdate] = React.useState<boolean>(false);
    const [isLoading, setIsloading] = React.useState<boolean>(false);
    const [searchValue, setSearchValue] = React.useState<string>("");
    useEffect(() => {
        console.log("useEffect called");
        fetchAccountants()
    }, [])
    const fetchAccountants = async () => {
        setIsloading(true)
        try {
            const response = await clientAxios.post(`/admin/accountants`, { search: searchValue }, true)
            setAccountantsData(response?.data)
            setIsloading(false)
        } catch (error) {
            console.error("err ", error)
            setIsloading(false)
        }
    }
    return (
        <div>
            <PageBreadcrumb pageTitle="Manage Accountant" parentPage="dashboard" parentPageUrl="/overview" />
            <div className="space-y-6">
                <div
                    className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`}
                >
                    {/* Card Header */}
                    <div className="p-3">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className='w-full sm:w-auto'>
                                <SearchInput
                                    searchValue={searchValue}
                                    setSearchValue={setSearchValue}
                                    gridUpdate={gridUpdate}
                                    setGridUpdate={setGridUpdate}
                                    fetchData={fetchAccountants}
                                />

                            </div>
                            <div className="w-full sm:w-auto">
                                <FormAddEditModal fetchData={fetchAccountants} gridUpdate={gridUpdate} setGridUpdate={setGridUpdate} />
                            </div>
                        </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6">
                        <div className="space-y-6">
                            <AccountantTable accountantData={accountantsData} fetchData={fetchAccountants} gridUpdate={gridUpdate} setGridUpdate={setGridUpdate} isLoading={isLoading} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


export default ManageAccountantPage;