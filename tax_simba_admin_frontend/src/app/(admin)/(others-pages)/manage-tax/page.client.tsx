'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  Search,
  FileText,
  Settings,
  List,
  Grid,
  Eye,
} from 'lucide-react';
import PageBreadcrumb from '@/components/common/PageBreadCrumb';
import Badge from "@/components/ui/badge/Badge";
import clientAxios from '@/lib/axios-client';
import { useRouter } from 'next/navigation';
import { TaxReturnData } from '@/utils/interface';
import AssignAccountantModal from './_sections/AssignAccountantModal';
import TaxReturnCard from './_sections/TaxReturnCard';

// Types
type TabStatus = 'pending' | 'assigned' | 'completed';
type ViewMode = 'table' | 'cards';


// Main Component
const AdminTaxReturnManagement: React.FC = () => {
  const [taxReturns, setTaxReturns] = useState<TaxReturnData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [assignTaxReturnId, setAssignTaxReturnId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const statusMap: Record<TabStatus, string[]> = {
    pending: ['pending_payment'],
    assigned: ['assigned', 'preparation_started', 'draft_ready', 'final_submitted'],
    completed: ['completed'],
  };


  const fetchTaxReturns = async () => {
    setIsLoading(true);
    try {
      const res = await clientAxios.post('/admin/tax-return/files', {});
      const responseData = res.data?.data ?? [];
      setTaxReturns(responseData);
    } catch (error) {
      console.error('Error fetching tax returns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxReturns();
  }, []);
  const toLower = (v?: string) => (v || '').toLowerCase();
  const query = toLower(searchTerm);
  const PENDING_STATUSES = ['pending_payment', 'payment_completed', 'pending_assignment'];
  const ASSIGNED_STATUSES = ['assigned', 'preparation_started', 'draft_ready', 'final_submitted'];
  const COMPLETED_STATUSES = ['completed'];
  const filteredReturns = (taxReturns || []).filter(({ taxReturn }) => {
    const status = taxReturn?.status || '';

    const statusMatch =
      activeTab === 'pending'
        ? PENDING_STATUSES.includes(status)
        : activeTab === 'assigned'
          ? ASSIGNED_STATUSES.includes(status)
          : activeTab === 'completed'
            ? COMPLETED_STATUSES.includes(status)
            : true;

    const c = taxReturn?.client || {};
    const searchMatch =
      !query ||
      toLower(c.name).includes(query) ||
      toLower(c.surname).includes(query) ||
      toLower(c.email).includes(query) ||
      toLower(taxReturn?.taxReturnId).includes(query);

    return statusMatch && searchMatch;
  });
  const handleViewDetails = (taxReturnId: number) => {
    router.push(`/manage-tax/${taxReturnId}`);
  };

  const handleAssign = (taxReturnId: number) => {
    setAssignTaxReturnId(taxReturnId);
  };

  // Statistics
  const stats = {
    total: taxReturns.length,
    pending: taxReturns.filter(item =>
      ['pending_payment', 'payment_completed', 'pending_assignment'].includes(item.taxReturn.status)
    ).length,
    assigned: taxReturns.filter(item =>
      ['assigned', 'preparation_started', 'draft_ready', 'final_submitted'].includes(item.taxReturn.status)
    ).length,
    completed: taxReturns.filter(item =>
      item.taxReturn.status === 'completed'
    ).length
  };


  return (
    <div>
      <PageBreadcrumb
        pageTitle="Manage Tax Files"
        parentPage="Dashboard"
        parentPageUrl="/overview"
      />

      <AssignAccountantModal
        isOpen={assignTaxReturnId !== null}
        onClose={() => setAssignTaxReturnId(null)}
        fileId={assignTaxReturnId}
        setTaxReturns={setTaxReturns}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap md:flex-nowrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Return Management</h1>
            <p className="text-gray-600">Manage all tax return files and assignments</p>
          </div>
          <div className="flex flex-wrap md:flex-nowrap space-x-3">
            {/* View Mode Toggle */}
            <div className="flex bg-[#37a267] rounded-xl p-2">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'table'
                  ? 'bg-white text-dark shadow-sm flex items-center rounded-lg'
                  : 'text-white  flex items-center rounded-lg'
                  }`}
              >
                <List className="w-4 h-4 inline mr-1" />
                Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'cards'
                  ? 'bg-white text-dark shadow-sm flex items-center rounded-lg'
                  : 'text-white  flex items-center rounded-lg'
                  }`}
              >
                <Grid className="w-4 h-4 inline mr-1" />
                Cards
              </button>
            </div>
            <button
              onClick={fetchTaxReturns}
              className="bg-[#37a267] text-white flex items-center space-x-2 px-4 py-2 refresh-btn rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by client name, email, or tax return ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex justify-between space-x-2">
            {(['pending', 'assigned', 'completed'] as TabStatus[]).map((tab) => (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-1/3 text-center p-2 font-semibold cursor-pointer rounded ${activeTab === tab
                  ? 'bg-[#37a267] text-white'
                  : 'bg-gray-100 text-gray-700'
                  }`}
              >
                {tab.toUpperCase()}
              </div>
            ))}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Returns</p>
                <p className="text-2xl font-bold text-gray-900 mb-0">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-gray-900 mb-0">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 mb-1">Assigned</p>
                <p className="text-2xl font-bold text-gray-900 mb-0">{stats.assigned}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mb-0">{stats.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading...</span>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No tax returns found
              </h3>
              <p className="text-gray-600">
                {searchTerm
                  ? `No results found for "${searchTerm}" in "${activeTab}" returns.`
                  : `No tax returns found for "${activeTab}".`
                }
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReturns.reverse().map((item) => (
                <TaxReturnCard
                  key={item.taxReturn.id}
                  item={item}
                  onAssign={handleAssign}
                  onViewDetails={handleViewDetails}
                  showAssignButton={activeTab !== 'assigned' && activeTab !== 'completed'}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className='border-b border-gray-100 dark:border-white/[0.05] text-nowrap'>
                  <tr>
                    <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Client</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Tax Year / Qtr</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Files</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Last Uploaded</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Status</th>
                    <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReturns.reverse().map((item) => {
                    const { taxReturn, files } = item;
                    const lastFile = files?.allFiles?.[0];

                    return (
                      <tr key={taxReturn.id} className='hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group'>
                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                          {taxReturn.client.name} {taxReturn.client.surname}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                          {taxReturn.taxYear}
                          {taxReturn.mtdQuarter && (
                            <div className="text-xs font-semibold text-indigo-600 mt-1">{taxReturn.mtdQuarter}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">{files?.allFiles?.length ?? 0}</td>
                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                          {lastFile?.uploadedAt
                            ? new Date(lastFile.uploadedAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400 whitespace-nowrap">
                          {PENDING_STATUSES.includes(taxReturn.status) ?
                            'To be assigned' :
                            ASSIGNED_STATUSES.includes(taxReturn.status) ?
                              `Assigned to ${taxReturn?.accountant?.name ?? 'Accountant'}` :
                              COMPLETED_STATUSES.includes(taxReturn.status) ? 'Completed' : 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                          <div className="flex items-center justify-end gap-2">
                            {lastFile?.downloadUrl && (
                              <a
                                href={lastFile.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-auto text-decoration-none inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400 cursor-pointer"
                              >
                                Download
                              </a>
                            )}
                            {activeTab !== 'assigned' && activeTab !== 'completed' && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAssignTaxReturnId(taxReturn.id);
                                }}
                                className="w-auto ml-2 inline-flex items-center !rounded-full bg-[#37a267] px-3 py-1 text-sm text-white hover:bg-[#37a267]/90"
                              >
                                Assign
                              </button>
                            )}
                            <Badge
                              variant="light"
                              color="success"
                              startIcon={<Eye size={16} />}
                              onClick={() => router.push(`/manage-tax/${taxReturn.id}`)}
                              dynamicClassName={"cursor-pointer w-auto"}
                            >
                              View
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTaxReturnManagement;