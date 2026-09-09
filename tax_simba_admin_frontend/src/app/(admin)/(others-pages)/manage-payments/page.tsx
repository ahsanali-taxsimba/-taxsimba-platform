'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  CreditCard,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Filter,
  Download,
  Info,
  Mail,
  HelpCircle,
  Eye
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import Badge from '@/components/ui/badge/Badge';

// Types based on your Payment model
interface Payment {
  id: number;
  taxReturnId?: number;
  clientId: number;
  amount: number;
  paymentMethod: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'active';
  currency: string;
  paymentDate?: string;
  refundAmount: number;
  refundDate?: string;
  failureReason?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  type?: 'one-time' | 'subscription';
  client?: {
    id: number;
    name: string;
    surname: string;
    email: string;
  };
  taxReturn?: {
    id: number;
    taxReturnId: string;
    taxYear: number;
  };
  plan?: {
    id: number;
    name: string;
  };
}

interface PaymentStats {
  totalRevenue: number;
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  refundedAmount: number;
  statusBreakdown: Record<string, number>;
  methodBreakdown: Record<string, number>;
  monthlyRevenue: Array<{ month: string; amount: number }>;
}

interface UserPaymentSummary {
  clientId: number;
  clientName: string;
  clientEmail: string;
  totalPaid: number;
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  lastPaymentDate?: string;
  averagePayment: number;
}

const ManagePaymentsPage: React.FC = () => {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [userPayments, setUserPayments] = useState<UserPaymentSummary[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Pagination state
  const [userPaymentsPage, setUserPaymentsPage] = useState(1);
  const [recentPaymentsPage, setRecentPaymentsPage] = useState(1);
  const [userPaymentsTotal, setUserPaymentsTotal] = useState(0);
  const [recentPaymentsTotal, setRecentPaymentsTotal] = useState(0);
  const itemsPerPage = 10;

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${(session as any)?.user?.accessToken}`,
    'Content-Type': 'application/json',
  });

  // Export functionality
  const handleExport = async () => {
    try {
      if (!(session as any)?.user?.accessToken) {
        throw new Error('No authentication token available');
      }

      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedMethod !== 'all') params.append('paymentMethod', selectedMethod);
      params.append('dateRange', dateRange);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/payments/export?${params}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const data = await response.json();

      // Convert to CSV and download
      if (data.success) {
        const csvContent = convertToCSV(data.data);
        downloadCSV(csvContent, `payments-export-${new Date().toISOString().split('T')[0]}.csv`);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      // Show error message to user
    }
  };

  // Helper function to convert data to CSV
  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row =>
      headers.map(header => `"${row[header] || ''}"`).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  };

  // Helper function to download CSV
  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch data when component mounts or filters change
  useEffect(() => {
    if ((session as any)?.user?.accessToken) {
      fetchPaymentData();
    }
  }, [selectedStatus, selectedMethod, dateRange, session, userPaymentsPage, recentPaymentsPage]);

  const fetchPaymentData = async () => {
    setIsLoading(true);
    try {
      if (!(session as any)?.user?.accessToken) {
        throw new Error('No authentication token available');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus === 'completed' ? 'paid' : selectedStatus);
      }
      if (selectedMethod !== 'all') params.append('paymentMethod', selectedMethod);
      params.append('dateRange', dateRange);

      // P0: list is SoT (includes ADDITIONAL_WORK). stats/by-user/export deferred (405).
      const paymentsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/payments?${params}&limit=1000&offset=0`,
        { headers: getAuthHeaders() },
      );

      if (!paymentsResponse.ok) {
        throw new Error('Failed to fetch payment data');
      }

      const paymentsData = await paymentsResponse.json();

      if (paymentsData.success) {
        const raw = paymentsData.data.payments || [];
        const mapped: Payment[] = raw.map((p: any) => {
          const statusRaw = String(p.paymentStatus || p.status || 'pending');
          const status =
            statusRaw === 'paid' ? 'completed' : (statusRaw as Payment['status']);
          const kind = p.kind || p.type || 'SERVICE_ACTIVATION';
          const planName =
            kind === 'ADDITIONAL_WORK'
              ? 'Additional work'
              : kind === 'SA_UPGRADE'
                ? 'Package upgrade'
                : 'Service activation';
          return {
            id: p.id,
            clientId: p.clientId,
            amount: Number(p.amount || 0),
            paymentMethod: 'stripe_checkout',
            status,
            currency: p.currency || 'gbp',
            paymentDate: p.createdAt,
            refundAmount: 0,
            createdAt: p.createdAt,
            updatedAt: p.createdAt,
            type: kind === 'ADDITIONAL_WORK' ? 'one-time' : 'subscription',
            client: {
              id: p.clientId,
              name: p.clientName || 'Client',
              surname: '',
              email: '',
            },
            plan: { id: p.id, name: planName },
            taxReturn: p.caseId
              ? { id: p.caseId, taxReturnId: String(p.caseId), taxYear: 0 }
              : undefined,
            metadata: { kind, clientRef: p.clientRef },
          } as Payment;
        });
        setPayments(mapped);
        setRecentPaymentsTotal(mapped.length || 0);

        const completed = mapped.filter((p) => p.status === 'completed').length;
        const pending = mapped.filter((p) => p.status === 'pending').length;
        setStats({
          totalRevenue: mapped
            .filter((p) => p.status === 'completed')
            .reduce((s, p) => s + Number(p.amount || 0), 0),
          totalPayments: mapped.length,
          completedPayments: completed,
          pendingPayments: pending,
          failedPayments: mapped.filter((p) => p.status === 'failed').length,
          refundedAmount: 0,
          statusBreakdown: {},
          methodBreakdown: {},
          monthlyRevenue: [],
        });
        setUserPayments([]);
        setUserPaymentsTotal(0);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching payment data:', error);
      setIsLoading(false);
    }
  };

  const Pagination = ({ current, total, onPageChange }: { current: number, total: number, onPageChange: (page: number) => void }) => {
    const totalPages = Math.ceil(total / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-4">
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
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(current - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(current * itemsPerPage, total)}</span> of{' '}
              <span className="font-medium">{total}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => onPageChange(Math.max(1, current - 1))}
                disabled={current === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => onPageChange(i + 1)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${current === i + 1
                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => onPageChange(Math.min(totalPages, current + 1))}
                disabled={current === totalPages}
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

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'refunded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4" />;
      case 'failed':
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      case 'refunded':
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsDetailsModalOpen(true);
  };

  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap lg:flex-nowrap gap-2 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <p className="text-gray-600">Monitor and manage all payments</p>
        </div>
        <div className="flex flex-wrap lg:flex-nowrap gap-2 space-x-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <button
            onClick={fetchPaymentData}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#37a267] hover:bg-[#37a267]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPayments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedPayments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingPayments}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex lg:items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <div className="flex flex-wrap lg:flex-nowrap gap-2 space-x-4">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Payments</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments
                .slice((recentPaymentsPage - 1) * itemsPerPage, recentPaymentsPage * itemsPerPage)
                .map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {payment.client?.name} {payment.client?.surname}
                        </div>
                        <div className="text-sm text-gray-500">{payment.client?.email}</div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.plan?.name || '_'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="capitalize">{payment.paymentMethod.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(payment.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() :
                        new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Badge
                        variant="light"
                        color="success"
                        startIcon={<Eye size={16} />}
                        onClick={() => handleViewDetails(payment)}
                        dynamicClassName={"cursor-pointer"}
                      >
                        View Details
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination
          current={recentPaymentsPage}
          total={recentPaymentsTotal}
          onPageChange={setRecentPaymentsPage}
        />
      </div>

      {/* User Payment Summary — deferred in P0 (by-user endpoint HIDE) */}
      {userPayments.length > 0 && (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Payments by User</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-nowrap">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Payment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Payment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {userPayments.map((user) => (
                <tr key={user.clientId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.clientName}</div>
                      <div className="text-sm text-gray-500">{user.clientEmail}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {formatCurrency(user.totalPaid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-2">

                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">{user.totalPayments} total</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(user.averagePayment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.lastPaymentDate ? new Date(user.lastPaymentDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-1">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                        {user.completedPayments} completed
                      </span>
                      {user.pendingPayments > 0 && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                          {user.pendingPayments} pending
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          current={userPaymentsPage}
          total={userPaymentsTotal}
          onPageChange={setUserPaymentsPage}
        />
      </div>
      )}



      {/* Payment Stats */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(stats.statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(status)}
                    <span className="ml-2 text-sm font-medium text-gray-900 capitalize">{status}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(stats.methodBreakdown).map(([method, count]) => (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <span className="ml-2 text-sm font-medium text-gray-900 capitalize">
                      {method.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl 
             mx-4 max-h-[90vh] overflow-y-auto  text-start shadow-2xl"
      >
        <div className="relative overflow-hidden rounded-2xl" style={{ background: '#fff' }}>
          {selectedPayment && (
            <>
              {/* Premium Dark Gradient Header */}
              <div
                className="relative px-8 py-7 pr-16 flex justify-between items-center overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #1a3a2a 100%)',
                }}
              >
                {/* Background glow orb */}
                <div
                  className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-20 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, #37a267 0%, transparent 70%)' }}
                />
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#37a267' }}>
                    Transaction Record
                  </p>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">Payment Details</h2>
                </div>
                {/* Glowing Status Badge */}
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border backdrop-blur-sm ${getStatusColor(selectedPayment.status)}`}
                  style={{ boxShadow: '0 0 12px rgba(55,162,103,0.35)' }}
                >
                  {getStatusIcon(selectedPayment.status)}
                  <span className="capitalize">{selectedPayment.status}</span>
                </div>
              </div>

              {/* Amount Hero Strip */}
              <div
                className="px-8 py-5 flex items-center justify-between"
                style={{ background: 'linear-gradient(90deg, #f0fdf4 0%, #eff6ff 100%)', borderBottom: '1px solid #e2e8f0' }}
              >
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-0.5">Total Amount</p>
                  <p className="text-4xl font-black tracking-tight" style={{ color: '#1e3a5f' }}>
                    {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: '#dbeafe', color: '#1d4ed8' }}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="capitalize">{selectedPayment.paymentMethod.replace('_', ' ')}</span>
                  </span>
                  <span
                    className="text-xs font-mono font-semibold px-3 py-1 rounded-lg"
                    style={{ background: '#f1f5f9', color: '#64748b' }}
                  >
                    TXN #{selectedPayment.id}
                  </span>
                </div>
              </div>

              {/* Main Body */}
              <div className=" py-2 lg:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Client Info */}
                  <div
                    className="rounded-2xl p-3 lg:p-5 border flex flex-col gap-3"
                    style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Client Information</p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #37a267, #1e3a5f)' }}
                      >
                        {selectedPayment.client?.name?.[0]}{selectedPayment.client?.surname?.[0]}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-base leading-tight">
                          {selectedPayment.client?.name} {selectedPayment.client?.surname}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />
                          {selectedPayment.client?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Plan / Subscription */}
                  <div
                    className="rounded-2xl p-5 border flex flex-col gap-3"
                    style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Transaction Details</p>
                    <div className="space-y-3">
                      {selectedPayment.type === 'subscription' && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Plan</span>
                          <span
                            className="text-sm font-bold px-3 py-1 rounded-lg"
                            style={{ background: '#ede9fe', color: '#6d28d9' }}
                          >
                            {selectedPayment.plan?.name || 'Subscription Plan'}
                          </span>
                        </div>
                      )}
                      {selectedPayment.stripePaymentIntentId && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Stripe ID</span>
                          <span className="text-xs font-mono text-gray-600 truncate max-w-[160px]" title={selectedPayment.stripePaymentIntentId}>
                            {selectedPayment.stripePaymentIntentId}
                          </span>
                        </div>
                      )}
                      {selectedPayment.type === 'one-time' && selectedPayment.taxReturn && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Tax Return</span>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">#{selectedPayment.taxReturn.taxReturnId}</p>
                            <p className="text-xs text-gray-400">Year {selectedPayment.taxReturn.taxYear}</p>
                          </div>
                        </div>
                      )}
                      {!selectedPayment.type && !selectedPayment.stripePaymentIntentId && !selectedPayment.taxReturn && (
                        <p className="text-sm text-gray-400 italic">No additional details</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline / Dates Row */}
                <div
                  className="rounded-2xl p-5 border"
                  style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Transaction Timeline</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0">
                    {/* Initiated */}
                    <div className="flex-1 flex items-start gap-3">
                      <div
                        className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#dbeafe' }}
                      >
                        <Clock className="w-4 h-4" style={{ color: '#2563eb' }} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Initiated</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">
                          {new Date(selectedPayment.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {/* Connector */}
                    <div className="hidden sm:flex flex-col items-center px-4">
                      <div className="h-px w-16 bg-gray-200" />
                    </div>
                    {/* Confirmed */}
                    <div className="flex-1 flex items-start gap-3">
                      <div
                        className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#dcfce7' }}
                      >
                        <CheckCircle className="w-4 h-4" style={{ color: '#16a34a' }} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Confirmed</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">
                          {selectedPayment.paymentDate
                            ? new Date(selectedPayment.paymentDate).toLocaleString()
                            : (selectedPayment.status === 'completed' || selectedPayment.status === 'active'
                              ? new Date(selectedPayment.createdAt).toLocaleString()
                              : 'Processing...')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Failure Alert */}
                {selectedPayment.status === 'failed' && selectedPayment.failureReason && (
                  <div
                    className="rounded-xl p-4 flex gap-3 border-l-4"
                    style={{ background: '#fef2f2', borderColor: '#ef4444' }}
                  >
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-800">Payment Failed</p>
                      <p className="text-sm text-red-700 mt-0.5 italic">{selectedPayment.failureReason}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="px-8 py-5 flex justify-center border-t"
                style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
              >
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-10 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                    color: '#fff',
                    boxShadow: '0 4px 14px rgba(15,23,42,0.3)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ManagePaymentsPage;