"use client";

import clientAxios from '@/lib/axios-client';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Modal } from '@/components/ui/modal';
import ConfirmationModal from '@/components/ConfirmationModal';


interface Partner {
  id: number;
  name: string;
  logoUrl: string;
  description?: string;
  status: number; // 1 for active, 0 for inactive
  createdAt?: string;
  updatedAt?: string;
}

interface PaginationData {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

const PartnersManagement: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
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
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    description: '',
    status: 1
  });

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<number | null>(null);

  // Validation
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    }

    if (!formData.logoUrl.trim()) {
      errors.logoUrl = 'Logo URL is required';
    } else {
      try {
        new URL(formData.logoUrl);
      } catch {
        errors.logoUrl = 'Please enter a valid URL';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Fetch Partners
  const fetchPartners = async (page = 1, search = '') => {
    try {
      setLoading(true);
      setError(null);

      const response = await clientAxios.post('/admin/partners', {
        search: search || searchTerm,
        page,
        limit: pagination.pageSize,
        sortBy,
        sortOrder
      });

      if (response.data?.success) {
        setPartners(response.data.data.partners || []);
        setPagination(response.data.data.pagination);
      }
    } catch (err: any) {
      console.error('Error fetching partners:', err);
      setError(err.response?.data?.message || 'Failed to fetch partners');
    } finally {
      setLoading(false);
    }
  };

  // Create Partner
  const handleCreatePartner = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);

      const response = await clientAxios.post('/admin/partners/create', formData);

      if (response.data?.success) {
        toast.success(response.data.message || 'Partner created successfully');
        setShowCreateModal(false);
        setFormData({ name: '', logoUrl: '', description: '', status: 1 });
        setValidationErrors({});
        await fetchPartners(pagination.currentPage);
      }
    } catch (err: any) {
      console.error('Error creating partner:', err);
      const msg = err.response?.data?.message || 'Failed to create partner';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Update Partner
  const handleUpdatePartner = async () => {
    if (!selectedPartner || !validateForm()) return;

    try {
      setSaving(true);
      setError(null);

      const response = await clientAxios.put(`/admin/partners/update/${selectedPartner.id}`, formData);

      if (response.data?.success) {
        toast.success(response.data.message || 'Partner updated successfully');
        setShowEditModal(false);
        setSelectedPartner(null);
        setFormData({ name: '', logoUrl: '', description: '', status: 1 });
        setValidationErrors({});
        await fetchPartners(pagination.currentPage);
      }
    } catch (err: any) {
      console.error('Error updating partner:', err);
      const msg = err.response?.data?.message || 'Failed to update partner';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Delete Partner
  const handleDeletePartner = (partnerId: number) => {
    setPartnerToDelete(partnerId);
    setDeleteModalOpen(true);
  };

  const confirmDeletePartner = async () => {
    if (partnerToDelete === null) return;

    try {
      setSaving(true);
      setError(null);

      const response = await clientAxios.delete(`/admin/partners/delete/${partnerToDelete}`);

      if (response.data?.success) {
        toast.success(response.data.message || 'Partner deleted successfully');
        await fetchPartners(pagination.currentPage);
      }
    } catch (err: any) {
      console.error('Error deleting partner:', err);
      toast.error(err.response?.data?.message || 'Failed to delete partner');
    } finally {
      setSaving(false);
      setDeleteModalOpen(false);
      setPartnerToDelete(null);
    }
  };

  // Toggle Partner status
  const handleToggleStatus = async (partnerId: number, currentStatus: number) => {
    try {
      setSaving(true);
      setError(null);

      // Get partner details first, then update with toggled status
      const partnerResponse = await clientAxios.get(`/admin/partners/${partnerId}`);
      if (!partnerResponse.data?.success) return;

      const partner = partnerResponse.data.data;
      const newStatus = currentStatus === 1 ? 0 : 1;

      const response = await clientAxios.put(`/admin/partners/update/${partnerId}`, {
        ...partner,
        status: newStatus
      });

      if (response.data?.success) {
        toast.success('Status updated successfully');
        await fetchPartners(pagination.currentPage);
      }
    } catch (err: any) {
      console.error('Error updating partner status:', err);
      toast.error(err.response?.data?.message || 'Failed to update partner status');
    } finally {
      setSaving(false);
    }
  };

  // Handle search
  const handleSearch = () => {
    fetchPartners(1, searchTerm);
  };

  // Handle edit modal
  const openEditModal = (partner: Partner) => {
    setSelectedPartner(partner);
    setFormData({
      name: partner.name,
      logoUrl: partner.logoUrl,
      description: partner.description || '',
      status: partner.status
    });
    setValidationErrors({});
    setShowEditModal(true);
  };

  // Handle input changes
  const handleInputChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value });
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: '' });
    }
  };

  // Close modals
  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedPartner(null);
    setFormData({ name: '', logoUrl: '', description: '', status: 1 });
    setValidationErrors({});
    setError(null);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPartners(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, sortBy, sortOrder]);

  if (loading && partners.length === 0) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
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
          <h1 className="text-3xl font-bold text-gray-900">Partners Management</h1>
          <p className="mt-2 mb-0 text-sm text-gray-600">
            Manage your business partners and their information
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#37a267] hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267]"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add New Partner
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
              Search Partners
            </label>
            <div className="flex">
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search name, description, or logo URL..."
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
              <option value="name">Name</option>
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

      {/* Partners List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Partners ({pagination?.totalItems})
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {partners.length > 0 ? (
            partners.map((partner) => (
              <div key={partner.id} className="p-6">
                <div className="flex flex-wrap lg:flex-nowrap gap-2 items-start justify-between">
                  <div className="flex flex-wrap lg:flex-nowrap gap-2 items-start space-x-4 flex-1 min-w-0">
                    {/* Logo */}
                    <div className="lg:flex-shrink-0 flex-none">
                      <img
                        className="h-16 w-24 object-contain rounded-md border border-gray-200 bg-gray-50"
                        src={partner.logoUrl}
                        alt={`${partner.name} logo`}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="%23f3f4f6"/><text x="50" y="30" text-anchor="middle" fill="%236b7280" font-size="10">No Image</text></svg>';
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-none lg:flex-1 min-w-0">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {partner.name}
                        </h3>
                        <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${partner.status === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {partner.status === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {partner.description && (
                        <p className="text-gray-600 mb-2 line-clamp-2">{partner.description}</p>
                      )}

                      <div className="text-sm text-gray-500 space-y-1">
                        <p className="truncate">Logo: {partner.logoUrl}</p>
                        {partner.createdAt && (
                          <p>Created: {new Date(partner.createdAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ml-6 flex items-center space-x-2">
                    <button
                      onClick={() => openEditModal(partner)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Edit Partner"
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(partner.id, partner.status)}
                      disabled={saving}
                      className={`p-2 rounded-md ${partner.status === 1
                        ? 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                      title={partner.status === 1 ? 'Deactivate Partner' : 'Activate Partner'}
                    >
                      {partner.status === 1 ? (
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
                      onClick={() => handleDeletePartner(partner.id)}
                      disabled={saving}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete Partner"
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No partners found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding your first partner.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination?.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-gray-700">
                Showing {Math.min((pagination?.currentPage - 1) * pagination?.pageSize + 1, pagination.totalItems)} to{' '}
                {Math.min(pagination?.currentPage * pagination?.pageSize, pagination?.totalItems)} of{' '}
                {pagination?.totalItems} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => fetchPartners(pagination?.currentPage - 1)}
                  disabled={pagination?.currentPage <= 1 || loading}
                  className="px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  Page {pagination?.currentPage} of {pagination?.totalPages}
                </span>
                <button
                  onClick={() => fetchPartners(pagination?.currentPage + 1)}
                  disabled={pagination?.currentPage >= pagination?.totalPages || loading}
                  className="px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Partner Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeModals}
        className="max-w-lg"
      >
        <div className="bg-white px-4 pt-4 pb-4 sm:p-6 sm:pb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Add New Partner
          </h3>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="create-name" className="block text-sm font-medium text-gray-700 mb-1">
                Partner Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="create-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter partner name..."
                className={`block w-full rounded-md border py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${validationErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {validationErrors.name && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="create-logoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Logo URL <span className="text-danger">*</span>
              </label>
              <input
                type="url"
                id="create-logoUrl"
                value={formData.logoUrl}
                onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className={`block w-full rounded-md border py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${validationErrors.logoUrl ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {validationErrors.logoUrl && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.logoUrl}</p>
              )}
              {formData.logoUrl && !validationErrors.logoUrl && (
                <div className="mt-2">
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="h-12 w-20 object-contain border border-gray-200 rounded"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="create-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="create-description"
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the partner..."
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="create-status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="create-status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', parseInt(e.target.value))}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-4 py-3 items-center sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleCreatePartner}
            disabled={saving}
            className="w-full inline-flex items-center justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#37a267] text-base font-medium text-white hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267] sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Partner'}
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


      {/* Edit Partner Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={closeModals}
        className="max-w-lg"
      >
        <div className="bg-white px-4 pt-4 pb-4 sm:p-6 sm:pb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Edit Partner
          </h3>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                Partner Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter partner name..."
                className={`block w-full rounded-md border py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${validationErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {validationErrors.name && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-logoUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Logo URL <span className="text-danger">*</span>
              </label>
              <input
                type="url"
                id="edit-logoUrl"
                value={formData.logoUrl}
                onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className={`block w-full rounded-md border py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${validationErrors.logoUrl ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {validationErrors.logoUrl && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.logoUrl}</p>
              )}
              {formData.logoUrl && !validationErrors.logoUrl && (
                <div className="mt-2">
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="h-12 w-20 object-contain border border-gray-200 rounded"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="edit-description"
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the partner..."
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="edit-status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', parseInt(e.target.value))}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleUpdatePartner}
            disabled={saving}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#37a267] text-base font-medium text-white hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267] sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
          >
            {saving ? 'Updating...' : 'Update Partner'}
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
        onConfirm={confirmDeletePartner}
        onCancel={() => {
          setDeleteModalOpen(false);
          setPartnerToDelete(null);
        }}
        title="Delete Partner"
        confirmationText="Are you sure you want to delete this partner?"
        confirmBtnText="Delete"
        isDanger={true}
      />
    </div>
  );
};

export default PartnersManagement;