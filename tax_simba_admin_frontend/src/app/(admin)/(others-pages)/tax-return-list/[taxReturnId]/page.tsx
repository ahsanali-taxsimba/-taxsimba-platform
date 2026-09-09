"use client";

import React, { useEffect, useState } from 'react';
import {
  Upload,
  Mail,
  MessageSquare,
  Bell,
  Flag,
  Send,
  Info,
  X,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { EmailTemplate, FilesData, Review, TaxReturn } from '@/utils/interface';
import clientAxios from '@/lib/axios-client';
import { useParams } from 'next/navigation';
import UploadedFilesDetails from '../_section/UploadFileDetails';
import { formatFileSize } from '@/utils/taxReturnUtils';
import { getStatusLabel } from '../_section/statusUtils';
import HorizontalProgressBar from '../_section/HorizontalProgressBar';
import EmailModal from '@/components/TaxReturnModal/EmailModal';
import DraftUploadModal from '@/components/TaxReturnModal/UploadDraftModal';
import { useSession } from 'next-auth/react';
import FlagModal from '@/components/FlagModal/FlagModal';
import RequestDocumentsModal from '@/components/FlagModal/RequiredDocument';
import { getNotificationIcon } from '@/utils/getNotification';
import BellButton from '@/components/NotficationData/BellButton';
import DownloadCertificate from '@/components/TaxReturnModal/DownloadCertificateModal';



const TaxReturnManagement = () => {
  const { taxReturnId } = useParams();
  const { data } = useSession();
  const userData = (data?.user as { id?: number | string, url?: string }) || {};
  const [showRequestDocModal, setShowRequestDocModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [taxReturn, setTaxReturn] = useState<TaxReturn | null>(null);
  const [files, setFiles] = useState<FilesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFinalCertificateModal, setShowFinalCertificateModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [progressData, setProgressData] = useState<any>(null);

  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  type Notification = {
    id: number;
    type: string;
    message: string;
    time: string;
    read: boolean;
    url?: string;
    from?: { name: string };
  };

  interface TaxReturn {
    id: number;
    taxReturnId: string;
    taxYear: string | number;
    client?: {
      id: number | string;
      [key: string]: any;
    };
    [key: string]: any;
  }

  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, type: 'approval', message: 'Client approved draft for Tax Return 0287-AJH', time: '2 hours ago', read: false },
    { id: 2, type: 'query', message: 'Client replied to your query about W-2 forms', time: '5 hours ago', read: false },
    { id: 3, type: 'upload', message: 'Client uploaded additional documents', time: '1 day ago', read: true }
  ]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  const [reviewResponse, setReviewResponse] = useState('');

  // Fetch email template from API
  const fetchEmailTemplate = async () => {
    try {
      const response = await clientAxios.get('/accountant/template');
      if (response.data.success) {
        return response.data;
      } else {
        setError('Failed to load email template');
        return { success: false };
      }
    } catch (err) {
      console.error('Error fetching email template:', err);
      setError('Error loading email template');
      return { success: false };
    }
  };

  const handleEmailSend = async (emailData: any) => {
    try {
      console.log('Sending email with data:', emailData);

      const response = await clientAxios.post('/accountant/send-to-client', {
        clientId: taxReturn?.client?.id,
        emailData: {
          subject: emailData.subject,
          message: emailData.htmlContent,
          htmlContent: emailData.htmlContent,
          documentList: emailData.documentList || '',
          taxReturnId: taxReturnId,
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

        await fetchChatData();
      } else {
        setError('Failed to send email');
      }
    } catch (err) {
      console.error('Error sending email:', err);
      setError('Error sending email');
    }
  };

  const fetchChatData = async () => {
    setChatLoading(true);
    try {
      const response = await clientAxios.post(`/accountant/communication-log/${taxReturnId}`, {
        page: 1,
        limit: 50
      });

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
  const fetchReviewData = async () => {
    try {
      const response = await clientAxios.post(`/accountant/get-review/${taxReturnId}`);
      console.log(response.data.data, "response==>")
      if (response.data.success) {
        setReviews(response.data.data); // Set the array of reviews
      }
    } catch (err) {
      console.error('Error fetching review data:', err);
    }
  }
  const fetchProgressData = async () => {
    try {
      const response = await clientAxios.post(`/tax-return/${taxReturnId}/progress`);
      if (response.data.success) {
        setProgressData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching progress:', err);
    }
  };

  const handleStatusUpdate = (newStatus: string | undefined) => {
    if (!newStatus || !progressData?.meta?.canUpdate || loading) return;
    console.log(newStatus, "newStatusnewStatus")
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

  const postProgressData = (newStatus: string) => {
    if (!taxReturnId) return;
    clientAxios.post(`/accountant/tax-return/${encodeURIComponent(String(taxReturnId))}/progress`, {
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



  const handleReviewResponse = (review: any) => {
    setSelectedReview(review);
    setReviewResponse(review.response || '');
    setShowReviewModal(true);
  };

  // Helper function to format email date
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


  const fetchNotifications = async () => {
    try {
      const response = await clientAxios.post(`/tax-returns/${taxReturnId}/notifications`, {
        params: {
          page: 1,
          limit: 20,
          unreadOnly: false
        }
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
  const markAllNotificationsAsRead = async () => {
    try {
      const response = await clientAxios.patch(`/tax-returns/${taxReturnId}/notifications/read-all`);

      if (response.data.success) {
        // Update local state to mark all as read
        setNotifications(prev =>
          prev.map(notification => ({ ...notification, read: true }))
        );
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };
  const markNotificationAsRead = async (notificationId: number) => {
    try {
      const response = await clientAxios.patch(`/notifications/${notificationId}/read`);

      if (response.data.success) {
        // Update local state to reflect the change
        setNotifications(prev =>
          prev.map(notification =>
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
  useEffect(() => {
    fetchTaxReturnData();
    fetchProgressData();
    fetchEmailTemplate();
    fetchChatData();
    fetchReviewData();
    fetchNotifications();
  }, [taxReturnId]);

  const fetchTaxReturnData = async () => {
    setLoading(true);
    try {
      const response = await clientAxios.post(`/accountant/tax-return/files/${taxReturnId}`, {});

      if (response.data.success) {
        console.log(response?.data?.data.taxReturn);
        setTaxReturn(response.data.data.taxReturn);
        console.log(response?.data, "response.data.data.files");
        setFiles(response?.data.data.files);
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

  const handleSubmitResponse = () => {
    console.log('Submitting response:', reviewResponse);
    setShowReviewModal(false);
    setNotifications(prev => [{
      id: Date.now(),
      type: 'review',
      message: 'Response submitted to client review',
      time: 'Just now',
      read: false
    }, ...prev]);
  };

  const handleFlagForAdmin = (flagData: any) => {
    setShowAlertModal(false);
    setNotifications(prev => [{
      id: Date.now(),
      type: 'admin_flag',
      message: flagData.message || 'Issue flagged for admin review',
      time: 'Just now',
      read: false
    }, ...prev]);
  };

  const handleDocumentRequest = (requestData: any) => {
    setShowRequestDocModal(false);
    setNotifications(prev => [{
      id: Date.now(),
      type: 'document_request',
      message: requestData.message || 'Document request sent to client',
      time: 'Just now',
      read: false
    }, ...prev]);

    fetchTaxReturnData();
    fetchProgressData();
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <span key={index} className={`text-lg ${index < rating ? 'text-yellow-400' : 'text-gray-300'}`}>
        ★
      </span>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Tax Return Management
              </h1>
            </div>
            <BellButton notifications={notifications} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Client Info & Status */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Client-{taxReturn?.client?.id?.toString().padStart(4, '0') || 'XXXX'}
                </h2>
                <p className="text-gray-600">Tax Return ID: {taxReturn?.taxReturnId}</p>
                <p className="text-gray-600">Tax Year: {taxReturn?.taxYear}</p>
                <p className="text-gray-600">Type: {taxReturn?.type?.typeName}</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  <span>Email Client</span>
                </button>

                <button
                  onClick={() => setShowRequestDocModal(true)}
                  className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>Request Documents</span>
                </button>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Draft</span>
                </button>

                <button
                  onClick={() => setShowAlertModal(true)}
                  className="flex items-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Flag className="h-4 w-4" />
                  <span>Flag for Admin</span>
                </button>
              </div>
            </div>

            {/* Horizontal Progress Bar */}
            <HorizontalProgressBar progressData={progressData} loading={loading} handleStatusUpdate={handleStatusUpdate} />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="border-b border-gray-200 min-w-max">
              <nav className="-mb-px flex space-x-4 sm:space-x-8 px-4 sm:px-6">
              {['overview', 'documents', 'communication', 'notifications', 'reviews'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm capitalize whitespace-nowrap flex-shrink-0 ${activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {tab}
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
                    <p className="text-2xl font-bold text-blue-900">{files?.totalFiles}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-600">Total Size</h3>
                    <p className="text-2xl font-bold text-green-900">{formatFileSize(files?.totalSize ?? 0)}</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-amber-600">Categories</h3>
                    <p className="text-2xl font-bold text-amber-900">{files?.categories ? Object.keys(files.categories).length : 0}</p>
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
              </div>
            )}

            {activeTab === 'documents' && (
              <div>
             

                {files && taxReturn && taxReturn.client && (
                  <UploadedFilesDetails
                    taxReturn={{
                      ...taxReturn,
                      status: taxReturn.status ?? '',
                      type: taxReturn.type ?? { typeName: '' },
                      taxYear: typeof taxReturn.taxYear === 'string' ? parseInt(taxReturn.taxYear, 10) : taxReturn.taxYear,
                      client: {
                        ...taxReturn.client,
                        id: taxReturn.client?.id !== undefined && taxReturn.client?.id !== null ? String(taxReturn.client.id) : '',
                        surname: taxReturn.client?.surname ?? '',
                        name: taxReturn.client?.name ?? '',
                        email: taxReturn.client?.email ?? '',
                        phone: taxReturn.client?.phone ?? ''
                      }
                    }}
                    files={files}
                  />
                )}
              </div>
            )}

            {/*  Communication Tab */}
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
                    {chatHistory.map((email: any, index: number) => {
                      const currentUserId = userData.id;
                      console.log("email=> ", email)
                      const isSentByCurrentUser = email.senderId == currentUserId;
                      console.log(isSentByCurrentUser, email, currentUserId, userData, "isSentByCurrentUser");
                      // Determine sender name and role
                      let senderName = 'Unknown';
                      let senderRole = '';

                      if (isSentByCurrentUser) {
                        senderName = 'You';
                      } else {
                        // Message sent by someone else
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
                            ? 'bg-blue-500 text-white'  // Current user's messages: blue
                            : senderRole === 'ADMIN'
                              ? 'bg-purple-100 border border-purple-200 text-purple-900'  // Admin messages: purple
                              : 'bg-white border border-gray-200 text-gray-900'  // Other messages: white
                            }`}>
                            {/* Message bubble header */}
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

                            {/* Main message content */}
                            <div className="space-y-2">
                              {/* Subject if different from default */}
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

                              {/* Message text */}
                              {email.parsedEmailData?.messageText && (
                                <div className="text-sm leading-relaxed">
                                  {email.parsedEmailData.messageText}
                                </div>
                              )}

                              {/* Document requirements (if any) */}
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

                            {/* Status indicator and sender info */}
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
                                {email.status === 'sent' && (isSentByCurrentUser ? '✓ Sent' : '✓ Received')}
                                {email.status === 'delivered' && '✓✓ Delivered'}
                                {email.status === 'failed' && '✗ Failed'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add spacing at bottom for better UX */}
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
                    {notifications.some(n => !n.read) && (
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
                              <p className={`text-sm ${!notification.read
                                  ? 'font-medium text-gray-900'
                                  : 'text-gray-700'
                                }`}>
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
                                  // Handle navigation to the notification URL
                                  // You can use your router to navigate to notification.url
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
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Client Reviews</h3>

                  {!reviews || reviews.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-star text-4xl mx-auto mb-4 text-gray-300"></i>
                      <p>No reviews found for this tax return.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review: any) => (
                        <div key={review.id} className="bg-white border rounded-lg p-6">
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

                         
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Response Modal */}
      {showReviewModal && selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedReview.responded ? 'Edit Response' : 'Respond to Review'}
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">Client-{selectedReview.id.toString().padStart(4, '0')}</h4>
                  <div className="flex">{renderStars(selectedReview.rating)}</div>
                </div>
                <p className="text-gray-700 mb-2">{selectedReview.comment}</p>
                <p className="text-sm text-gray-500">
                  Tax Return: {selectedReview?.taxReturnId} • {new Date(selectedReview.date).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Response</label>
                  <textarea
                    value={reviewResponse}
                    onChange={(e) => setReviewResponse(e.target.value)}
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Write a professional response to address the client's feedback..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitResponse}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
                >
                  <Send className="h-4 w-4" />
                  <span>{selectedReview.responded ? 'Update Response' : 'Submit Response'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleEmailSend}
        taxReturn={taxReturn ? { ...taxReturn, taxYear: String(taxReturn.taxYear), client: { ...(taxReturn.client ?? {}), id: Number(taxReturn.client?.id ?? 0), name: taxReturn.client?.name ?? '', email: taxReturn.client?.email ?? '' } } : null}
        fetchEmailTemplate={fetchEmailTemplate}
      />
      <FlagModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        taxReturnId={taxReturnId ? String(taxReturnId) : ''}
        onFlagSuccess={handleFlagForAdmin}
        clientAxios={clientAxios}
      />

      <RequestDocumentsModal
        isOpen={showRequestDocModal}
        onClose={() => setShowRequestDocModal(false)}
        taxReturnId={taxReturnId ? String(taxReturnId) : ''}
        onRequestSuccess={handleDocumentRequest}
        clientAxios={clientAxios}
      />

      {/* Upload Draft Modal */}
      {showUploadModal && (
        <DraftUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          taxReturnId={taxReturnId ? String(taxReturnId) : ''}
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
          taxReturnId={taxReturnId ? String(taxReturnId) : ''}
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

export default TaxReturnManagement;