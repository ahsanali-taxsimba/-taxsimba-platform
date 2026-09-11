import { useState } from "react";
import { TaxReturnData } from "@/utils/interface";
import { Calendar, Clock, Download, Eye, FileText, Mail, User, UserPlus } from "lucide-react";

const TaxReturnCard: React.FC<{
  item: TaxReturnData;
  onAssign: (id: number) => void;
  onViewDetails: (id: number) => void;
  showAssignButton: boolean;
}> = ({ item, onAssign, onViewDetails, showAssignButton }) => {
  const { taxReturn, files } = item;
  const lastFile = files?.allFiles?.[0];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_payment':
      case 'pending_assignment': return 'bg-yellow-100 text-yellow-800';
      case 'payment_completed': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_payment': return 'Pending';
      case 'pending_assignment': return 'Pending Assignment';
      case 'payment_completed': return 'Payment Completed';
      case 'assigned': return `Assigned to ${taxReturn?.accountant?.name || 'Accountant'}`;
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  const getPriorityColor = () => {
    // You can add priority logic here if available in your data
    return 'bg-blue-500'; // Default color
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center space-x-4">
          <div className='w-2 h-16 rounded-full bg-[#37a267]'></div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <User className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900 truncate w-75">
                {taxReturn.client.name} {taxReturn.client.surname}
              </h3>
            </div>
            <p className="text-sm text-gray-600">
              Tax Return ID: {taxReturn.taxReturnId}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium text-nowrap ${getStatusColor(taxReturn.status)}`}>
          {getStatusText(taxReturn.status)}
        </span>
      </div>
      <div className="client_info_area min-h-[265px]">
        {/* Client Info */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-800 font-medium text-sm">
              {taxReturn.client.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900 mb-1">{taxReturn.client.name} {taxReturn.client.surname}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Mail className="w-3 h-3" />
                <span>{taxReturn.client.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Details */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Tax Year: {taxReturn.taxYear}</span>
            </div>
            {taxReturn.mtdQuarter && (
              <div className="flex items-center space-x-1">
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-medium">
                  {taxReturn.mtdQuarter}
                </span>
              </div>
            )}
            <div className="flex items-center space-x-1 text-gray-600">
              <FileText className="w-4 h-4" />
              <span className="text-sm">
                {files?.allFiles?.length || 0} File{(files?.allFiles?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Upload Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-1 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              Last Upload: {lastFile?.uploadedAt
                ? new Date(lastFile.uploadedAt).toLocaleDateString()
                : 'No uploads'}
            </span>
          </div>
        </div>

        {/* Files Preview */}
        {files?.allFiles && files.allFiles.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Recent Files:</p>
            <div className="flex flex-wrap gap-2">
              {files.allFiles.slice(0, 3).map((file) => (
                <span key={file.id} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                  {file.filename}
                </span>
              ))}
              {files.allFiles.length > 3 && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  +{files.allFiles.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-2 gap-2">
          {lastFile?.downloadUrl && (
            <a
              href={lastFile.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
          )}
        </div>
        <div className="flex items-center space-x-2 gap-2">
          {showAssignButton && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAssign(taxReturn.id);
              }}
              className="px-3 py-1 bg-[#37a267] text-white text-sm rounded-lg hover:bg-[#37a267]/90 flex items-center space-x-1"
            >
              <UserPlus className="w-4 h-4" />
              <span>Assign</span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewDetails(taxReturn.id);
            }}
            className="px-3 py-1 bg-[#37a267] text-white text-sm rounded-lg hover:bg-[#37a267]/90 flex items-center space-x-1"
          >
            <Eye className="w-4 h-4" />
            <span>View</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default TaxReturnCard;