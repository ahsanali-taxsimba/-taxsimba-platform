'use client';

import React, { useState, useEffect } from 'react';

import {
  Bell,
  Search,
  Filter,
  CheckCheck,
  Clock,
  FileText,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  User,
  Calendar,
  Trash2,
  RefreshCw,
  ChevronDown,
  ArrowLeft,
  ExternalLink,
  Check
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import clientAxios from '@/lib/axios-client';
import { toast } from 'react-toastify';
import { isAdminRole } from '@/lib/roles';


interface NotificationUser {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'CLIENT';
}

interface TaxReturn {
  id: number;
  taxReturnId: string;
}

interface Notification {
  id: number;
  message: string;
  url?: string;
  read: boolean;
  readAt?: string;
  time: string;
  createdAt: string;
  type: 'document' | 'payment' | 'review' | 'message' | 'deadline' | 'general';
  from: NotificationUser | null;
  to: NotificationUser | null;
  taxReturn: TaxReturn | null;
}

interface NotificationFilters {
  typeCounts: Record<string, number>;
  totalCount: number;
  unreadCount: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  unreadCount: number;
}

// Utility functions for notification types and colors
const getTypeIcon = (type: string) => {
  switch (type) {
    case 'document': return <FileText className="w-5 h-5" />;
    case 'payment': return <CreditCard className="w-5 h-5" />;
    case 'review': return <Check className="w-5 h-5" />;
    case 'message': return <MessageSquare className="w-5 h-5" />;
    case 'deadline': return <AlertTriangle className="w-5 h-5" />;
    default: return <Bell className="w-5 h-5" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'document': return 'text-blue-500 bg-blue-50';
    case 'payment': return 'text-green-500 bg-green-50';
    case 'review': return 'text-purple-500 bg-purple-50';
    case 'message': return 'text-indigo-500 bg-indigo-50';
    case 'deadline': return 'text-red-500 bg-red-50';
    default: return 'text-gray-500 bg-gray-50';
  }
};

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'ADMIN': return 'bg-red-100 text-red-800';
    case 'ACCOUNTANT': return 'bg-blue-100 text-blue-800';
    case 'CLIENT': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const GlobalNotificationsPage: React.FC = () => {
  const { data: session } = useSession(); 
  const userRole = session?.user?.role;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    unreadCount: 0
  });
  const [filters, setFilters] = useState<NotificationFilters>({
    typeCounts: {},
    totalCount: 0,
    unreadCount: 0
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // API functions using the same pattern as your existing code
  const fetchNotifications = async (params: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
    search?: string;
  } = {}) => {
    try {
      setLoading(true);
      
      // Use the same API pattern as your existing code
      const response = await clientAxios.post('/all-notifications', {
        page: params.page || 1,
        limit: params.limit || 20,
        unreadOnly: params.unreadOnly || false,
        type: params.type || '',
        search: params.search || ''
      });

      console.log(response.data, "global notifications response");
      
      if (response.data.success) {
        const data = response.data.data;
        setNotifications(data.notifications);
        setPagination(data.pagination);
        setFilters(data.filters);
      } else {
        console.error('Failed to fetch notifications:', response.data.message);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      const response = await clientAxios.patch(`/notifications/${notificationId}/read`);
      
      if (response.data.success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true, readAt: new Date().toISOString() }
              : notification
          )
        );
        setPagination(prev => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1)
        }));
        setFilters(prev => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1)
        }));
        toast.success(response.data.message || 'Notification marked as read');
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const response = await clientAxios.patch('/notifications/mark-all-read');
      
      if (response.data.success) {
        setNotifications(prev => 
          prev.map(notification => ({ 
            ...notification, 
            read: true, 
            readAt: new Date().toISOString() 
          }))
        );
        setPagination(prev => ({ ...prev, unreadCount: 0 }));
        setFilters(prev => ({ ...prev, unreadCount: 0 }));
        toast.success(response.data.message || 'All notifications marked as read');
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const deleteNotification = async (notificationId: number) => {
    if (userRole !== 'ADMIN') return;
    
    try {
      const response = await clientAxios.delete(`/notifications/${notificationId}`);
      
      if (response.data.success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setPagination(prev => ({ ...prev, total: prev.total - 1 }));
        toast.success(response.data.message || 'Notification deleted successfully');
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      toast.error('Failed to delete notification');
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    if (notification.url) {
      let targetUrl = notification.url;

      // Extract the tax return ID from the notification object if it exists
      // Fallback: Match a number after /tax-returns/ or just a number surrounded by slashes/end of string
      const idMatch = targetUrl.match(/\/tax-returns?\/(\d+)/) || targetUrl.match(/\/(\d+)(?:\/|$)/);
      const taxReturnDbId = notification.taxReturn?.id ? notification.taxReturn.id.toString() : (idMatch ? idMatch[1] : null);

      // Map backend notification URLs to the correct frontend routes based on user role
      if (taxReturnDbId) {
        if (isAdminRole(userRole)) {
          targetUrl = `/manage-tax/${taxReturnDbId}`;
        } else if (userRole === 'ACCOUNTANT') {
          targetUrl = `/tax-return-list/${taxReturnDbId}`;
        }
      }

      // Prepend /admin if the URL doesn't already start with it (and is a relative path)
      if (!targetUrl.startsWith('/admin') && !targetUrl.startsWith('http')) {
        targetUrl = `/admin${targetUrl}`;
      }

      window.location.href = targetUrl;
    }
  };

  // Handle search with debouncing
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Debounce the search
    const timer = setTimeout(() => {
      fetchNotifications({
        page: 1,
        search: query,
        type: selectedType,
        unreadOnly: showUnreadOnly
      });
    }, 500);
    
    return () => clearTimeout(timer);
  };

  // Handle filter changes
  const handleFilterChange = (type: string) => {
    const newType = selectedType === type ? '' : type;
    setSelectedType(newType);
    fetchNotifications({
      page: 1,
      type: newType,
      search: searchQuery,
      unreadOnly: showUnreadOnly
    });
  };

  const handleUnreadToggle = () => {
    const newUnreadOnly = !showUnreadOnly;
    setShowUnreadOnly(newUnreadOnly);
    fetchNotifications({
      page: 1,
      unreadOnly: newUnreadOnly,
      type: selectedType,
      search: searchQuery
    });
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    fetchNotifications({
      page,
      type: selectedType,
      search: searchQuery,
      unreadOnly: showUnreadOnly
    });
  };

  // Load notifications on component mount and filter changes
  useEffect(() => {
    fetchNotifications();
  }, []);

  if (loading && notifications.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-gray-600">Loading notifications...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-0 mx-auto max-w-(--breakpoint-2xl)">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-2 lg:p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap lg:flex-nowrap mb-4">
            <div className="flex items-center flex-wrap lg:flex-nowrap space-x-3">
              <button
                onClick={() => window.history.back()}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Bell className="w-6 h-6 text-[#37a267]" />
              <h1 className="text-2xl font-bold text-gray-900">All Notifications</h1>
              {pagination.unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {pagination.unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {userRole && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(userRole)}`}>
                  {userRole}
                </span>
              )}
              <button
                onClick={() => fetchNotifications({
                  page: pagination.page,
                  type: selectedType,
                  search: searchQuery,
                  unreadOnly: showUnreadOnly
                })}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="flex items-center flex-wrap lg:flex-nowrap gap-2 space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
                  showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              {pagination.unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className="flex items-center space-x-2 px-4 py-2 bg-[#37a267] text-white rounded-lg hover:bg-[#37a267] transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark All Read</span>
                </button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={handleUnreadToggle}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      showUnreadOnly
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Unread Only ({filters.unreadCount})
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(filters.typeCounts).map(([type, count]) => (
                    <button
                      key={type}
                      onClick={() => handleFilterChange(type)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedType === type
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {getTypeIcon(type)}
                      <span className="capitalize">{type} ({count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
              <p className="text-gray-500">
                {searchQuery || selectedType || showUnreadOnly
                  ? "No notifications match your current filters."
                  : "You're all caught up! No notifications to show."}
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border transition-all hover:shadow-md cursor-pointer ${
                  !notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="p-2 lg:p-6">
                  <div className="flex items-start space-x-4 flex-wrap  gap-3">
                    {/* Notification Icon */}
                    <div className={`flex-shrink-0 p-2 rounded-lg ${getTypeColor(notification.type)}`}>
                      {getTypeIcon(notification.type)}
                    </div>

                    {/* Notification Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                          <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${getTypeColor(notification.type)}`}>
                            {notification.type}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {notification.time}
                          </span>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center space-x-2">
                          {notification.read && (
                            <Check className="w-4 h-4 text-green-500"
                            //  title="Read" 
                             />
                          )}
                          {/* P0 M4: notification DELETE deferred (405) — hide trash control */}
                          {notification.url && (
                            <ExternalLink className="w-4 h-4 text-gray-400" 
                            // title="Has link" 
                            />
                          )}
                        </div>
                      </div>

                      {/* Message */}
                      <p className={`text-sm mb-3 ${!notification.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>

                      {/* Metadata */}
                      <div className="flex items-center justify-between text-xs text-gray-500 flex-wrap lg:flex-nowrap gap-2">
                        <div className="flex items-center space-x-4 flex-wrap lg:flex-nowrap gap-2">
                          {notification.from && (
                            <div className="flex items-center space-x-1">
                              <User className="w-3 h-3" />
                              <span>From: {notification.from.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${getRoleBadgeColor(notification.from.role)}`}>
                                {notification.from.role}
                              </span>
                            </div>
                          )}
                          {notification.taxReturn && (
                            <div className="flex items-center space-x-1">
                              <FileText className="w-3 h-3" />
                              <span>Tax Return: {notification.taxReturn.taxReturnId}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(notification.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} notifications
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pagination.page <= 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const page = i + 1;
                    const isActive = page === pagination.page;
                    
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  {pagination.pages > 5 && (
                    <>
                      {pagination.pages > 6 && <span className="text-gray-500">...</span>}
                      <button
                        onClick={() => handlePageChange(pagination.pages)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          pagination.pages === pagination.page
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pagination.pages}
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pagination.page >= pagination.pages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalNotificationsPage;