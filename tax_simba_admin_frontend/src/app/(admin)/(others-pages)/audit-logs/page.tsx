'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search,
  Filter,
  Eye,
  RefreshCw,
  Activity,
  Globe,
  Clock,
  Terminal,
  User,
  Info
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import Badge from '@/components/ui/badge/Badge';

interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  module: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  source: 'client' | 'server';
  createdAt: string;
  user?: {
    id: number;
    name: string;
    surname: string;
    email: string;
    role: string;
  };
}

const AuditLogsPage: React.FC = () => {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const itemsPerPage = 15;

  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${(session as any)?.user?.accessToken}`,
    'Content-Type': 'application/json',
  });

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      if (!(session as any)?.user?.accessToken) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}admin/audit-logs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery,
          module: selectedModule,
          source: selectedSource
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const resData = await response.json();
      if (resData.success) {
        setLogs(resData.data.logs || []);
        setTotalLogs(resData.data.pagination?.totalLogs || 0);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if ((session as any)?.user?.accessToken) {
      fetchLogs();
    }
  }, [session, currentPage, selectedModule, selectedSource]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedModule('all');
    setSelectedSource('all');
    setCurrentPage(1);
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('SUCCESS') || act.includes('ADD') || act.includes('UPLOAD')) {
      return 'success';
    }
    if (act.includes('FAIL') || act.includes('DELETE') || act.includes('CANCEL')) {
      return 'error';
    }
    if (act.includes('UPDATE') || act.includes('EDIT')) {
      return 'warning';
    }
    return 'info';
  };

  const getModuleBadgeColor = (module: string) => {
    switch (module.toUpperCase()) {
      case 'AUTH':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'BILLING':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'TAX_RETURN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'PROFILE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDetails = (detailsStr: string | null) => {
    if (!detailsStr) return 'N/A';
    try {
      const parsed = JSON.parse(detailsStr);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return detailsStr;
    }
  };

  // Local Pagination Component
  const Pagination = () => {
    const totalPages = Math.ceil(totalLogs / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-4">
        <div className="flex justify-between flex-1 sm:hidden">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalLogs)}</span> of{' '}
              <span className="font-medium">{totalLogs}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                    currentPage === i + 1
                      ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap lg:flex-nowrap gap-2 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600">Trace actions and events across client and server systems</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#37a267] hover:bg-[#37a267]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search action, details, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm w-72 focus:outline-none focus:ring-1 focus:ring-[#37a267] focus:border-[#37a267]"
              />
            </div>
            
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md text-sm font-medium"
            >
              Search
            </button>

            <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={selectedModule}
                onChange={(e) => {
                  setSelectedModule(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#37a267]"
              >
                <option value="all">All Modules</option>
                <option value="AUTH">Auth</option>
                <option value="BILLING">Billing</option>
                <option value="TAX_RETURN">Tax Return</option>
                <option value="PROFILE">Profile</option>
              </select>

              <select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#37a267]"
              >
                <option value="all">All Sources</option>
                <option value="server">Server Only</option>
                <option value="client">Client Only</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Clear Filters
          </button>
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37a267]"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No Logs Found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Log ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      #{log.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.user ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.user.name} {log.user.surname}
                          </div>
                          <div className="text-sm text-gray-500">{log.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Guest / System</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant="light"
                        color={getActionBadgeColor(log.action)}
                        dynamicClassName="font-semibold text-xs"
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 border rounded-full text-xs font-semibold ${getModuleBadgeColor(log.module)}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <span className={`capitalize inline-flex items-center gap-1 font-medium ${log.source === 'client' ? 'text-blue-600' : 'text-[#37a267]'}`}>
                        {log.source === 'client' ? <Globe className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
                        {log.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ipAddress || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Badge
                        variant="light"
                        color="success"
                        startIcon={<Eye size={16} />}
                        onClick={() => {
                          setSelectedLog(log);
                          setIsDetailsOpen(true);
                        }}
                        dynamicClassName="cursor-pointer"
                      >
                        View Details
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination />
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedLog(null);
        }}
        className="max-w-2xl p-6"
      >
        <div className="pb-4 mb-4 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Audit Log Entry Details</h3>
        </div>
        {selectedLog && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 border-b pb-4">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Action</span>
                <Badge
                  variant="light"
                  color={getActionBadgeColor(selectedLog.action)}
                  dynamicClassName="mt-1 font-semibold text-sm"
                >
                  {selectedLog.action}
                </Badge>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Module</span>
                <span className={`inline-flex px-2.5 py-1 border rounded-full text-xs font-semibold mt-1 ${getModuleBadgeColor(selectedLog.module)}`}>
                  {selectedLog.module}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">User Information</span>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="p-2.5 bg-gray-200 rounded-lg">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                {selectedLog.user ? (
                  <div>
                    <h5 className="font-semibold text-gray-900">
                      {selectedLog.user.name} {selectedLog.user.surname}
                    </h5>
                    <p className="text-xs text-gray-500">{selectedLog.user.email} • ID: #{selectedLog.user.id} • Role: {selectedLog.user.role}</p>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500 italic">Guest User or System Initiated</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">IP Address</span>
                <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5 mt-1">
                  <Globe className="w-4 h-4 text-gray-400" />
                  {selectedLog.ipAddress || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Source</span>
                <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5 mt-1 capitalize">
                  {selectedLog.source === 'client' ? <Globe className="w-4 h-4 text-blue-500" /> : <Terminal className="w-4 h-4 text-[#37a267]" />}
                  {selectedLog.source}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">User Agent (Browser Info)</span>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 font-mono break-all leading-relaxed">
                {selectedLog.userAgent || 'No user-agent details available'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Event Payload (details)</span>
              <pre className="p-3 bg-gray-950 rounded-xl text-xs text-green-400 font-mono overflow-auto max-h-48 leading-relaxed">
                {formatDetails(selectedLog.details)}
              </pre>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 pt-2 border-t justify-end">
              <Clock className="w-3.5 h-3.5" />
              <span>Logged at {new Date(selectedLog.createdAt).toString()}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogsPage;
