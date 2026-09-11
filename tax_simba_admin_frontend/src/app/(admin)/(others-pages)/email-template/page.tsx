"use client";
import clientAxios from '@/lib/axios-client';
import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';


interface EmailTemplate {
  id: string;
  name: string;
  templateContent: string;
  isActive: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

const EmailTemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Fetch templates from the backend
  const fetchTemplates = async () => {
    try {
      const res = await clientAxios.get('/admin/templates');
      const data = res?.data?.data?.templates || [];
      setTemplates(data);
      
      // Set the initially active template as selected
      const activeTemplate = data.find((t:any) => t.isActive);
      if (activeTemplate) {
        setSelectedTemplate(activeTemplate);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Activate template - only one can be active at a time
  const activateTemplate = async (templateId: string) => {
    setActivatingId(templateId);
    try {
      const res = await clientAxios.post(`/admin/${templateId}/activate`);
      if (res.status === 200) {
        setTemplates(prevTemplates =>
          prevTemplates.map(template =>
            template.id === templateId
              ? { ...template, isActive: true }
              : { ...template, isActive: false }
          )
        );
        
        // Update the selected template
        const activatedTemplate = templates.find(t => t.id === templateId);
        if (activatedTemplate) {
          setSelectedTemplate({...activatedTemplate, isActive: true});
        }
      }
    } catch (error) {
      console.error('Error activating template:', error);
    } finally {
      setActivatingId(null);
    }
  };

  const openPreview = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
  };

  // Filter templates based on search and status
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && template.isActive;
    return matchesSearch && !template.isActive;
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 px-3 mx-auto max-w-(--breakpoint-2xl) md:p-6">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Email Template Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Only one template can be active at a time. Select a template to make it active.
          </p>
        </div>
      </div>

      {/* Active Template Banner */}
      {selectedTemplate && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-1">
              <svg className="h-5 w-5 text-[#37a267]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-700">
                Currently Active Template
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  "{selectedTemplate.name}" is currently set as your active email template.
                  {selectedTemplate.description && ` - ${selectedTemplate.description}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search templates
            </label>
            <input
              type="text"
              id="search"
              placeholder="Search by name or description..."
              className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by status
            </label>
            <select
              id="status"
              className="block w-full rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div 
              key={template.id} 
              className={`rounded-lg border overflow-hidden flex flex-col transition-all duration-200 ${
                template.isActive 
                  ? 'border-[#37a267] ring-2 ring-[#37a267] ring-opacity-50 shadow-md' 
                  : 'border-gray-200 shadow-sm hover:shadow-md'
              } ${activatingId === template.id ? 'opacity-70' : ''}`}
            >
              <div className="p-5 flex-1 bg-white">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium text-gray-900 truncate">{template.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    template.isActive ? 'bg-[#37a267] text-[#fff]' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                {template.description && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{template.description}</p>
                )}
                
                <div className="mt-4 text-xs text-gray-500">
                  {template.updatedAt && `Updated ${new Date(template.updatedAt).toLocaleDateString()}`}
                </div>
              </div>
              
              <div className="bg-gray-50 px-5 py-3 flex justify-between items-center">
                <button
                  onClick={() => openPreview(template)}
                  className="text-sm font-medium text-[#37a267] hover:text-[#37a267]"
                >
                  Preview
                </button>
                
                <div>
                  {template.isActive ? (
                    <div className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-[#fff] bg-[#37a267]">
                      Currently Active
                    </div>
                  ) : (
                    <button
                      onClick={() => activateTemplate(template.id)}
                      disabled={activatingId === template.id}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-[#37a267] hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267] disabled:opacity-70"
                    >
                      {activatingId === template.id ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Activating...
                        </>
                      ) : 'Make Active'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No templates found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter to find what you\'re looking for.'
              : 'Get started by creating a new template.'}
          </p>
        </div>
      )}

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <Modal
          isOpen={previewOpen}
          onClose={closePreview}
          className="max-w-4xl"
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <div className="flex justify-between items-center pr-8">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {selectedTemplate.name}
                    {selectedTemplate.isActive && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#37a267]/10 text-[#37a267]">
                        Active
                      </span>
                    )}
                  </h3>
                </div>
                <div className="mt-2">
                  <div className="bg-gray-100 p-4 mt-4 overflow-auto max-h-96 rounded-lg">
                    <div
                      className="email-preview bg-white p-4 mx-auto shadow-sm rounded border border-gray-200"
                      dangerouslySetInnerHTML={{ __html: selectedTemplate.templateContent }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {!selectedTemplate.isActive && (
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#37a267] text-base font-medium text-white hover:bg-[#37a267] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267] sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => {
                  activateTemplate(selectedTemplate.id);
                  closePreview();
                }}
              >
                Make Active
              </button>
            )}
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#37a267] sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={closePreview}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default EmailTemplateManagement;