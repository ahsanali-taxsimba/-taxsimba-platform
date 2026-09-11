import React, { useState, useEffect } from 'react';
import { AlertCircle, Flag, Clock, CheckCircle, X, Eye, Calendar, User } from 'lucide-react';

interface AdminFlag {
  id: number;
  title: string;
  description: string;
  issueType: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  taxReturn: {
    id: number;
    taxReturnId: string;
    taxYear: number;
    status: string;
  };
  client: {
    id: number;
    name: string;
    email: string;
  };
  accountant: {
    id: number;
    name: string;
    email: string;
  };
  flaggedBy: {
    id: number;
    name: string;
    email: string;
  };
  resolvedBy?: {
    id: number;
    name: string;
    email: string;
  };
}

interface AdminFlagsProps {
  taxReturnId: string;
  clientAxios: any;
}

const AdminFlags: React.FC<AdminFlagsProps> = ({ taxReturnId, clientAxios }) => {
  const [flags, setFlags] = useState<AdminFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<AdminFlag | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveAction, setResolveAction] = useState<'resolved' | 'dismissed'>('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  useEffect(() => {
    fetchFlags();
  }, [taxReturnId]);

  const fetchFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientAxios.post('/admin/get-flag-data', {
        taxReturnId: parseInt(taxReturnId),
        page: 1,
        limit: 50
      });

      if (response.data.success) {
        setFlags(response.data.data.flags || []);
      } else {
        setError('Failed to load flags data');
      }
    } catch (err) {
      console.error('Error fetching flags:', err);
      setError('Error fetching flags data');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveFlag = async () => {
    if (!selectedFlag) return;

    setResolving(true);
    try {
      const response = await clientAxios.post(`/admin/resolve-flag/${selectedFlag.id}`, {
        status: resolveAction,
        resolutionNotes: resolutionNotes.trim() || null
      });

      if (response.data.success) {
        // Refresh flags list
        await fetchFlags();
        setShowResolveModal(false);
        setSelectedFlag(null);
        setResolutionNotes('');
      } else {
        setError(response.data.message || `Failed to ${resolveAction} flag`);
      }
    } catch (err) {
      console.error(`Error ${resolveAction} flag:`, err);
      setError(`Error ${resolveAction} flag. Please try again.`);
    } finally {
      setResolving(false);
    }
  };

  const openResolveModal = (flag: AdminFlag, action: 'resolved' | 'dismissed') => {
    setSelectedFlag(flag);
    setResolveAction(action);
    setResolutionNotes('');
    setShowResolveModal(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_review': return 'bg-purple-100 text-purple-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getIssueTypeIcon = (issueType: string) => {
    switch (issueType.toLowerCase()) {
      case 'missing_documents': return '📋';
      case 'suspicious_data': return '🚨';
      case 'client_communication_issue': return '💬';
      case 'technical_problem': return '⚙️';
      default: return '❓';
    }
  };

  const formatIssueType = (issueType: string) => {
    return issueType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter flags based on status and priority
  const filteredFlags = flags.filter(flag => {
    const statusMatch = filterStatus === 'all' || flag.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || flag.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchFlags}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Admin Flags</h3>
          <p className="text-sm text-gray-600">
            Issues flagged by accountants for this tax return
          </p>
        </div>
        <button
          onClick={fetchFlags}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      {flags.length > 0 && (
        <div className="flex space-x-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      )}

      {/* Flags List */}
      {filteredFlags.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Flag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No flags found for this tax return.</p>
          <p className="text-sm">Accountants can flag issues that require administrative attention.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFlags.map((flag) => (
            <div
              key={flag.id}
              className={`border rounded-lg p-4 ${
                flag.status === 'open' ? 'border-blue-200 bg-blue-50' : 
                flag.status === 'resolved' ? 'border-green-200 bg-green-50' :
                flag.status === 'dismissed' ? 'border-gray-200 bg-gray-50' :
                'border-gray-200'
              }`}
            >
              {/* Flag Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">
                    {getIssueTypeIcon(flag.issueType)}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {flag.title}
                    </h4>
                    <div className="flex items-center space-x-3 text-sm text-gray-600 mb-2">
                      <span className="flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>{flag.flaggedBy.name}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(flag.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(flag.priority)}`}>
                    {flag.priority.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(flag.status)}`}>
                    {flag.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Issue Type and Description */}
              <div className="mb-3">
                <div className="text-sm text-gray-600 mb-1">
                  <strong>Issue Type:</strong> {formatIssueType(flag.issueType)}
                </div>
                <div className="text-sm text-gray-700 bg-white p-3 rounded border">
                  {flag.description}
                </div>
              </div>

              {/* Resolution Notes (if resolved/dismissed) */}
              {(flag.status === 'resolved' || flag.status === 'dismissed') && flag.resolutionNotes && (
                <div className="mb-3 p-3 bg-white rounded border">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Resolution Notes:
                  </div>
                  <div className="text-sm text-gray-600">
                    {flag.resolutionNotes}
                  </div>
                  {flag.resolvedBy && flag.resolvedAt && (
                    <div className="text-xs text-gray-500 mt-2">
                      Resolved by {flag.resolvedBy.name} on {formatDate(flag.resolvedAt)}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {flag.status === 'open' && (
                <div className="flex space-x-2 pt-3 border-t">
                  <button
                    onClick={() => openResolveModal(flag, 'resolved')}
                    className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                  >
                    <CheckCircle className="h-3 w-3" />
                    <span>Resolve</span>
                  </button>
                  <button
                    onClick={() => openResolveModal(flag, 'dismissed')}
                    className="flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
                  >
                    <X className="h-3 w-3" />
                    <span>Dismiss</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedFlag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                {resolveAction === 'resolved' ? (
                  <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
                ) : (
                  <X className="h-6 w-6 text-gray-500 mr-3" />
                )}
                <h3 className="text-lg font-medium text-gray-900">
                  {resolveAction === 'resolved' ? 'Resolve Flag' : 'Dismiss Flag'}
                </h3>
              </div>

              {/* Flag Details */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-sm">
                  <strong>{selectedFlag.title}</strong>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {formatIssueType(selectedFlag.issueType)} • {selectedFlag.priority.toUpperCase()} Priority
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Flagged by {selectedFlag.flaggedBy.name}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolution Notes {resolveAction === 'resolved' ? '(Optional)' : '(Required)'}
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={
                      resolveAction === 'resolved'
                        ? "Describe what action was taken to resolve this issue..."
                        : "Explain why this flag is being dismissed..."
                    }
                  />
                </div>

                <div className={`p-3 rounded-lg border ${
                  resolveAction === 'resolved' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <p className="text-xs text-gray-700">
                    {resolveAction === 'resolved'
                      ? 'This will mark the flag as resolved and notify the accountant that the issue has been addressed.'
                      : 'This will dismiss the flag without taking action. The accountant will be notified that the flag was dismissed.'
                    }
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowResolveModal(false)}
                  disabled={resolving}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolveFlag}
                  disabled={resolving || (resolveAction === 'dismissed' && !resolutionNotes.trim())}
                  className={`px-4 py-2 text-white rounded-lg flex items-center space-x-2 disabled:opacity-50 ${
                    resolveAction === 'resolved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {resolving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      {resolveAction === 'resolved' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      <span>
                        {resolveAction === 'resolved' ? 'Resolve Flag' : 'Dismiss Flag'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFlags;