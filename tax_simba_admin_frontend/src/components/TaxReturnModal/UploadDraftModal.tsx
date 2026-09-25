import React, { useRef, useState } from 'react';
import { AlertCircle, FileText, Upload, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';

import clientAxios from '@/lib/axios-client';
import { DraftUploadModalProps } from '@/utils/interface';

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function fileExtension(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/** Accept by MIME when present; fall back to extension (browsers often omit MIME). */
function isAllowedDraftFile(file: File): boolean {
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  const mime = (file.type || '').split(';')[0].trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') return true;
  return ALLOWED_MIME.has(mime);
}

const DraftUploadModal = ({
  isOpen,
  onClose,
  taxReturnId,
  fetchProgressData,
}: DraftUploadModalProps) => {
  const { data } = useSession();
  const role = String((data?.user as { role?: string } | undefined)?.role || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draftType, setDraftType] = useState('Tax Return Draft');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Prevent double-submit creating duplicate drafts. */
  const inFlightRef = useRef(false);

  const resetForm = () => {
    setSelectedFile(null);
    setDraftType('Tax Return Draft');
    setNotes('');
    setUploading(false);
    setError('');
    setDragOver(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onClose();
    }
  };

  const handleFileSelect = (file: File) => {
    setError('');

    if (!isAllowedDraftFile(file)) {
      setError('Please upload a PDF or Word document (.pdf, .doc, .docx)');
      // Keep any previously selected valid file; do not clear on a rejected pick.
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('File size must be less than 10MB');
      return;
    }

    if (!file.size) {
      setError('The selected file appears to be empty');
      return;
    }

    setSelectedFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileSelect(files[0]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFileSelect(files[0]);
    // Allow re-selecting the same file after a failed attempt.
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !taxReturnId || inFlightRef.current) return;
    if (role === 'SUPER_ADMIN') {
      setError('Super Admin cannot submit drafts — use Admin or the assigned accountant.');
      return;
    }

    inFlightRef.current = true;
    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('draftReturnFile', selectedFile);
      formData.append('draftType', draftType);
      formData.append('explanationNotes', notes);

      const endpoint =
        role === 'ADMIN'
          ? `/admin/assignments/${taxReturnId}/upload-draft`
          : `/accountant/assignments/${taxReturnId}/upload-draft`;

      const response = await clientAxios.post(endpoint, formData, true, {
        onUploadProgress: (progressEvent: { loaded?: number; total?: number }) => {
          if (progressEvent.total) {
            setUploadProgress(
              Math.round(((progressEvent.loaded || 0) * 100) / progressEvent.total),
            );
          }
        },
      });

      if (response?.data?.success) {
        toast.success(
          response.data.message ||
            'Draft submitted for Admin review. The client will not be notified until Admin approves.',
        );
        resetForm();
        onClose();
        if (typeof fetchProgressData === 'function') fetchProgressData();
      } else {
        const msg = response?.data?.message || 'Upload failed';
        setError(msg);
        toast.error(msg);
        // Keep selected file so the accountant can retry.
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (typeof err?.response?.data?.detail === 'string'
          ? err.response.data.detail
          : null) ||
        err?.message ||
        'Upload failed';
      setError(msg);
      toast.error(msg);
      // Do not clear the chosen file or close the modal on failure.
    } finally {
      setUploading(false);
      inFlightRef.current = false;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Submit Draft for Admin Review</h3>
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            The client will not see this draft or receive a notification until an Admin approves it.
          </p>

          {error && (
            <div
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2"
              data-testid="draft-upload-error"
            >
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Draft Type</label>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
                disabled={uploading}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option>Tax Return Draft</option>
                <option>Amended Return</option>
                <option>Supporting Documents</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>

              {!selectedFile ? (
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                  } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                  data-testid="draft-upload-dropzone"
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">Drag and drop or click to upload</p>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX files up to 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileInputChange}
                    disabled={uploading}
                    data-testid="draft-upload-input"
                  />
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg p-4" data-testid="draft-selected-file">
                  <div className="flex items-start space-x-3">
                    <FileText className="h-8 w-8 text-blue-500 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium text-gray-900 truncate"
                        data-testid="draft-selected-filename"
                      >
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>

                      {uploading && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Uploading...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {!uploading && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setError('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes for Admin (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={uploading}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Internal notes for Admin review…"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              data-testid="draft-submit-btn"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              <span>
                {uploading
                  ? `Submitting... ${uploadProgress}%`
                  : 'Submit Draft for Admin Review'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftUploadModal;
