"use client";

import clientAxios from '@/lib/axios-client';
import React, { useState, useEffect } from 'react';
import ConfirmationModal from '@/components/ConfirmationModal';

type ApiKey = {
  id: string;
  serviceName: string;
  secretKey: string;
  publishableKey?: string;
  country?: string;
};

const ApiKeyManagement = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  type ShowKeysState = { [key: string]: boolean };
  type EditingKeysState = { [key: string]: boolean };
  type KeyValuesState = { [key: string]: { serviceName: string; secretKey: string; publishableKey?: string; country?: string } };
  
  const [showKeys, setShowKeys] = useState<ShowKeysState>({});
  const [editingKeys, setEditingKeys] = useState<EditingKeysState>({});
  const [keyValues, setKeyValues] = useState<KeyValuesState>({});
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false); 
  const [newKeyData, setNewKeyData] = useState({ 
    serviceName: '',
    secretKey: '',
    publishableKey: '',
    country: 'US'
  });

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  // Fetch API keys from backend
  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // FIXED: Using GET method 
      const response = await clientAxios.post('/admin/api-keys',{});

      const apiKeysData = response.data?.data?.apiKeys || [];
      
      // REMOVED: No filtering - show all API keys
      setApiKeys(apiKeysData);

      // Initialize state for each key with proper null checking
      const initialShowKeys: ShowKeysState = {};
      const initialKeyValues: KeyValuesState = {};
      apiKeysData.forEach((key:any) => {
        // Better null checking to prevent undefined errors
        if (key && key.id) {
          initialShowKeys[`${key.id}_secret`] = false;
          initialShowKeys[`${key.id}_publishable`] = key.publishableKey ? true : false;
          initialKeyValues[key.id] = {
            serviceName: key.serviceName || '',
            secretKey: key.secretKey || '',
            publishableKey: key.publishableKey || '',
            country: key.country || 'US'
          };
        }
      });
      setShowKeys(initialShowKeys);
      setKeyValues(initialKeyValues);

    } catch (err:any) {
      console.error('Error fetching API keys:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  // Save new API key (dedicated function for new keys)
  const saveNewApiKey = async () => {
    try {
      setSaving(true);
      setError(null);
      
      if (!newKeyData.serviceName || !newKeyData.secretKey) {
        setError('Please fill in service name and secret key');
        return;
      }

      const response = await clientAxios.post('/admin/add-api-keys', {
        serviceName: newKeyData.serviceName,
        apiKey: newKeyData.publishableKey || newKeyData.secretKey,
        secretKey: newKeyData.secretKey,
        publishableKey: newKeyData.publishableKey || '',
        country: newKeyData.country || 'US'
      });

      if (response.data?.success) {
        // Close modal and reset form
        setShowCreateModal(false);
        setNewKeyData({
          serviceName: '',
          secretKey: '',
          publishableKey: '',
          country: 'US'
        });
        
        // Refresh the list
        await fetchApiKeys();
        setError(null);
      } else {
        throw new Error(response.data?.message || 'Failed to save API key');
      }

    } catch (err:any) {
      console.error('Error saving new API key:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  // Update existing API key
  const updateApiKey = async (keyId:any) => {
    try {
      const keyData = keyValues[keyId];
      
      if (!keyData?.serviceName || !keyData?.secretKey) {
        setError('Please fill in service name and secret key');
        return;
      }

      const response = await clientAxios.put(`/admin/update-api-keys/${keyId}`, {
        serviceName: keyData.serviceName,
        apiKey: keyData.publishableKey || keyData.secretKey,
        secretKey: keyData.secretKey,
        publishableKey: keyData.publishableKey || '',
        country: keyData.country || 'US'
      });

      if (response.data?.success) {
        await fetchApiKeys();
        setEditingKeys(prev => ({ ...prev, [keyId]: false }));
        setError(null);
      } else {
        throw new Error(response.data?.message || 'Failed to update API key');
      }

    } catch (err:any) {
      console.error('Error updating API key:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update API key');
    }
  };

  // Delete API key
  const deleteApiKey = (keyId:any) => {
    setKeyToDelete(keyId);
    setDeleteModalOpen(true);
  };

  const confirmDeleteKey = async () => {
    if (!keyToDelete) return;

    try {
      const response = await clientAxios.delete(`/admin/api-keys/${keyToDelete}`);
      
      if (response.data?.success) {
        await fetchApiKeys();
        setError(null);
      } else {
        throw new Error(response.data?.message || 'Failed to delete API key');
      }
    } catch (err:any) {
      console.error('Error deleting API key:', err);
      setError(err.response?.data?.message || err.message || 'Failed to delete API key');
    } finally {
      setDeleteModalOpen(false);
      setKeyToDelete(null);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text:any) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Handle key value changes
  const handleKeyValueChange = (keyId:any, field:any, value:any) => {
    setKeyValues(prev => ({
      ...prev,
      [keyId]: {
        ...prev[keyId],
        [field]: value
      }
    }));
  };

  // Handle new key form changes
  const handleNewKeyChange = (field:any, value:any) => {
    setNewKeyData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Toggle key visibility
  const toggleKeyVisibility = (keyId:any, keyType:any) => {
    const key = `${keyId}_${keyType}`;
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Start editing
  const startEditing = (keyId:any) => {
    setEditingKeys(prev => ({ ...prev, [keyId]: true }));
    setError(null);
  };

  // Cancel editing
  const cancelEditing = (keyId:any) => {
    setEditingKeys(prev => ({ ...prev, [keyId]: false }));
    // Reset to original values
    fetchApiKeys();
    setError(null);
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading API keys</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={fetchApiKeys}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderKeyCard = (keyData:any, keyId:any, keyType:any, label:any, description:any, isSecret = false) => {
    const isEditing = editingKeys[keyId];
    const fieldName = keyType === 'publishable' ? 'publishableKey' : 'secretKey';
    const keyValue = keyValues[keyId]?.[fieldName] || '';
    const isVisible = showKeys[`${keyId}_${keyType}`];

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{label}</h2>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isSecret ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {isSecret ? 'Keep secret' : 'Safe to share'}
          </span>
        </div>
        <p className="text-gray-600 mb-6">{description}</p>

        <div className="flex  flex-wrap lg:flex-nowrap gap-2 items-center">
          <div className="relative rounded-md shadow-sm lg:flex-1 sm:flex-none">
            <input
              type={isVisible ? "text" : "password"}
              value={keyValue}
              onChange={(e) => handleKeyValueChange(keyId, fieldName, e.target.value)}
              disabled={!isEditing}
              placeholder={isEditing ? `Enter ${label.toLowerCase()}...` : ''}
              className={`block w-full py-3 px-4 pe-5 ${
                isEditing ? 'border-gray-300' : 'border-transparent bg-gray-100'
              } rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-xs font-mono text-sm`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500 mr-2"
                onClick={() => toggleKeyVisibility(keyId, keyType)}
              >
                {isVisible ? (
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
              {keyValue && (
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => copyToClipboard(keyValue)}
                >
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Only show Update/Delete buttons for existing keys */}
          {isEditing ? (
            <div className="ml-4 flex-shrink-0 flex space-x-2">
              <button
                onClick={() => updateApiKey(keyId)}
                disabled={!keyValue.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update
              </button>
              <button
                onClick={() => cancelEditing(keyId)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="ml-4 flex-shrink-0 flex space-x-2">
              <button
                onClick={() => startEditing(keyId)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#37a267] hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267]"
              >
                Edit
              </button>
              <button
                onClick={() => deleteApiKey(keyId)}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="lg:px-4 lg:py-8 p-0">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">API Key Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your API keys for various services and integrations
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#37a267] hover:bg-[#37a267]"
            onClick={() => setShowCreateModal(true)}
          >
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add New Key Set
          </button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-1">
            <svg className="h-5 w-5 text-[#37a267]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-dark">API Key Security</h3>
            <div className="mt-2 text-sm text-[#37a267]">
              <p>
                Keep your secret keys secure and never expose them in client-side code. 
                Only share publishable keys when necessary for frontend integrations.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Render existing API keys */}
        {apiKeys.map((apiKey) => (
          <div key={apiKey.id} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {apiKey.serviceName || 'Unnamed Service'}
              </h3>
              <span className="text-sm text-gray-500">
                Country: {apiKey.country || 'Not specified'}
              </span>
            </div>

            {/* Show publishable key only if it exists */}
            {apiKey.publishableKey && renderKeyCard(
              apiKey,
              apiKey.id,
              'publishable',
              'Publishable Key',
              'Safe to use in client-side code for frontend integrations.',
              false
            )}

            {renderKeyCard(
              apiKey,
              apiKey.id,
              'secret',
              'Secret Key',
              'Keep this key secure and only use it on your server.',
              true
            )}
          </div>
        ))}

        {apiKeys.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2m6 0V7a2 2 0 00-2-2H9a2 2 0 00-2 2v0m6 0V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2m0 0h6" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No API keys found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first API key set.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add API Key Set
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Security Notes */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0 mt-0">
            <svg className="h-10 w-10 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Security Best Practices</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Never commit API keys to version control systems</li>
                <li>Use environment variables to store keys on your server</li>
                <li>Regularly rotate your API keys for enhanced security</li>
                <li>Use test/sandbox keys for development environments</li>
                <li>Monitor API usage for suspicious activity</li>
                <li>Implement proper access controls and rate limiting</li>
                <li>Use HTTPS for all API communications</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-9999">
          <div className="relative top-20 mx-auto border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center p-3 border-b">
                <h3 className="text-xl font-semibold text-gray-900 mb-0">Create New API Key Set</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            <div className="mt-0 p-4">
              <div className="m-0">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    value={newKeyData.serviceName}
                    onChange={(e) => handleNewKeyChange('serviceName', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., Stripe Production, PayPal Sandbox, AWS S3, OpenAI, GitHub, etc."
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country/Region
                  </label>
                  <select
                    value={newKeyData.country}
                    onChange={(e) => handleNewKeyChange('country', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="IN">India</option>
                    <option value="SG">Singapore</option>
                    <option value="JP">Japan</option>
                    <option value="Global">Global</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Publishable Key (Optional)
                  </label>
                  <input
                    type="text"
                    value={newKeyData.publishableKey}
                    onChange={(e) => handleNewKeyChange('publishableKey', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter publishable key (if applicable)"
                  />
                  <p className="mt-1 text-xs text-gray-500">For services that have public keys (like Stripe)</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secret Key *
                  </label>
                  <input
                    type="text"
                    value={newKeyData.secretKey}
                    onChange={(e) => handleNewKeyChange('secretKey', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter your secret API key"
                  />
                  <p className="mt-1 text-xs text-gray-500">Your private API key. Keep this secure and never expose it publicly.</p>
                </div>
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
              <div className="mt-0 flex justify-end space-x-3 p-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveNewApiKey}
                  disabled={saving || !newKeyData.serviceName || !newKeyData.secretKey}
                  className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    'Save API Key'
                  )}
                </button>
              </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onConfirm={confirmDeleteKey}
        onCancel={() => {
          setDeleteModalOpen(false);
          setKeyToDelete(null);
        }}
        title="Delete API Key"
        confirmationText="Are you sure you want to delete this API key?"
        confirmBtnText="Delete"
        isDanger={true}
      />
    </div>
  );
};
export default ApiKeyManagement;