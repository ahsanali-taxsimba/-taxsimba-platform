import React, { useState } from 'react';
import { Flag, X, AlertCircle } from 'lucide-react';

interface FlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxReturnId: string;
  onFlagSuccess: (data: any) => void;
  clientAxios: any;
}

const FlagModal = ({ 
  isOpen, 
  onClose, 
  taxReturnId, 
  onFlagSuccess,
  clientAxios
}: FlagModalProps) => {
  const [issueType, setIssueType] = useState('missing_documents');
  const [priority, setPriority] = useState('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const issueTypes = [
    { value: 'missing_documents', label: 'Missing Documents' },
    { value: 'suspicious_data', label: 'Suspicious Data' },
    { value: 'client_communication_issue', label: 'Client Communication Issue' },
    { value: 'technical_problem', label: 'Technical Problem' },
    { value: 'other', label: 'Other' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'text-gray-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'high', label: 'High', color: 'text-orange-600' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600' }
  ];

  const resetForm = () => {
    setIssueType('missing_documents');
    setPriority('medium');
    setTitle('');
    setDescription('');
    setSubmitting(false);
    setError('');
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async () => {
    setError('');

    // Validation
    if (!title.trim()) {
      setError('Please provide a title for the issue');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description of the issue');
      return;
    }

    if (title.length < 10) {
      setError('Title must be at least 10 characters long');
      return;
    }

    if (description.length < 20) {
      setError('Description must be at least 20 characters long');
      return;
    }

    setSubmitting(true);

    try {
      const response = await clientAxios.post(
        `/accountant/flag-issue/${taxReturnId}`,
        {
          issueType,
          priority,
          title: title.trim(),
          description: description.trim()
        }
      );

      if (response.data.success) {
        onFlagSuccess({
          message: 'Issue flagged for admin review successfully',
          flagId: response.data.data.flag.id,
          priority,
          issueType
        });
        handleClose();
      } else {
        setError(response.data.message || 'Failed to flag issue');
        setSubmitting(false);
      }
    } catch (err: any) {
      console.error('Flag submission error:', err);
      setError(
        err?.response?.data?.message || 
        'Failed to submit flag. Please try again.'
      );
      setSubmitting(false);
    }
  };

  // Define a type for valid issue types
  type IssueType = 'missing_documents' | 'suspicious_data' | 'client_communication_issue' | 'technical_problem' | 'other';

  // Auto-generate title suggestions based on issue type
  const getTitleSuggestion = (type: IssueType) => {
    const suggestions: Record<IssueType, string> = {
      'missing_documents': 'Missing required documents',
      'suspicious_data': 'Suspicious data requires review',
      'client_communication_issue': 'Client communication problem',
      'technical_problem': 'Technical issue encountered',
      'other': 'Issue requires admin attention'
    };
    return suggestions[type] || '';
  };

  const handleIssueTypeChange = (newType: string) => {
    setIssueType(newType);
    if (!title.trim() || title === getTitleSuggestion(issueType as IssueType)) {
      setTitle(getTitleSuggestion(newType as IssueType));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Flag Issue for Admin</h3>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Issue Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Type <span className="text-red-500">*</span>
              </label>
              <select 
                value={issueType}
                onChange={(e) => handleIssueTypeChange(e.target.value)}
                disabled={submitting}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {issueTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={submitting}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {priorities.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Selected priority: <span className={priorities.find(p => p.value === priority)?.color}>
                  {priorities.find(p => p.value === priority)?.label}
                </span>
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                maxLength={255}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Brief summary of the issue..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {title.length}/255 characters {title.length < 10 && title.length > 0 && '(minimum 10)'}
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                disabled={submitting}
                maxLength={2000}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Provide detailed information about the issue. Include any relevant context, what you've tried, and what outcome you expect..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {description.length}/2000 characters {description.length < 20 && description.length > 0 && '(minimum 20)'}
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium mb-1">This will notify all administrators</p>
                  <p>Admin team will review this issue and respond accordingly. You'll receive a notification when the issue is resolved.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !description.trim() || title.length < 10 || description.length < 20}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Flag className="h-4 w-4" />
              <span>
                {submitting ? 'Flagging...' : 'Flag for Admin'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlagModal;