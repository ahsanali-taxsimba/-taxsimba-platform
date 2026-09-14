import React, { useState } from 'react';
import {
  CheckCircle,
  Clock,
  User,
  Calendar,
  FileText,
  DollarSign,
  ChevronRight,
  AlertTriangle,
  Settings,
  MoreVertical,
  TrendingUp,
  Target,
  Users,
  AlertCircle,
  CheckCircle2,
  Circle,
  ArrowRight,
  Phone,
  Mail
} from 'lucide-react';
import { getStatusLabel } from "./statusUtils";

interface Client {
  id: number | string;
  name: string;
  email: string;
  userRole?: string;
  dob?: string;
  address?: string;
  nino?: string;
  utr?: string;
  govGatewayStatus?: string;
  isRegisteredForMTD?: string;
  incomeSources?: string[];
  annualTurnover?: string;
  recordKeepingMethod?: string;
  accountantNotes?: string;
  businessType?: string;
  businessName?: string;
  prevSubmittedMTDThisYear?: string;
  submittedQuarters?: string[] | string;
  whoSubmittedQuarters?: string;
  hasOutstandingMTDSubmissions?: string;
  reviewPreviousMTDSubmissions?: string;
  firstQuarterToManage?: string;
  hasGatewayCredentials?: string;
  previousMTDSoftware?: string;
  otherActiveIncomeSources?: string;
}

interface Accountant {
  name: string;
  avatar?: React.ReactNode;
  email: string;
  mobile: string;
}

interface ProgressStep {
  key: string;
  label: string;
  completed: boolean;
  current: boolean;
  order: number;
}

interface ProgressData {
  status: string;
  meta?: { canUpdate?: boolean };
  priority: string;
  submissionDeadline: string;
  taxReturnId: string | number;
  progressPercentage: number;
  taxYear: string | number;
  estimatedCompletion?: string;
  client: Client;
  accountant?: Accountant;
  assignedAt?: string;
  createdAt: string;
  progressSteps: ProgressStep[];
  adminNotes?: string;
}

interface HorizontalProgressBarProps {
  progressData: ProgressData;
  loading: boolean;
  handleStatusUpdate: (nextStatus: string | undefined) => void;
}

