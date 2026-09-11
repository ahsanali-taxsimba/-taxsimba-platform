"use client";
import React, { useState, useEffect } from 'react';
import clientAxios from '@/lib/axios-client';

interface GlobalFee {
  id: number;
  baseFee: number;
  serviceName: string;
  description: string;
  isActive: boolean;
  updatedAt: string;
}

interface TaxReturnType {
  id: number;
  typeName: string;
  typeCode: string;
  description: string;
  category: string;
  isActive: boolean;
}

const CentralizedFeeManagement: React.FC = () => {
  const [globalFee, setGlobalFee] = useState<GlobalFee>({
    id: 1,
    baseFee: 150.00,
    serviceName: 'Tax Return Preparation',
    description: 'Standard fee for all tax return preparation services',
    isActive: true,
    updatedAt: new Date().toISOString().split('T')[0]
  });
  
  const [taxReturnTypes, setTaxReturnTypes] = useState<TaxReturnType[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedFee, setEditedFee] = useState<GlobalFee>({...globalFee});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch current global fee and tax return types
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch global fee
      const feeResponse = await clientAxios.get('/admin/global-fee');
      if (feeResponse.data?.success) {
        setGlobalFee(feeResponse.data.data.globalFee);
        setEditedFee(feeResponse.data.data.globalFee);
      }
      
      // Fetch tax return types to show preview
      const typesResponse = await clientAxios.post('/admin/tax-return-type',{});
      if (typesResponse.data?.success) {
        setTaxReturnTypes(typesResponse.data.data.taxReturnTypes || []);
      }
      
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Update global fee
  const handleFeeUpdate = async () => {
    try {
      setSaving(true);
      setError(null);
      
      if (!editedFee.serviceName || editedFee.baseFee <= 0) {
        setError('Please fill in all required fields with valid values');
        return;
      }

      const response = await clientAxios.put('/admin/global-fee', {
        baseFee: editedFee.baseFee,
        serviceName: editedFee.serviceName,
        description: editedFee.description,
        isActive: editedFee.isActive
      });

      if (response.data?.success) {
        setGlobalFee({
          ...editedFee,
          updatedAt: new Date().toISOString().split('T')[0]
        });
        setIsEditing(false);
        
        // Refresh tax return types to show updated fees
        await fetchData();
      } else {
        throw new Error(response.data?.message || 'Failed to update fee');
      }

    } catch (err: any) {
      console.error('Error updating fee:', err);
      setError(err.response?.data?.message || 'Failed to update fee');
    } finally {
      setSaving(false);
    }
  };

  // Handle input changes for editing
  const handleInputChange = (field: keyof GlobalFee, value: string | number | boolean) => {
    setEditedFee({ ...editedFee, [field]: value });
  };

  // Toggle fee status
  const toggleFeeStatus = async () => {
    try {
      setSaving(true);
      const newStatus = !globalFee.isActive;
      
      const response = await clientAxios.put('/admin/global-fee/toggle-status', {
        isActive: newStatus
      });

      if (response.data?.success) {
        const updatedFee = {
          ...globalFee,
          isActive: newStatus,
          updatedAt: new Date().toISOString().split('T')[0]
        };
        setGlobalFee(updatedFee);
        setEditedFee(updatedFee);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle fee status');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded mb-8"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-0 lg:px-6 lg:px-8 lg:py-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Centralized Fee Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Set one base fee that applies to all tax return types
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            globalFee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {globalFee.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

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

      {/* Global Fee Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Global Fee Configuration</h2>
          <div className="text-3xl font-bold text-[#37a267]">
            £{globalFee?.baseFee}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-2">
              Service Name
            </label>
            {isEditing ? (
              <input
                type="text"
                id="service"
                value={editedFee.serviceName}
                onChange={(e) => handleInputChange('serviceName', e.target.value)}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g., Tax Return Preparation"
              />
            ) : (
              <div className="text-lg font-medium text-gray-900 py-2">{globalFee.serviceName}</div>
            )}
          </div>
          
          <div>
            <label htmlFor="fee" className="block text-sm font-medium text-gray-700 mb-2">
              Base Fee (£)
            </label>
            {isEditing ? (
              <input
                type="number"
                id="fee"
                value={editedFee.baseFee}
                onChange={(e) => handleInputChange('baseFee', parseFloat(e.target.value) || 0)}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            ) : (
              <div className="text-lg font-medium text-gray-900 py-2">£{globalFee.baseFee}</div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <span className={`w-24 justify-center flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
              globalFee.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {globalFee.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            {isEditing ? (
              <textarea
                id="description"
                rows={3}
                value={editedFee.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Describe what this fee includes..."
              />
            ) : (
              <div className="text-gray-700 py-2">{globalFee.description}</div>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex  flex-wrap lg:flex-nowrap gap-2  justify-between items-center">
          <div className="text-sm text-gray-500">
            Last updated: {globalFee.updatedAt}
          </div>
          
          <div className="flex space-x-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleFeeUpdate}
                  disabled={saving || !editedFee.serviceName || editedFee.baseFee <= 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedFee({...globalFee});
                    setError(null);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#37a267] hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267]"
                >
                  Edit Fee
                </button>
                <button
                  onClick={toggleFeeStatus}
                  disabled={saving}
                  className={globalFee.isActive ? 
                    "inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-yellow-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50" : 
                    "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"}
                >
                  {saving ? 'Updating...' : (globalFee.isActive ? 'Deactivate' : 'Activate')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Tax Return Types Preview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Tax Return Types - Fee Preview
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          This fee will be applied to all tax return types below:
        </p>

        <div className="overflow-hidden">
          <div className="grid gap-4">
            {taxReturnTypes.length > 0 ? (
              taxReturnTypes.map((type) => (
                <div key={type.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{type.typeName}</h3>
                    <p className="text-xs text-gray-500">{type.typeCode} • {type.category}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{type.description}</p>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-lg font-semibold text-green-600">
                      £{globalFee.baseFee}
                    </div>
                    <div className="text-xs text-gray-500">Global Fee</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2">No tax return types found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Information Panel */}
      <div className="mt-8 bg-green-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-dark-800 mb-3">How Centralized Fee Management Works</h3>
        <div className="text-green-700 space-y-2">
          <p>• One base fee applies to all tax return preparation services</p>
          <p>• Changes to the global fee automatically update pricing for all tax return types</p>
          <p>• You can activate/deactivate the fee system without affecting individual tax return types</p>
          <p>• This simplifies pricing and ensures consistency across all services</p>
        </div>
      </div>
    </div>
  );
};

export default CentralizedFeeManagement;

