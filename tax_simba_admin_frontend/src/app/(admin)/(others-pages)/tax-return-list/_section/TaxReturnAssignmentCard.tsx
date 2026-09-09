import { TaxReturnAssignment } from "@/utils/interface";
import { Calendar, CheckCircle, Clock, Download, Edit, Eye, FileText, User, XCircle } from "lucide-react";

const TaxReturnAssignmentCard: React.FC<{
  assignment: TaxReturnAssignment;
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
  onComplete: (id: string) => void;
  onViewDetails: (id: number) => void;
}> = ({ assignment, onEdit, onCancel, onComplete, onViewDetails }) => {
  console.log("assignment", assignment)
  const getStatusColor = (status: TaxReturnAssignment['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: TaxReturnAssignment['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const mostRecentDocument = assignment.documents?.reduce((latest, doc) => {
    return new Date(doc.createdAt) > new Date(latest.createdAt) ? doc : latest;
  }, assignment.documents[0]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className={`w-2 ${assignment.client?.userRole?.toLowerCase() === 'mtd' ? 'h-8' : 'h-16'} rounded-full ${getPriorityColor(assignment.priority)}`}></div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <FileText className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900 font-mono text-sm">
                {assignment.taxReturnId}
              </h3>
              {assignment.client?.userRole && (
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border border-indigo-100">
                  {assignment.client.userRole}
                </span>
              )}
            </div>
            {assignment.client?.userRole?.toLowerCase() !== 'mtd' && (
              <p className="text-sm text-gray-600">
                {assignment.TaxReturnType?.typeName || 'Tax Return'}
              </p>
            )}
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
          {assignment.status.toUpperCase()}
        </span>
      </div>

      {/* Tax Details */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">Tax Year: {assignment.taxYear}</span>
          </div>
          {assignment.mtdQuarter && (
            <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
              {assignment.mtdQuarter}
            </span>
          )}
          {assignment.client?.userRole?.toLowerCase() !== 'mtd' && assignment.TaxReturnType?.typeCode && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              {assignment.TaxReturnType.typeCode}
            </span>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded capitalize ${assignment.priority === 'urgent' ? 'bg-red-100 text-red-800' :
            assignment.priority === 'high' ? 'bg-orange-100 text-orange-800' :
              assignment.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
          }`}>
          {assignment.priority} Priority
        </span>
      </div>

      {/* Documents Info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-gray-600">
            <FileText className="w-4 h-4" />
            <span className="text-sm">
              {assignment.documents?.length || 0} Document{(assignment.documents?.length || 0) !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              Created: {new Date(assignment.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Assigned Date */}
      {assignment.assignedAt && (
        <div className="mb-4">
          <div className="flex items-center space-x-1 text-gray-600">
            <User className="w-4 h-4" />
            <span className="text-sm">
              Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* Recent Documents */}
      {assignment.documents && assignment.documents.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">Documents:</p>
          <div className="flex flex-wrap gap-2">
            {assignment.documents.slice(0, 3).map((doc) => (
              <span key={doc.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                {doc.originalFileName}
              </span>
            ))}
            {assignment.documents.length > 3 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                +{assignment.documents.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          {mostRecentDocument?.cloudinaryUrl && (
            <a
              href={mostRecentDocument.cloudinaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
          )}
          <button
            onClick={() => onEdit(assignment.id.toString())}
            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
            title="Edit Assignment"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onViewDetails(assignment.id)}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center space-x-1"
          >
            <Eye className="w-4 h-4" />
            <span>View</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaxReturnAssignmentCard;