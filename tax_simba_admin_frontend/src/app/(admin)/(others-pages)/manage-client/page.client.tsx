"use client";
import React, { useEffect } from 'react';
import BasicTables from './_partials/BasicTables';
import PageBreadcrumb from '@/components/common/PageBreadCrumb';
import clientAxios from '@/lib/axios-client';
import SearchInput from './_sections/SearchInput';
import FormAddEditModal from './_sections/FormAddEdit';
import ClientTable from './_sections/ClientTable';

interface ManageClientProps {
    // Define your props here, for example:
    // clientId?: string;
}

const ManageClientPage: React.FC<ManageClientProps> = (props) => {
    const [clientData, setclientData] = React.useState<any>(null);
    const [gridUpdate, setGridUpdate] = React.useState<boolean>(false);
    const [isLoading, setIsloading] = React.useState<boolean>(false);
    const [searchValue, setSearchValue] = React.useState<string>("");

    // Pagination state
    const [page, setPage] = React.useState(1);
    const [limit, setLimit] = React.useState(10);
    useEffect(() => {
        fetchClients()
    }, [page, limit, gridUpdate])
    const fetchClients = async () => {
        setIsloading(true)
        try {
            const response = await clientAxios.post(`/admin/clients`, {
                search: searchValue,
                page,
                limit
            }, true)
            setclientData(response?.data)
            setIsloading(false)
        } catch (error) {
            console.error("err ", error)
            setIsloading(false)
        }
    }
    return (
        <div>
            <PageBreadcrumb pageTitle="Manage Clients" parentPage="dashboard" parentPageUrl="/overview" />
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
                                    fetchData={fetchClients}
                                />

                            </div>

                        </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6">
                        <div className="space-y-6">
                            <ClientTable
                                clientData={clientData}
                                fetchData={fetchClients}
                                gridUpdate={gridUpdate}
                                setGridUpdate={setGridUpdate}
                                isLoading={isLoading}
                                page={page}
                                setPage={setPage}
                                limit={limit}
                                setLimit={setLimit}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


export default ManageClientPage;