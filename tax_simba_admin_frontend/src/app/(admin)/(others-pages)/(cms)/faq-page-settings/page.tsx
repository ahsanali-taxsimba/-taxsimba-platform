"use client";

import clientAxios from '@/lib/axios-client';
import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import ConfirmationModal from '@/components/ConfirmationModal';


interface Faq {
  id: number;
  question: string;
  answer: string;
  status: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PaginationData {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}



const FaqManagement: React.FC = () => {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    pageSize: 10
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<Faq | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    question: '',
    answer: ''
  });

  // Fetch FAQs
  const fetchFaqs = async (page = 1, search = '') => {
    try {
      setLoading(true);
      setError(null);

      const response = await clientAxios.post('/admin/faqs', {
        search: search || searchTerm,
        page,
        limit: pagination.pageSize,
        sortBy,
        sortOrder
      });

      if (response.data?.success) {
        setFaqs(response.data.data.faqs || []);
        setPagination(response.data.data.pagination);
      }
    } catch (err: any) {
      console.error('Error fetching FAQs:', err);
      setError(err.response?.data?.message || 'Failed to fetch FAQs');
    } finally {
      setLoading(false);
    }
  };

  // Create FAQ
  const handleCreateFaq = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!formData.question.trim() || !formData.answer.trim()) {
        setError('Please fill in all required fields');
        return;
      }

      const response = await clientAxios.post('/admin/faqs/create', formData);

      if (response.data?.success) {
        setShowCreateModal(false);
        setFormData({ question: '', answer: '' });
        await fetchFaqs(pagination.currentPage);
      }
    } catch (err: any) {
      console.error('Error creating FAQ:', err);
      setError(err.response?.data?.message || 'Failed to create FAQ');
    } finally {
      setSaving(false);
    }
  };

  // Update FAQ
  const handleUpdateFaq = async () => {
    if (!selectedFaq) return;

    try {
      setSaving(true);
      setError(null);

      if (!formData.question.trim() || !formData.answer.trim()) {
        setError('Please fill in all required fields');
        return;
      }

      const response = await clientAxios.put(`/admin/faqs/update/${selectedFaq.id}`, {
        ...formData,
        status: selectedFaq.status
      });

      if (response.data?.success) {
        setShowEditModal(false);
        setSelectedFaq(null);
        setFormData({ question: '', answer: '' });
        await fetchFaqs(pagination.currentPage);
      }
    } catch (err: any) {
      console.error('Error updating FAQ:', err);
      setError(err.response?.data?.message || 'Failed to update FAQ');
    } finally {
      setSaving(false);
    }
  };

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [faqToDelete, setFaqToDelete] = useState<number | null>(null);

  // Delete FAQ
  const handleDeleteFaq = (faqId: number) => {
    setFaqToDelete(faqId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteFaq = async () => {
    if (faqToDelete === null) return;

    try {
      setSaving(true);
      setError(null);

      const response = await clientAxios.delete(`/admin/faqs/delete/${faqToDelete}`);

      if (response.data?.success) {
        await fetchFaqs(pagination.currentPage);
      }
    } catch (err: any) {
      console.error('Error deleting FAQ:', err);
      setError(err.response?.data?.message || 'Failed to delete FAQ');
    } finally {
      setSaving(false);
      setDeleteModalOpen(false);
      setFaqToDelete(null);
    }
  };

  // Toggle FAQ status
  const handleToggleStatus = async (faqId: number, currentStatus: boolean) => {
    try {
      setSaving(true);
      setError(null);

      const response = await clientAxios.put(`/admin/faqs/${faqId}/status`, {
        status: !currentStatus
      });

      if (response.data?.success) {
        await fetchFaqs(pagination.currentPage);
      }
    } catch (err: any) {
      console.error('Error updating FAQ status:', err);
      setError(err.response?.data?.message || 'Failed to update FAQ status');
    } finally {
      setSaving(false);
    }
  };

  // Handle search
  const handleSearch = () => {
    fetchFaqs(1, searchTerm);
  };

  // Handle edit modal
  const openEditModal = (faq: Faq) => {
    setSelectedFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer
    });
    setShowEditModal(true);
  };

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  // Close modals
  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedFaq(null);
    setFormData({ question: '', answer: '' });
    setError(null);
  };

  useEffect(() => {
    fetchFaqs();
  }, [sortBy, sortOrder]);

  if (loading && faqs.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">FAQ Management</h1>
          <p className="mt-2 text-sm text-gray-600 mb-0">
            Manage frequently asked questions for your website
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#37a267] hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267]"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add New FAQ
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search FAQs
            </label>
            <div className="flex">
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search questions, answers, or status..."
                className="flex-1 rounded-l-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-r-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="createdAt">Created Date</option>
              <option value="question">Question</option>
              <option value="status">Status</option>
            </select>
          </div>

          <div>
            <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-1">
              Order
            </label>
            <select
              id="sortOrder"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="DESC">Newest First</option>
              <option value="ASC">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* FAQ List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-0">
            FAQs ({pagination.totalItems})
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {faqs.length > 0 ? (
            faqs.map((faq) => (
              <div key={faq.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {faq.question}
                      </h3>
                      <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${faq.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {faq.status ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3 line-clamp-3">{faq.answer}</p>
                    {faq.createdAt && (
                      <p className="text-sm text-gray-500">
                        Created: {new Date(faq.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="ml-6 flex items-center space-x-2">
                    <button
                      onClick={() => openEditModal(faq)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Edit FAQ"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(faq.id, faq.status)}
                      disabled={saving}
                      className={`p-2 rounded-md ${faq.status
                          ? 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                      title={faq.status ? 'Deactivate FAQ' : 'Activate FAQ'}
                    >
                      {faq.status ? (
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteFaq(faq.id)}
                      disabled={saving}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete FAQ"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No FAQs found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first FAQ.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex-wrap gap-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-gray-700">
                Showing {Math.min((pagination.currentPage - 1) * pagination.pageSize + 1, pagination.totalItems)} to{' '}
                {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of{' '}
                {pagination.totalItems} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => fetchFaqs(pagination.currentPage - 1)}
                  disabled={pagination.currentPage <= 1 || loading}
                  className="px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchFaqs(pagination.currentPage + 1)}
                  disabled={pagination.currentPage >= pagination.totalPages || loading}
                  className="px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create FAQ Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeModals}
        className="max-w-lg"
      >
        <div className="bg-white px-4 pt-4 pb-4 sm:p-6 sm:pb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Create New FAQ
          </h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="create-question" className="block text-sm font-medium text-gray-700 mb-1">
                Question <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="create-question"
                value={formData.question}
                onChange={(e) => handleInputChange('question', e.target.value)}
                placeholder="Enter your question..."
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="create-answer" className="block text-sm font-medium text-gray-700 mb-1">
                Answer <span className="text-danger">*</span>
              </label>
              <textarea
                id="create-answer"
                rows={4}
                value={formData.answer}
                onChange={(e) => handleInputChange('answer', e.target.value)}
                placeholder="Enter your answer..."
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse align-center">
          <button
            type="button"
            onClick={handleCreateFaq}
            disabled={saving || !formData.question.trim() || !formData.answer.trim()}
            className="w-full inline-flex align-center justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#37a267] text-base font-medium text-white hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267] sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create FAQ'}
          </button>
          <button
            type="button"
            onClick={closeModals}
            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </Modal>


      {/* Edit FAQ Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={closeModals}
        className="max-w-lg"
      >
        <div className="bg-white px-4 pt-4 pb-4 sm:p-6 sm:pb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Edit FAQ
          </h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="edit-question" className="block text-sm font-medium text-gray-700 mb-1">
                Question <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="edit-question"
                value={formData.question}
                onChange={(e) => handleInputChange('question', e.target.value)}
                placeholder="Enter your question..."
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="edit-answer" className="block text-sm font-medium text-gray-700 mb-1">
                Answer <span className="text-danger">*</span>
              </label>
              <textarea
                id="edit-answer"
                rows={4}
                value={formData.answer}
                onChange={(e) => handleInputChange('answer', e.target.value)}
                placeholder="Enter your answer..."
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleUpdateFaq}
            disabled={saving || !formData.question.trim() || !formData.answer.trim()}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#37a267] text-base font-medium text-white hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267] sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
          >
            {saving ? 'Updating...' : 'Update FAQ'}
          </button>
          <button
            type="button"
            onClick={closeModals}
            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onConfirm={confirmDeleteFaq}
        onCancel={() => {
          setDeleteModalOpen(false);
          setFaqToDelete(null);
        }}
        title="Delete FAQ"
        confirmationText="Are you sure you want to delete this FAQ?"
        confirmBtnText="Delete"
        isDanger={true}
      />
    </div>
  );
};

export default FaqManagement;