const HorizontalProgressBar: React.FC<HorizontalProgressBarProps> = ({
  progressData,
  loading,
  handleStatusUpdate
}) => {
  console.log(progressData, "progressData");

  // Icon mapping for different step types
  const getStepIcon = (stepKey: string) => {
    const iconMap: { [key: string]: React.ElementType } = {
      'pending_assignment': User,
      'assigned': User,
      'preparation_started': Clock,
      'draft_ready': FileText,
      'final_submitted': FileText,
      'completed': CheckCircle,
      // Add more mappings as needed
    };
    return iconMap[stepKey] || Circle;
  };

  // Get step description based on step key
  const getStepDescription = (stepKey: string) => {
    const descriptionMap: { [key: string]: string } = {
      'pending_payment': 'Assigned Tax Professional Pending',
      'pending_assignment': 'Assigned Tax Professional Pending',
      'assigned': 'Assigned to tax professional',
      'preparation_started': 'Tax return preparation in progress',
      'draft_ready': 'Draft ready for client review',
      'final_submitted': 'Final documents submitted to tax authorities',
      'completed': 'Tax return filed successfully',
      // Add more descriptions as needed
    };
    return descriptionMap[stepKey] || 'Processing step';
  };

  const getCurrentStep = () => {
    return progressData?.progressSteps?.find(step => step.current);
  };

  const getNextStep = () => {
    const currentStep = getCurrentStep();
    if (!currentStep) return null;

    const sortedSteps = [...(progressData?.progressSteps || [])].sort((a, b) => a.order - b.order);
    const currentIndex = sortedSteps.findIndex(step => step.key === currentStep.key);
    return sortedSteps[currentIndex + 1] || null;
  };

  const getDisplayLabel = (label: string | undefined) => {
    if (label === 'Payment Pending') return 'Assigned Pending';
    return label;
  };

  const canAdvanceStatus = () => {
    return progressData?.meta?.canUpdate &&
      progressData?.status !== 'completed' &&
      !loading &&
      getNextStep() !== null;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDaysUntilDeadline = () => {
    if (!progressData?.submissionDeadline) {
      return 0;
    }

    const deadline = new Date(progressData.submissionDeadline);
    const today = new Date();

    if (isNaN(deadline.getTime())) {
      console.error("Invalid deadline date:", progressData.submissionDeadline);
      return 0;
    }

    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate progress line width based on completed steps
  const getProgressLineWidth = () => {
    if (!progressData?.progressSteps?.length) return 0;

    const sortedSteps = [...progressData.progressSteps].sort((a, b) => a.order - b.order);
    const completedSteps = sortedSteps.filter(step => step.completed).length;
    const totalSteps = sortedSteps.length;

    // If there's a current step, add partial progress
    const currentStep = sortedSteps.find(step => step.current);
    const progressPercentage = currentStep
      ? ((completedSteps + 0.5) / totalSteps) * 100
      : (completedSteps / totalSteps) * 100;

    return Math.min(100, progressPercentage);
  };

  // Show loading state if no progress data
  if (!progressData && loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="animate-pulse">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <div className="h-6 bg-gray-200 rounded w-48"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="flex justify-between">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-20 mt-4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if no progress data and not loading
  if (!progressData && !loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Progress Data Unavailable</h3>
        <p className="text-gray-600 mb-4">Unable to load progress information for this tax return.</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Sort steps by order for consistent display
  const sortedSteps = [...(progressData?.progressSteps || [])].sort((a, b) => a.order - b.order);
  console.log("progressData?.priority", progressData)
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-start space-x-4 flex-wrap  gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Return Progress</h1>
              <p className="text-gray-600 mb-0">Track and manage your tax return status in real-time</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-wrap gap-3">
            {
              progressData?.priority && (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(progressData?.priority)}`}>
                  {progressData?.priority?.charAt(0).toUpperCase() + progressData?.priority?.slice(1)} Priority
                </span>
              )
            }
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Return ID</p>
                <p className="text-lg font-bold text-blue-900">{progressData?.taxReturnId}</p>
              </div>
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Progress</p>
                <p className="text-lg font-bold text-green-900">{progressData?.progressPercentage || 0}%</p>
              </div>
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Days Left</p>
                <p className="text-lg font-bold text-orange-900">{getDaysUntilDeadline()}</p>
              </div>
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Tax Year</p>
                <p className="text-lg font-bold text-purple-900">{progressData?.taxYear}</p>
              </div>
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Progress Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">Process Timeline</h2>
            <div className="text-sm text-gray-500">
              Current: <span className="font-medium text-blue-600">
                {getDisplayLabel(getCurrentStep()?.label) || getDisplayLabel(getStatusLabel(progressData?.status))}
              </span>
            </div>
          </div>
          
        </div>

        {/* Enhanced Step Indicators */}
        <div className="relative">
          {/* Background connecting line */}
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-gray-200 z-0"></div>

          {/* Progress connecting line */}
          <div
            className="absolute top-8 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 z-10 transition-all duration-1000 ease-in-out"
            style={{
              width: `${getProgressLineWidth()}%`
            }}
          ></div>

          {/* Steps */}
          <div className="relative flex justify-between z-20 flex-wrap">
            {sortedSteps.map((step, index) => {
              const StepIcon = getStepIcon(step.key);
              const completed = step.completed;
              const current = step.current;

              return (
                <div key={step.key} className="flex flex-col items-center group cursor-pointer">
                  {/* Step indicator */}
                  <div
                    className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all duration-500 transform group-hover:scale-110 ${completed
                      ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-200'
                      : current
                        ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-200 animate-pulse'
                        : 'bg-white border-gray-300 text-gray-400 hover:border-gray-400 hover:shadow-md'
                      }`}
                  >
                    {completed ? (
                      <CheckCircle2 className="h-8 w-8" />
                    ) : current ? (
                      <StepIcon className="h-8 w-8" />
                    ) : (
                      <StepIcon className="h-6 w-6" />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="mt-4 text-center max-w-32">
                    <h6 className={`text-sm font-semibold mb-1 ${completed ? 'text-green-700' :
                      current ? 'text-blue-700' : 'text-gray-500'
                      }`}>
                      {getDisplayLabel(step.label)}
                    </h6>
                    <p className={`text-xs leading-tight ${completed ? 'text-green-600' :
                      current ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                      {getStepDescription(step.key)}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className={`mt-2 px-2 py-1 rounded-full text-xs font-medium ${completed ? 'bg-green-100 text-green-700' :
                    current ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {completed ? 'Complete' : current ? 'In Progress' : 'Pending'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Next milestone:</span> {getDisplayLabel(getNextStep()?.label) || 'Completed'}
              </div>
              {progressData?.estimatedCompletion && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Est. completion:</span> {new Date(progressData.estimatedCompletion).toLocaleDateString()}
                </div>
              )}
            </div>

            {canAdvanceStatus() && (
              <button
                onClick={() => handleStatusUpdate(getNextStep()?.key)}
                disabled={loading}
                className="flex items-center space-x-2 bg-[#37a267] text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-b-transparent"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>Advance to {getDisplayLabel(getNextStep()?.label)}</span>
                  </>
                )}
              </button>
            )}

            {progressData?.status === 'completed' && (
              <div className="flex items-center space-x-2 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                <CheckCircle className="h-5 w-5" />
                <span>Tax Return Completed Successfully!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Client Information</h3>
            <Users className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="text-base font-medium text-gray-900">
                {progressData?.client?.name || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-base text-gray-700 break-all">
                {progressData?.client?.email || 'N/A'}
              </p>
            </div>
            <div className={progressData?.client?.userRole === 'MTD' ? "sm:col-span-2" : ""}>
              <p className="text-sm font-medium text-gray-500">Client ID</p>
              <p className="text-base font-mono text-gray-700">
                CL-{progressData?.client?.id?.toString().padStart(4, '0') || 'XXXX'}
              </p>
            </div>

            {progressData?.client?.userRole === 'MTD' && (
              <>
                <div className="sm:col-span-2 pt-4 border-t border-gray-100 mt-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Business Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Business Name</p>
                      <p className="text-sm text-gray-900">{progressData?.client?.businessName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Business Type</p>
                      <p className="text-sm text-gray-900">{progressData?.client?.businessType || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">UTR</p>
                      <p className="text-sm font-mono text-gray-900">{progressData?.client?.utr || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">NINO</p>
                      <p className="text-sm font-mono text-gray-900">{progressData?.client?.nino || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">MTD Status</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Gov Gateway</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                        progressData?.client?.govGatewayStatus === 'Yes' ? 'bg-green-100 text-green-800' : 
                        progressData?.client?.govGatewayStatus === 'No' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {progressData?.client?.govGatewayStatus || 'Pending'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Registered</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                        progressData?.client?.isRegisteredForMTD === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {progressData?.client?.isRegisteredForMTD || 'No'}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-500">Income Sources</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {progressData?.client?.incomeSources?.map((source: string, idx: number) => (
                          <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                            {source}
                          </span>
                        )) || <span className="text-sm text-gray-900">N/A</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Annual Turnover</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.annualTurnover || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Record Keeping</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.recordKeepingMethod || 'N/A'}</p>
                    </div>

                    {/* New MTD tracking fields */}
                    <div>
                      <p className="text-xs font-medium text-gray-500">MTD Submitted</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.prevSubmittedMTDThisYear || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Who Submitted</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.whoSubmittedQuarters || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Outstanding Subs</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.hasOutstandingMTDSubmissions || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Review Previous</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.reviewPreviousMTDSubmissions || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">1st Qtr Manage</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.firstQuarterToManage || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Gateway Credentials</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.hasGatewayCredentials || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Previous Software</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.previousMTDSoftware || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Other Income Sources</p>
                      <p className="text-sm text-gray-900 mt-1">{progressData?.client?.otherActiveIncomeSources || 'N/A'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-500">Submitted Quarters</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(Array.isArray(progressData?.client?.submittedQuarters) ? progressData.client.submittedQuarters : 
                          (typeof progressData?.client?.submittedQuarters === 'string' && progressData.client.submittedQuarters.startsWith('[') ? JSON.parse(progressData.client.submittedQuarters) : []))
                          .map((source: string, idx: number) => (
                          <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                            {source}
                          </span>
                        ))}
                        {(!progressData?.client?.submittedQuarters || progressData.client.submittedQuarters.length === 0) && <span className="text-sm text-gray-900">N/A</span>}
                      </div>
                    </div>
                    {/* End new MTD tracking fields */}

                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-500">Accountant Notes</p>
                      <p className="text-sm text-gray-900 mt-1 bg-gray-50 p-2 rounded border border-gray-100 italic">
                        {progressData?.client?.accountantNotes || (progressData as any)?.clientNotes || 'None provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Assignment Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Assignment Details</h3>
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {progressData?.accountant && (
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
                  {progressData?.accountant?.avatar || progressData?.accountant?.name?.charAt(0) || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 mb-1">Assigned Accountant</p>
                  <p className="text-base font-semibold text-gray-900 truncate">{progressData?.accountant?.name}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600 flex items-center">
                      <Mail className="h-3.5 w-3.5 mr-2 text-gray-400" />
                      <span className="truncate">{progressData?.accountant?.email}</span>
                    </p>
                    {progressData?.accountant?.mobile && (
                      <p className="text-sm text-gray-600 flex items-center">
                        <Phone className="h-3.5 w-3.5 mr-2 text-gray-400" />
                        <span>{progressData?.accountant?.mobile}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Assigned Date</p>
                <p className="text-base text-gray-700 font-medium">
                  {progressData?.assignedAt ? new Date(progressData?.assignedAt).toLocaleDateString() : 'Not assigned'}
                </p>
              </div>
              {progressData?.assignedAt && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-sm font-medium text-gray-500 mb-1">Days Since Assignment</p>
                  <p className="text-base text-gray-700 font-medium">
                    {Math.floor((new Date().getTime() - new Date(progressData.assignedAt).getTime()) / (1000 * 60 * 60 * 24))} days
                  </p>
                </div>
              )}
            </div>
            {progressData?.adminNotes && (
              <div className="mt-4 p-4 bg-amber-50/60 rounded-xl border border-amber-200/60 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="flex items-center space-x-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <p className="text-sm font-bold text-amber-800 tracking-wide uppercase">Assignment Notes</p>
                </div>
                <p className="text-sm text-gray-700 font-medium whitespace-pre-wrap leading-relaxed">
                  {progressData.adminNotes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Key Dates</h3>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Created</p>
              <p className="text-base text-gray-700">
                {progressData?.createdAt ? new Date(progressData.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Deadline</p>
              <p className={`text-base font-medium ${getDaysUntilDeadline() < 30 ? 'text-red-600' : 'text-gray-700'}`}>
                {progressData?.submissionDeadline ? new Date(progressData.submissionDeadline).toLocaleDateString() : 'Not set'}
              </p>
            </div>
            {progressData?.submissionDeadline && (
              <div className={`flex items-center space-x-2 p-3 rounded-lg ${getDaysUntilDeadline() < 7 ? 'bg-red-50 border border-red-200' :
                getDaysUntilDeadline() < 30 ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-green-50 border border-green-200'
                }`}>
                <AlertCircle className={`h-4 w-4 ${getDaysUntilDeadline() < 7 ? 'text-red-500' :
                  getDaysUntilDeadline() < 30 ? 'text-yellow-500' :
                    'text-green-500'
                  }`} />
                <span className={`text-sm font-medium ${getDaysUntilDeadline() < 7 ? 'text-red-700' :
                  getDaysUntilDeadline() < 30 ? 'text-yellow-700' :
                    'text-green-700'
                  }`}>
                  {getDaysUntilDeadline()} days remaining
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HorizontalProgressBar;