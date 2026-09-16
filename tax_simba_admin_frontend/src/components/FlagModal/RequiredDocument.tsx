import React, { useState } from 'react';
import { FileText, X, Plus, Trash2, AlertCircle, Calendar } from 'lucide-react';

interface RequestDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxReturnId: string;
  onRequestSuccess: (data: any) => void;
  clientAxios: any;
}

type DocumentCategory = 
  | 'employment_income'
  | 'rental_income'
  | 'capital_gains'
  | 'foreign_income'
  | 'deductions_reliefs'
  | 'additional_info';

interface RequiredDocument {
  documentType: string;
  documentCategory: DocumentCategory;
  description?: string;
}

const RequestDocumentsModal = ({ 
  isOpen, 
  onClose, 
  taxReturnId, 
  onRequestSuccess,
  clientAxios
}: RequestDocumentsModalProps) => {
  const [requiredDocuments, setRequiredDocuments] = useState<RequiredDocument[]>([
    { documentType: '', documentCategory: 'additional_info', description: '' }
  ]);
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const documentCategories = [
    { value: 'basic_details', label: 'Basic Details' },
    { value: 'address_proof', label: 'Address Proof' },
    { value: 'employment_income', label: 'Employment Income' },
    { value: 'rental_income', label: 'Rental Income' },
    { value: 'capital_gains', label: 'Capital Gains' },
    { value: 'foreign_income', label: 'Foreign Income' },
    { value: 'other_income', label: 'Other Income' },
    { value: 'deductions_reliefs', label: 'Deductions & Reliefs' },
    { value: 'residency_remittance', label: 'Residency & Remittance' },
    { value: 'student_loan', label: 'Student Loan' },
    { value: 'additional_info', label: 'Additional Information' }
  ];

  const commonDocuments = {
    'employment_income': [
      'P60 - End of year certificate',
      'P45 - Details of employee leaving work',
      'Payslips (latest 3 months)',
      'Employment contract',
      'Bonus/commission statements'
    ],
    'rental_income': [
      'Rental income statements',
      'Property expenses receipts',
      'Mortgage interest certificates',
      'Letting agent statements',
      'Property insurance documents'
    ],
    'capital_gains': [
      'Share dealing statements',
      'Property sale/purchase contracts',
      'Improvement costs receipts',
      'Legal fees documentation',
      'Asset disposal records'
    ],
    'foreign_income': [
      'Foreign income certificates',
      'Bank statements (foreign accounts)',
      'Tax paid abroad certificates',
      'Currency exchange records',
      'Foreign employment contracts'
    ],
    'deductions_reliefs': [
      'Charitable donation receipts',
      'Professional subscriptions',
      'Work from home expenses',
      'Training course certificates',
      'Medical expenses receipts'
    ],
    'additional_info': [
      'Bank statements',
      'Dividend vouchers',
      'Interest certificates',
      'Pension statements',
      'Other financial documents'
    ] 
  }; 

  const resetForm = () => {
    setRequiredDocuments([{ documentType: '', documentCategory: 'additional_info', description: '' }]);
    setMessage('');
    setPriority('medium');
    setDeadline('');
    setSubmitting(false);
    setError('');
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  const addDocument = () => {
    setRequiredDocuments([
      ...requiredDocuments,
      { documentType: '', documentCategory: 'additional_info', description: '' }
    ]);
  };

  const removeDocument = (index: number) => {
    if (requiredDocuments.length > 1) {
      setRequiredDocuments(requiredDocuments.filter((_, i) => i !== index));
    }
  };

  const updateDocument = (index: number, field: keyof RequiredDocument, value: string) => {
    const updated = requiredDocuments.map((doc, i) => 
      i === index ? { ...doc, [field]: value } : doc
    );
    setRequiredDocuments(updated);
  };

  const selectCommonDocument = (index: number, documentType: string) => {
    updateDocument(index, 'documentType', documentType);
  };

  const handleSubmit = async () => {
    setError('');

    // Validation
    const validDocuments = requiredDocuments.filter(doc => doc.documentType.trim());
    
    if (validDocuments.length === 0) {
      setError('Please specify at least one document type');
      return;
    }

    if (!message.trim()) {
      setError('Please provide a message to the client');
      return;
    }

    if (deadline) {
      const selectedDate = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        setError('Deadline cannot be in the past');
        return;
      }
    }

    setSubmitting(true);

    try {
      const requestData = {
        requiredDocuments: validDocuments.map(doc => ({
          documentType: doc.documentType.trim(),
          documentCategory: doc.documentCategory,
          description: doc.description?.trim() || ''
        })),
        message: message.trim(),
        priority,
        deadline: deadline || null
      };

      const response = await clientAxios.post(
        `/accountant/tax-returns/${taxReturnId}/request-documents`,
        requestData
      );

      if (response.data.success) {
        onRequestSuccess({
          message: 'Document request sent to client successfully',
          documentsRequested: validDocuments.length,
          priority
        });
        handleClose();
      } else {
        setError(response.data.message || 'Failed to send document request');
        setSubmitting(false);
      }
    } catch (err: any) {
      console.error('Document request error:', err);
      setError(
        err?.response?.data?.message || 
        'Failed to send document request. Please try again.'
      );
      setSubmitting(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Request Additional Documents</h3>
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

          <div className="space-y-6">
            {/* Required Documents */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Required Documents <span className="text-red-500">*</span>
                </label>
                <button
                  onClick={addDocument}
                  disabled={submitting}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Document</span>
                </button>
              </div>

              {requiredDocuments.map((doc, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-3">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-medium text-gray-800">Document {index + 1}</h4>
                    {requiredDocuments.length > 1 && (
                      <button
                        onClick={() => removeDocument(index)}
                        disabled={submitting}
                        className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Document Category */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={doc.documentCategory}
                        onChange={(e) => updateDocument(index, 'documentCategory', e.target.value)}
                        disabled={submitting}
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      >
                        {documentCategories.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Document Type */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Document Type
                      </label>
                  <input
                    type="text"
                    value={doc.documentType}
                    onChange={(e) => updateDocument(index, 'documentType', e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Payslip, Bank Statement"
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  />
                  {commonDocuments[doc.documentCategory as DocumentCategory] && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">Common documents for {documentCategories.find(c => c.value === doc.documentCategory)?.label}:</p>
                      <div className="flex flex-wrap gap-1">
                        {commonDocuments[doc.documentCategory as DocumentCategory].map((commonDoc: string) => (
                          <button
                            key={commonDoc}
                            onClick={() => selectCommonDocument(index, commonDoc)}
                            disabled={submitting}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-800 transition-colors disabled:opacity-50"
                          >
                            {commonDoc}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={doc.description || ''}
                      onChange={(e) => updateDocument(index, 'description', e.target.value)}
                      disabled={submitting}
                      rows={2}
                      placeholder="Any specific requirements or notes about this document..."
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              
            </div>

            {/* Message to Client */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message to Client <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={submitting}
                rows={4}
                placeholder="Explain why these documents are needed and any specific instructions..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Priority and Deadline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={submitting}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={submitting}
                  min={getMinDate()}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
              <div className="flex items-start space-x-2">
                <FileText className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium mb-1">Document Request Process</p>
                  <p>The client will receive an email notification with the list of required documents. They can upload the documents through their client portal. You'll be notified when documents are uploaded.</p>
                </div>
              </div>
            </div>
          </div>))}

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
              disabled={submitting || !message.trim() || !requiredDocuments.some(doc => doc.documentType.trim())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4" />
              <span>
                {submitting ? 'Sending Request...' : 'Send Document Request'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
     </div>
      </div>
  );
};

export default RequestDocumentsModal;