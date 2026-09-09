"use client";

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Upload,
  Download,
  Mail,
  Bell,
  Eye,
  FileText,
  Info,
  UserPlus,
  ArrowLeft,
  Star,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import clientAxios from '@/lib/axios-client';
import { Accountant, FilesData, TaxReturn } from '@/utils/interface';
import { formatFileSize } from '@/utils/taxReturnUtils';
import HorizontalProgressBar from '../../tax-return-list/_section/HorizontalProgressBar';
import { getStatusLabel } from '../../tax-return-list/_section/statusUtils';
import EmailModal from '@/components/TaxReturnModal/EmailModal';
import DraftUploadModal from '@/components/TaxReturnModal/UploadDraftModal';
import { useSession } from 'next-auth/react';
import AdminFlags from '@/components/FlagModal/AdminFlag';
import { getNotificationIcon } from '@/utils/getNotification';
import BellButton from '@/components/NotficationData/BellButton';
import DownloadCertificate from '@/components/TaxReturnModal/DownloadCertificateModal';
import AdditionalWorkPanel from '../_sections/AdditionalWorkPanel';
import ExternalSubmissionPanel from '../_sections/ExternalSubmissionPanel';

const AdminTaxReturnDetails = () => {
  const router = useRouter();
  const { data } = useSession();
  const userData = data?.user;

  // Normalize route param from useParams
  const params = useParams<{ taxReturnId?: string | string[] }>();
  const taxReturnIdStr = Array.isArray(params?.taxReturnId)
    ? params?.taxReturnId?.[0] ?? ''
    : params?.taxReturnId ?? '';
  const taxReturnIdNum = taxReturnIdStr ? Number(taxReturnIdStr) : NaN;
  const taxReturnIdForPayload = Number.isFinite(taxReturnIdNum) ? taxReturnIdNum : undefined;

  const [taxReturn, setTaxReturn] = useState<TaxReturn | null>(null);
  const [files, setFiles] = useState<FilesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReviewForReject, setSelectedReviewForReject] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);
  // Modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [showFinalCertificateModal, setShowFinalCertificateModal] = useState(false);
  
  // Assignment modal states
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [selectedAccountant, setSelectedAccountant] = useState<number | null>(null);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assignmentPriority, setAssignmentPriority] = useState('medium');
  const [assignmentDeadline, setAssignmentDeadline] = useState('');
  const [assignmentDeadlineError, setAssignmentDeadlineError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progressData, setProgressData] = useState<any>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [flagCounts, setFlagCounts] = useState({ open: 0, total: 0 });

  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchEmailTemplate = async () => {
    try {
      const response = await clientAxios.get('/admin/template');
      if (response.data.success) {
        return response.data;
      } else {
        // Email templates are S6 HIDE — compose without template.
        return { success: false };
      }
    } catch (err) {
      console.error('Error fetching email template:', err);
      return { success: false };
    }
  };

  const fetchReviewData = async () => {
    if (!taxReturnIdStr) return;
    try {
      const response = await clientAxios.post(`/admin/get-review/${encodeURIComponent(taxReturnIdStr)}`);
      console.log(response.data.data, "response==>")
      if (response.data.success) {
        const payload = response.data.data;
        setReviews(Array.isArray(payload) ? payload : payload?.reviews ?? []);
      }
    } catch (err) {
      console.error('Error fetching review data:', err);
    }
  }

  useEffect(() => {
    fetchTaxReturnData();
    fetchProgressData();
    fetchChatData();
    fetchReviewData();
    // P0: flags CMS deferred — do not call get-flag-data on load
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxReturnIdStr]);

  const fetchFlagCounts = async () => {
    // Intentionally no-op: /admin/get-flag-data is not in P0 compat.
    setFlagCounts({ open: 0, total: 0 });
  };

  const fetchChatData = async () => {
    if (!taxReturnIdStr) return;

    setChatLoading(true);
    try {
      const response = await clientAxios.post(
        `/admin/communication-log/${encodeURIComponent(taxReturnIdStr)}`,
        { page: 1, limit: 50 }
      );

      console.log(response, "chat response===>")

      if (response.data.success) {
        setChatHistory(response.data.data.emails || []);
      } else {
        console.error('Failed to fetch chat data:', response.data.message);
      }
    } catch (err) {
      console.error('Error fetching chat data:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchProgressData = async () => {
    if (!taxReturnIdStr) return;

    setProgressLoading(true);
    try {
      const response = await clientAxios.post(
        `/tax-return/${encodeURIComponent(taxReturnIdStr)}/progress`,
        {}
      );

      if (response.data.success) {
        setProgressData(response.data.data);
      } else {
        console.error('Failed to fetch progress data:', response.data.message);
      }
    } catch (err) {
      console.error('Error fetching progress data:', err);
    } finally {
      setProgressLoading(false);
    }
  };
   const postProgressData = (newStatus: string) => {
      if (!taxReturnIdStr) return;
      clientAxios.post(`/admin/tax-return/${encodeURIComponent(taxReturnIdStr)}/progress`, {
        status: newStatus
      })
        .then(async (response) => {
          if (response.data.success) {
            // Refresh progress data
            await fetchProgressData();
            setNotifications(prev => [{
              id: Date.now(),
              type: 'status',
              message: `Status updated to ${getStatusLabel(newStatus)}`,
              time: 'Just now',
              read: false
            }, ...prev]);
          } else {
            setError(response.data.message || 'Failed to update status');
          }
        })
        .catch((err) => {
          console.error('Error updating status:', err);
          setError('Error updating status');
        })
        .finally(() => {
          setLoading(false);
        });
    }

  const fetchTaxReturnData = async () => {
    if (!taxReturnIdStr) return;

    setLoading(true);
    try {
      const response = await clientAxios.post(
        `/admin/tax-return/${encodeURIComponent(taxReturnIdStr)}/files`,
        {}
      );

      if (response.data.success) {
        setTaxReturn(response.data.data.taxReturn);
        setFiles(response.data.data.files);
      } else {
        setError('Failed to load tax return data');
      }
    } catch (err) {
      setError('Error fetching tax return data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!taxReturnIdStr) return;

    try {
      // Case-scoped /tax-returns/:id/notifications is not in P0 compat — use global list.
      const response = await clientAxios.post(`/all-notifications`, {
        page: 1,
        limit: 20,
        unreadOnly: false,
      });

      console.log(response.data, "notifications response");

      if (response.data.success) {
        setNotifications(response.data.data.notifications);
      } else {
        console.error('Failed to fetch notifications:', response.data.message);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      const response = await clientAxios.patch(`/notifications/${notificationId}/read`);

      if (response.data.success) {
        setNotifications(prev =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification
          )
        );
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!taxReturnIdStr) return;

    try {
      const response = await clientAxios.patch(`/notifications/mark-all-read`);

      if (response.data.success) {
        setNotifications(prev =>
          prev.map(notification => ({ ...notification, read: true }))
        );
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const fetchAccountants = async () => {
    try {
      const res = await clientAxios.post('/admin/accountants', {});
      const data = res?.data?.data?.accountants || res?.data?.data;
      setAccountants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch accountants', error);
      setAccountants([]);
    }
  };

  const formatEmailDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatCategoryName = (category: string) => {
    return category.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const formatDocumentType = (docType: string) => {
    return docType.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return 'bg-yellow-100 text-yellow-800';
      case 'payment_completed':
        return 'bg-blue-100 text-blue-800';
      case 'assigned':
      case 'preparation_started':
      case 'draft_ready':
      case 'final_submitted':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return 'Pending';
      case 'payment_completed':
        return 'Payment Completed';
      case 'assigned':
      case 'preparation_started':
      case 'draft_ready':
      case 'final_submitted':
        return 'Assigned';
      case 'completed':
        return 'Completed';
      default:
        return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  const handleStatusUpdate = async (newStatus: string | undefined) => {
    if (!newStatus) return;
    if (!progressData?.meta?.canUpdate || loading) return;
    if (!taxReturnIdStr) return;

    console.log(newStatus, "newStatusnewStatus")
    if (newStatus === 'assigned') {
      fetchAccountants();
      setShowAssignModal(true);
      return
    }
    if (newStatus === 'draft_ready') {
      setShowUploadModal(true);
      return
    }
    if (newStatus == "final_submitted") {
      setShowFinalCertificateModal(true)
      return
    }
    setLoading(true);
    postProgressData(newStatus)

  };

  const handleEmailSend = async (emailData: any) => {
    try {
      console.log('Sending email with data:', emailData);

      const response = await clientAxios.post('/admin/send-to-client', {
        clientId: taxReturn?.client?.id,
        emailData: {
          subject: emailData.subject,
          message: emailData.htmlContent,
          htmlContent: emailData.htmlContent,
          documentList: emailData.documentList || '',
          taxReturnId: taxReturnIdForPayload, // send number when available
          templateId: emailData.templateId
        }
      });

      if (response.data.success) {
        setShowEmailModal(false);
        fetchChatData();
        setNotifications(prev => [{
          id: Date.now(),
          type: 'sent',
          message: 'Email sent to client successfully',
          time: 'Just now',
          read: false
        }, ...prev]);
      } else {
        setError('Failed to send email');
      }
    } catch (err) {
      console.error('Error sending email:', err);
      setError('Error sending email');
    }
  };

  const handleAssignAccountant = async () => {
    setAssignmentDeadlineError('');
    if (!selectedAccountant || !taxReturn) return;

    if (assignmentDeadline) {
      const selected = new Date(assignmentDeadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) {
        setAssignmentDeadlineError('Deadline cannot be in the past');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await clientAxios.post('/admin/assign', {
        taxReturnId: taxReturn.id,
        accountantId: selectedAccountant,
        notes: assignmentNotes,
        priority: assignmentPriority,
        deadline: assignmentDeadline || null
      });

      console.log('Assignment response:', res.data);

      await fetchTaxReturnData();
      await fetchProgressData();

      setShowAssignModal(false);
      setSelectedAccountant(null);
      setAssignmentNotes('');
      setAssignmentPriority('medium');
      setAssignmentDeadline('');

      setNotifications(prev => [{
        id: Date.now(),
        type: 'assignment',
        message: 'Tax return assigned to accountant successfully',
        time: 'Just now',
        read: false
      }, ...prev]);
    } catch (err) {
      console.error('Assignment failed:', err);
      alert('Failed to assign tax return.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewAction = async (action: 'approve' | 'reject', reviewData: any = null) => {
    const review = reviewData || selectedReviewForReject;

    if (!review) {
      alert('No review selected.');
      return;
    }

    if (action === 'reject' && !rejectReason.trim()) {
      alert('Please provide a reason for rejecting the review.');
      return;
    }

    const isRejecting = action === 'reject';
    const isApproving = action === 'approve';

    if (isRejecting) setRejecting(true);
    if (isApproving) setApproving(true);

    try {
      const requestData: any = { action };
      if (action === 'reject') {
        requestData.reason = rejectReason;
      }

      const response = await clientAxios.post(`/admin/manage-review/${review.id}`, requestData);

      if (response.data.success) {
        await fetchReviewData();

        if (isRejecting) {
          setShowRejectModal(false);
          setSelectedReviewForReject(null);
          setRejectReason('');
        }

        const actionText = action === 'approve' ? 'approved' : 'rejected';
        setNotifications(prev => [{
          id: Date.now(),
          type: action,
          message: `Review from ${review.client?.name || 'Client'} has been ${actionText}`,
          time: 'Just now',
          read: false
        }, ...prev]);

        alert(`Review ${actionText} successfully.`);
      } else {
        alert(`Failed to ${action} review: ` + (response.data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(`Error ${action}ing review:`, err);
      alert(`Error ${action}ing review. Please try again.`);
    } finally {
      if (isRejecting) setRejecting(false);
      if (isApproving) setApproving(false);
    }
  };

  const openRejectModal = (review: any) => {
    setSelectedReviewForReject(review);
    setShowRejectModal(true);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star key={index} className={`w-4 h-4 ${index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Loading Tax Return Details...</h2>
        </div>
      </div>
    );
  }

  if (error || !taxReturn || !files) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Tax Return</h2>
          <p className="text-gray-600 mb-4">{error || 'Tax return not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm border-b mb-4">
        <div>
          <div className="flex justify-between items-center px-4 py-4">
            <div className="flex items-start">
              <button
                onClick={() => router.back()}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Tax Return Details
                </h1>
                <p className="text-gray-600 mb-0">Manage tax return for {taxReturn.client.name} {taxReturn.client.surname}</p>
              </div>
            </div>
            <BellButton notifications={notifications} />
          </div>
        </div>
      </div>

      <div>
        {/* Client Info & Status */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
              <div className="flex items-start space-x-4 flex-wrap gap-3">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-800 font-bold text-xl">
                    {taxReturn.client.name[0]}{taxReturn.client.surname[0]}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {taxReturn.client.name} {taxReturn.client.surname}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    <div className="flex items-center space-x-1">
                      <Mail className="w-4 h-4" />
                      <span>{taxReturn.client.email}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileText className="w-4 h-4" />
                      <span>{taxReturn.taxReturnId}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3 flex-wrap gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(taxReturn.status)}`}>
                  {getStatusText(taxReturn.status)}
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="flex items-center space-x-2 bg-[#37a267] text-white px-4 py-2 rounded-lg hover:bg-[#37a267]"
                  >
                    <Mail className="h-4 w-4" />
                    <span>Email Client</span>
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Draft</span>
                  </button>
                  {taxReturn.status !== 'assigned' && (
                    <button
                      onClick={() => {
                        fetchAccountants();
                        setShowAssignModal(true);
                      }}
                      className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Assign</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tax Return Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h6 className="text-sm font-medium text-gray-500">Tax Return ID</h6>
                <p className="text-lg font-semibold text-gray-900 mb-0">{taxReturn.taxReturnId}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h6 className="text-sm font-medium text-gray-500">Tax Year</h6>
                <p className="text-lg font-semibold text-gray-900 mb-0">{taxReturn.taxYear}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h6 className="text-sm font-medium text-gray-500">Type</h6>
                <p className="text-lg font-semibold text-gray-900 mb-0">{taxReturn.type.typeName}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h6 className="text-sm font-medium text-gray-500">Assigned Accountant</h6>
                <p className="text-lg font-semibold text-gray-900 mb-0">
                  {taxReturn.accountant?.name || 'Not Assigned'}
                </p>
              </div>
            </div>

            {/* Status Progress */}
            <HorizontalProgressBar
              progressData={progressData}
              loading={progressLoading}
              handleStatusUpdate={handleStatusUpdate}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="border-b border-gray-200 min-w-max">
              <nav className="-mb-px flex space-x-4 sm:space-x-8 px-4 sm:px-6">
              {['overview', 'documents', 'files_by_category', 'communication', 'notifications'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-3 border-b-2 font-medium text-sm capitalize whitespace-nowrap flex-shrink-0 ${activeTab === tab
                    ? 'border-[#37a267] text-[#37a267]'
                    : 'border-transparent text-gray-500 hover:text-[#37a267] hover:border-[#37a267]'
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{tab.replace('_', ' ')}</span>
                    {tab === 'flags' && flagCounts.open > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                        {flagCounts.open}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              </nav>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Files Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-600">Total Files</h3>
                    <p className="text-2xl font-bold text-blue-900">{files.totalFiles}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-600">Total Size</h3>
                    <p className="text-2xl font-bold text-green-900">{formatFileSize(files.totalSize)}</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-amber-600">Categories</h3>
                    <p className="text-2xl font-bold text-amber-900">{Object.keys(files.categories).length}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {notifications.slice(0, 3).map((notification) => (
                      <div key={notification.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{notification.message}</p>
                          <p className="text-xs text-gray-500">{notification.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <AdditionalWorkPanel taxReturnId={taxReturnIdStr} userRole={userData?.role} />
                <div className="mt-6">
                  <ExternalSubmissionPanel
                    taxReturnId={taxReturnIdStr}
                    nodeStatus={progressData?.nodeStatus ?? taxReturn?.status}
                    onRecorded={async () => {
                      await fetchProgressData();
                      await fetchTaxReturnData();
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {files.allFiles.map((file: any) => (
                        <tr key={file.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {file.documentType ? formatDocumentType(file.documentType) : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-400 mr-3" />
                              <span className="text-sm text-gray-900">{file.filename}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatFileSize(file.fileSize)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(file.uploadedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${file.uploadStatus === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                              }`}>
                              {file.uploadStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                           
                            <button
                              type="button"
                              className="text-green-600 hover:text-green-800"
                              onClick={async () => {
                                try {
                                  let url = file.downloadUrl || file.cloudinaryUrl;
                                  if (!url) return;
                                  if (!/^https?:\/\//i.test(url)) {
                                    const res = await clientAxios.get(
                                      `/${String(url).replace(/^\//, "")}`,
                                      true,
                                      { responseType: "blob" },
                                    );
                                    const blobUrl = URL.createObjectURL(res.data);
                                    const a = document.createElement("a");
                                    a.href = blobUrl;
                                    a.download = file.filename || "document";
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    URL.revokeObjectURL(blobUrl);
                                  } else {
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  }
                                } catch (err) {
                                  console.error("Download failed", err);
                                }
                              }}
                            >
                              <Download className="h-4 w-4 inline mr-1" />
                              Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'files_by_category' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Files by Category</h3>
                {Object.entries(files.categories).map(([categoryKey, categoryFiles]) => (
                  <div key={categoryKey} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      {formatCategoryName(categoryKey)}
                    </h4>

                    {Object.entries(categoryFiles as any).map(([docType, docFiles]: any) => (
                      <div key={docType} className="mb-4 last:mb-0">
                        <h5 className="text-md font-medium text-gray-700 mb-2">
                          {formatDocumentType(docType)}
                        </h5>

                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Filename</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Size</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Uploaded</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Status</th>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {docFiles.map((file: any) => (
                                <tr key={file.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{file.filename}</td>
                                  <td className="px-4 py-2 text-sm text-gray-600">{formatFileSize(file.fileSize)}</td>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {new Date(file.uploadedAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${file.uploadStatus === 'completed'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                      {file.uploadStatus}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <a
                                      href={file.cloudinaryUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                    >
                                      Download
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'communication' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Communication History</h3>
                  <button
                    onClick={fetchChatData}
                    disabled={chatLoading}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {chatLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>

                {chatLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : chatHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No communication history found for this tax return.</p>
                    <p className="text-sm">Start a conversation by sending an email to the client.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto bg-gray-50 rounded-lg p-4">
                    {chatHistory.map((email: any) => {
                      const currentUserId = (userData as any)?.id;
                      const isSentByCurrentUser = email.accountantId == currentUserId;

                      let senderName = 'Unknown';
                      let senderRole = '';

                      if (isSentByCurrentUser) {
                        senderName = 'You';
                      } else {
                        if (email.accountant?.role === 'ADMIN') {
                          senderName = email.accountant.name || 'Admin';
                          senderRole = 'ADMIN';
                        } else if (email.accountant?.role === 'ACCOUNTANT') {
                          senderName = email.accountant.name || 'Accountant';
                          senderRole = 'ACCOUNTANT';
                        } else {
                          senderName = email.client?.name || 'Client';
                          senderRole = 'CLIENT';
                        }
                      }

                      return (
                        <div key={email.id} className={`flex ${isSentByCurrentUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-lg rounded-lg px-4 py-3 shadow-sm ${isSentByCurrentUser
                            ? 'bg-blue-500 text-white'
                            : senderRole === 'ADMIN'
                              ? 'bg-purple-100 border border-purple-200 text-purple-900'
                              : 'bg-white border border-gray-200 text-gray-900'
                            }`}>
                            <div className="flex justify-between items-center mb-2">
                              <span className={`text-xs ${isSentByCurrentUser
                                ? 'text-blue-100'
                                : senderRole === 'ADMIN'
                                  ? 'text-purple-600'
                                  : 'text-gray-500'
                                }`}>
                                {senderName}
                                {senderRole === 'ADMIN' && !isSentByCurrentUser && (
                                  <span className="ml-1 text-xs opacity-75">(Admin)</span>
                                )}
                              </span>
                              <span className={`text-xs ${isSentByCurrentUser
                                ? 'text-blue-200'
                                : senderRole === 'ADMIN'
                                  ? 'text-purple-500'
                                  : 'text-gray-400'
                                }`}>
                                {formatEmailDate(email.sentAt)}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {email.parsedEmailData?.subject &&
                                !email.parsedEmailData.subject.includes('Message from TaxSimba') && (
                                  <div className={`text-sm font-medium pb-1 border-b ${isSentByCurrentUser
                                    ? 'text-blue-100 border-blue-400'
                                    : senderRole === 'ADMIN'
                                      ? 'text-purple-700 border-purple-300'
                                      : 'text-gray-700 border-gray-300'
                                    }`}>
                                    {email.parsedEmailData.subject}
                                  </div>
                                )}

                              {email.parsedEmailData?.messageText && (
                                <div className="text-sm leading-relaxed">
                                  {email.parsedEmailData.messageText}
                                </div>
                              )}

                              {email.parsedEmailData?.documentList && (
                                <div className={`mt-3 p-2 rounded text-xs ${isSentByCurrentUser
                                  ? 'bg-blue-400 bg-opacity-50'
                                  : senderRole === 'ADMIN'
                                    ? 'bg-purple-200'
                                    : 'bg-gray-100'
                                  }`}>
                                  <div className="font-medium mb-1">📋 Documents requested:</div>
                                  <div>{email.parsedEmailData.documentList}</div>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-between items-center mt-2">
                              <div className={`text-xs ${isSentByCurrentUser
                                ? 'text-blue-200'
                                : senderRole === 'ADMIN'
                                  ? 'text-purple-500'
                                  : 'text-gray-500'
                                }`}>
                                {email.template && `Template: ${email.template.name}`}
                              </div>
                              <div className={`text-xs ${isSentByCurrentUser
                                ? 'text-blue-200'
                                : senderRole === 'ADMIN'
                                  ? 'text-purple-500'
                                  : 'text-gray-500'
                                }`}>
                                {email.status === 'sent' && '✓ Sent'}
                                {email.status === 'delivered' && '✓✓ Delivered'}
                                {email.status === 'failed' && '✗ Failed'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="h-4"></div>
                  </div>
                )}

                <div className="border-t pt-6">
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Send New Email</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">All Notifications</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={fetchNotifications}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Refresh
                    </button>
                    {notifications.some((n) => !n.read) && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Mark All as Read
                      </button>
                    )}
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No notifications found for this tax return.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${!notification.read
                          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        onClick={() => !notification.read && markNotificationAsRead(notification.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <span className="text-lg" title={`Type: ${notification.type}`}>
                              {getNotificationIcon(notification.type)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${!notification.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                                {notification.message}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-gray-500">{notification.time}</p>
                                {notification.from && (
                                  <span className="text-xs text-gray-400">
                                    from {notification.from.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" title="Unread"></div>
                            )}
                            {notification.url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Navigate to:', notification.url);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="View details"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Client Reviews</h3>
                    <div className="text-sm text-gray-500">
                      {reviews.filter(r => r.status === 1).length} approved, {reviews.filter(r => r.status === 0).length} rejected
                    </div>
                  </div>

                  {!reviews || reviews.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      <p>No reviews found for this tax return.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review: any) => (
                        <div key={review.id} className={`border rounded-lg p-6 ${review.status === 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                          }`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {review.client ? review.client.name : `Client-${review.clientId}`}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Tax Return: {review.taxReturn ? review.taxReturn.taxReturnId : 'N/A'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(review.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="flex">{renderStars(review.rating)}</div>
                              <span className="text-sm text-gray-600">({review.rating}/5)</span>
                            </div>
                          </div>

                          <div className="mb-4">
                            <p className="text-gray-700">{review.message}</p>
                          </div>

                          {review.status === 0 && review.rejectionReason && (
                            <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg">
                              <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                              <p className="text-sm text-red-700">{review.rejectionReason}</p>
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              {review.status === 0 ? (
                                <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Not Approved
                                </span>
                              ) : (
                                <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Approved
                                </span>
                              )}

                              {review.status === 0 && (
                                <span className="text-xs text-red-600">
                                  Hidden from public view
                                </span>
                              )}
                            </div>

                            <div className="flex space-x-2">
                              {review.status === 1 ? (
                                <button
                                  onClick={() => openRejectModal(review)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors flex items-center space-x-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>Reject</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReviewAction('approve', review)}
                                  disabled={approving}
                                  className="text-green-600 hover:text-green-800 text-sm font-medium transition-colors flex items-center space-x-1 disabled:opacity-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>{approving ? 'Approving...' : 'Approve'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'flags' && (
              <AdminFlags
                taxReturnId={taxReturnIdStr}
                clientAxios={clientAxios}
              />
            )}

          </div>
        </div>
      </div>

      {showRejectModal && selectedReviewForReject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Reject Review</h3>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">
                    {selectedReviewForReject.client?.name || `Client-${selectedReviewForReject.clientId}`}
                  </h4>
                  <div className="flex">{renderStars(selectedReviewForReject.rating)}</div>
                </div>
                <p className="text-gray-700 text-sm mb-2">{selectedReviewForReject.message}</p>
                <p className="text-xs text-gray-500">
                  {new Date(selectedReviewForReject.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    placeholder="Please provide a reason for rejecting this review (e.g., inappropriate content, spam, violation of terms, etc.)"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> Rejecting this review will hide it from public view. You can approve it later if needed.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedReviewForReject(null);
                    setRejectReason('');
                  }}
                  disabled={rejecting}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReviewAction('reject')}
                  disabled={rejecting || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  {rejecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Reject Review</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Accountant Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h4 className="font-semibold text-gray-800 mb-6 text-lg">
              Assign to Accountant
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Accountant</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={selectedAccountant || ''}
                  onChange={(e) => setSelectedAccountant(Number(e.target.value))}
                >
                  <option value="">-- Choose an accountant --</option>
                  {accountants.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={assignmentPriority}
                  onChange={(e) => setAssignmentPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium (default)</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (optional)</label>
                <input
                  type="date"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${assignmentDeadlineError ? 'border-red-500' : 'border-gray-300'}`}
                  value={assignmentDeadline}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    setAssignmentDeadline(e.target.value);
                    setAssignmentDeadlineError('');
                  }}
                />
                {assignmentDeadlineError && <p className="text-red-500 text-xs mt-1">{assignmentDeadlineError}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignAccountant}
                disabled={!selectedAccountant || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleEmailSend}
        taxReturn={
          taxReturn
            ? {
                ...taxReturn,
                taxYear: String(taxReturn.taxYear),
                client: { ...taxReturn.client, id: Number(taxReturn.client.id) },
              }
            : null
        }
        fetchEmailTemplate={fetchEmailTemplate}
      />

      {/* Upload Draft Modal */}
      {showUploadModal && (
        <DraftUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          taxReturnId={taxReturnIdStr}
          onUploadSuccess={() => {
            setShowUploadModal(false);
            fetchTaxReturnData();
            fetchProgressData();
          }}
          fetchProgressData={fetchProgressData}
        />
      )}
      {showFinalCertificateModal && (
              <DownloadCertificate
                isOpen={showFinalCertificateModal}
                onClose={() => setShowFinalCertificateModal(false)}
                taxReturnId={taxReturnIdNum ? taxReturnIdStr : ''}
                onUploadSuccess={() => {
                  setShowFinalCertificateModal(false);
                  fetchTaxReturnData();
                  fetchProgressData();
                }}
                fetchProgressData={fetchProgressData}
                postProgressData={postProgressData}
                setShowFinalCertificateModal={setShowFinalCertificateModal}
              />
            )}
    </div>
  );
};

export default AdminTaxReturnDetails;

