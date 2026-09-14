"use client";

import React, { useState } from 'react';
import { Download, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { FilesData, UploadedFilesDetailsProps, FileItem } from '@/utils/interface';
const UploadedFilesDetails: React.FC<UploadedFilesDetailsProps> = ({ taxReturn, files }) => {
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

    const calculateFileStats = (filesData: FilesData) => {
        const allFiles = Object.values(filesData.categories).flatMap(category =>
            Object.values(category).flat()
        );

        const completedFiles = allFiles.filter(file => file.uploadStatus === 'completed').length;
        const pendingFiles = allFiles.filter(file => file.uploadStatus !== 'completed').length;
        const completionPercentage = Math.round((completedFiles / filesData.totalFiles) * 100);

        return { completedFiles, pendingFiles, completionPercentage };
    };

    // Calculate the stats
    const { completedFiles, pendingFiles, completionPercentage } = calculateFileStats(files);

    const toggleCategory = (categoryName: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [categoryName]: !prev[categoryName]
        }));
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    const handleDownload = async (url: any, filename = 'file') => {
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error('Failed to fetch file');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('image')) return '🖼️';
        if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
        if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
        return '📁';
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Header with summary */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Uploaded Documents</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-600 font-medium">Total Files</p>
                        <p className="text-2xl font-bold text-blue-900">{files.totalFiles}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">Completed</p>
                        <p className="text-2xl font-bold text-green-900">{completedFiles}</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg">
                        <p className="text-sm text-amber-600 font-medium">Pending</p>
                        <p className="text-2xl font-bold text-amber-900">{pendingFiles}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-sm text-purple-600 font-medium">Total Size</p>
                        <p className="text-2xl font-bold text-purple-900">{formatFileSize(files.totalSize)}</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Completion Progress</span>
                        <span className="text-sm font-medium text-gray-700">{completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-green-600 h-2.5 rounded-full"
                            style={{ width: `${completionPercentage}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Files by category */}
            <div className="space-y-4">
                {Object.entries(files.categories).map(([categoryName, fileCategory]) => (
                    <div key={categoryName} className="border rounded-lg overflow-hidden">
                        <button
                            className="w-full p-4 bg-gray-50 flex justify-between items-center hover:bg-gray-100"
                            onClick={() => toggleCategory(categoryName)}
                        >
                            <h3 className="font-medium text-gray-900 capitalize">
                                {categoryName.replace(/_/g, ' ')}
                            </h3>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-500 mr-3">
                                    {Object.values(fileCategory).flat().length} files
                                </span>
                                {expandedCategories[categoryName] ? (
                                    <ChevronDown className="h-5 w-5 text-gray-500" />
                                ) : (
                                    <ChevronRight className="h-5 w-5 text-gray-500" />
                                )}
                            </div>
                        </button>

                        {expandedCategories[categoryName] && (
                            <div className="p-4 bg-white">
                                {Object.entries(fileCategory).map(([documentType, filesList]) => (
                                    <div key={documentType} className="mb-6 last:mb-0">
                                        <h4 className="font-medium text-gray-800 mb-3 capitalize">
                                            {documentType.replace(/-/g, ' ')}
                                        </h4>
                                        <div className="space-y-3">
                                            {filesList.map((file) => (
                                                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                                    <div className="flex items-center space-x-3 flex-wrap gap-3">
                                                        <span className="text-xl">{getFileIcon(file.mimeType)}</span>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{file.filename}</p>
                                                            <p className="text-sm text-gray-500">
                                                                {formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => setSelectedFile(file)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                                                            title="View details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <a
                                                            href={file.downloadUrl}
                                                            download={file.filename}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-full"
                                                            title="Download file"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* File detail modal */}
            {selectedFile && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-medium text-gray-900">File Details</h3>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center space-x-3 flex-wrap gap-3">
                                    <span className="text-3xl">{getFileIcon(selectedFile.mimeType)}</span>
                                    <div>
                                        <p className="font-medium text-gray-900">{selectedFile.filename}</p>
                                        <p className="text-sm text-gray-500">{selectedFile.documentType}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">File Size</p>
                                        <p className="text-sm text-gray-900">{formatFileSize(selectedFile.fileSize)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">File Type</p>
                                        <p className="text-sm text-gray-900">{selectedFile.mimeType}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Upload Status</p>
                                        <p className="text-sm text-gray-900 capitalize">{selectedFile.uploadStatus}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Required</p>
                                        <p className="text-sm text-gray-900">{selectedFile.isRequired ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Uploaded At</p>
                                        <p className="text-sm text-gray-900">{formatDate(selectedFile.uploadedAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Last Updated</p>
                                        <p className="text-sm text-gray-900">{formatDate(selectedFile.updatedAt)}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-gray-700 mb-2">Actions</p>
                                    <div className="flex space-x-3">
                                        <a
                                            href={selectedFile.cloudinaryUrl.replace('/upload/', '/upload/fl_attachment/')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span>Download</span>
                                        </a>

                                        {selectedFile.previewUrl && (
                                            <a
                                                href={selectedFile.previewUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                            >
                                                <Eye className="h-4 w-4" />
                                                <span>Preview</span>
                                            </a>
                                        )}
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadedFilesDetails;