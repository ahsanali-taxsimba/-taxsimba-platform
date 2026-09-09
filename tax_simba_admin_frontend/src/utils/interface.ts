import { ReactNode } from "react";

export interface Client {
  surname: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
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
  submittedQuarters?: string[];
  whoSubmittedQuarters?: string;
  hasOutstandingMTDSubmissions?: string;
  reviewPreviousMTDSubmissions?: string;
  firstQuarterToManage?: string;
  hasGatewayCredentials?: string;
  previousMTDSoftware?: string;
  otherActiveIncomeSources?: string;
}

export interface Assignment {
  id: string;
  title: string;
  client: Client;
  type: 'consultation' | 'tax_preparation' | 'review' | 'filing' | 'follow_up';
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  location?: string;
  isVirtual: boolean;
  meetingLink?: string;
  notes?: string;
  documents?: string[];
  taxYear?: string;
  estimatedValue?: number;
  createdAt: string;
  updatedAt: string;
  taxReturnFiles?: TaxReturnFile[]; // Add this line
  assignedTo?: string; // Track who the assignment is assigned to
}

export interface TaxReturnFile {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  status: 'pending' | 'assigned' | 'in_review' | 'completed';
  assignedTo?: string;
}


export interface AvailabilitySettings {
  workingDays: number[]; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  lunchBreak?: {
    startTime: string;
    endTime: string;
  };
  timeSlotDuration: number; // in minutes
  bufferTime: number; // in minutes between appointments
}

export interface TaxReturnAssignment {
  id: number;
  taxReturnId: string;
  taxYear: number;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedAt?: string;
  mtdQuarter?: string;
  mtdQuarterDueDate?: string;
  createdAt: string;
  client?: {
    id: number;
    name: string;
    surname: string;
    email: string;
    userRole?: string;
  };
  TaxReturnType?: {
    typeName: string;
    typeCode: string;
  };
  documents?: Array<{
    createdAt: string | number | Date;
    id: number;
    documentType: string;
    documentCategory: string;
    originalFileName: string;
    cloudinaryUrl: string;
    fileSize: number;
    mimeType: string;
    uploadStatus: string;
  }>;
}

export interface CalendarAssignment {
  id: string;
  title: string;
  type: 'consultation' | 'tax_preparation' | 'review' | 'filing' | 'follow_up';
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  client: {
    name: string;
    email: string;
    phone?: string;
  };
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  location?: string;
  isVirtual: boolean;
  meetingLink?: string;
  notes?: string;
  documents?: string[];
  estimatedValue?: number;
}

export interface TaxReturnType {
  typeName: string;
  typeCode: string;
}

export interface TaxReturn {
  id: number;
  taxReturnId: string;
  taxYear: number;
  status: string;
  mtdQuarter?: string;
  mtdQuarterDueDate?: string;
  client: Client;
  type: TaxReturnType;
  accountant?: {
    id: number;
    name: string;
    email: string;
  };
}

export  interface Review {
    [x: string]: ReactNode;
    id: number;
    clientName: string;
    rating: number;
    comment: string;
    date: string;
    responded: boolean;
    response?: string;
  }


export interface FileItem {
  id: number;
  filename: string;
  documentType: string; 
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
  uploadStatus: string;
  isRequired: boolean; 
  uploadedBy: number;  
  uploadedAt: string;
  updatedAt: string;    
  thumbnailUrl: string | null;
  previewUrl: string | null;
  downloadUrl: string;
}

export interface FileCategories {
  [key: string]: {
    [key: string]: FileItem[];
  };
}

export interface FilesData {
  totalFiles: number;
  totalSize: number;
  requiredFiles: number;        
  completedFiles: number;      
  pendingFiles: number;        
  completionPercentage: number; 
  categories: FileCategories;
  allFiles: FileItem[];
}

export interface Accountant {
  id: number;
  name: string;
  email: string;
}

export interface AdminTaxReturnDetailsProps {
  taxReturnId: string;
}

interface File {
  id: number;
  filename: string;
  documentType: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
  uploadStatus: string;
  isRequired: boolean;
  uploadedBy: number;
  uploadedAt: string;
  updatedAt: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  downloadUrl: string;
}


export interface UploadedFilesDetailsProps {
  taxReturn: TaxReturn;
  files: FilesData;
}

export interface TaxReturnData {
  taxReturn: {
    accountant: any;
    id: number;
    taxReturnId: string;
    taxYear: number;
    status: string;
    mtdQuarter?: string;
    mtdQuarterDueDate?: string;
    client: {
      id: number;
      name: string;
      surname: string;
      email: string;
    };
  };
  files: {
    allFiles: {
      id: number;
      filename: string;
      documentType: string;
      fileSize: number;
      mimeType: string;
      uploadStatus: string;
      uploadedAt: string;
      cloudinaryUrl: string;
      downloadUrl: string;
    }[];
  };
}
type StatusStep = {
  key: string;
  label: string;
  completed: boolean;
};

type StatusMapping = {
  [key: string]: any;
};

export interface ProgressStatusComponentProps {
  statusSteps: StatusStep[];
  currentStatus: string;
  statusMapping: StatusMapping;
  userRole: string;
  loading: boolean;
  error?: string;
  handleStatusUpdate: (key: string) => void;
}

export interface TaxReturnDocument {
  id: number;
  taxReturnId: number;
  documentType: string;
  documentCategory: string;
  originalFileName: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
  uploadStatus: string;
  uploadedBy: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}



export interface ApiResponse {
  success: boolean;
  data?: {
    accountantId: number;
    assignments: TaxReturnAssignment[];
  };
}

export type GenerateEmailBodyParams = {
  emailBody?: string;
  clientName?: string;
  documentList?: string | string[]; 
  deadline?: string | Date;
  additionalNotes?: string;
  accountantName?: string;
  accountantEmail?: string;
};

export type EmailTemplate = {
    id: string;
    templateContent: string;
    [key: string]: any; 
      availablePlaceholders: string[];
  };





export interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  setShowFinalCertificateModal: (value: boolean) => void;
  onSend: (emailData: {
    to: string;
    subject: string;
    htmlContent: string;
    taxReturnId: string;
    templateId?: string;
  }) => Promise<void>;
  taxReturn: TaxReturn | null;
  fetchEmailTemplate: () => Promise<EmailTemplate | null>;
}

export interface DraftUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxReturnId: string;
  onUploadSuccess: (data: UploadSuccessData) => void;
  fetchProgressData: () => void;
}

export interface DownloadCertificateProps {
  isOpen: boolean;
  onClose: () => void;
  taxReturnId: string;
  onUploadSuccess: (data: UploadSuccessData) => void;
  fetchProgressData: () => void;
  postProgressData: (data: string) => void;
  setShowFinalCertificateModal: (value: boolean) => void;
}

export interface UploadSuccessData {
  message: string;
  file: string;
  type: string;
}

export interface DraftUploadResponse {
  success: boolean;
  message: string;
  data: {
    taxReturn: {
      id: string;
      taxReturnId: string;
      status: string;
      accountantNotes: string | null;
      clientNotes: string | null;
    };
    draftDocument: {
      id: string;
      filename: string;
      url: string;
      fileSize: number;
      uploadedAt: Date;
    };
    recommendedActions: string[];
    nextStep: string;
    notifications: {
      clientNotified: boolean;
      emailSent: boolean;
    };
  };
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ComponentState {
  selectedFile: File | null;
  draftType: string;
  notes: string;
  uploading: boolean;
  uploadProgress: number;
  error: string;
  dragOver: boolean;
}


export interface TaxReturnMetrics {
  month: string;
  totalReturns: number;
  newReturns?: number;
  pendingCount: number;
  completed: number;
  assigned: number;
  payments: number;
}

export interface DashboardSummary {
  totalReturns: number;
   pendingCount: number;
  completed: number;
  assigned: number;
  payments: number;
  period: string;
}

export interface StatusDistribution {
  labels: string[];
  series: number[];
  total: number;
}

export interface AccountantStats {
  assignedReturns: number;
  completedReturns: number;
  inProgressReturns: number;
  averageCompletionDays: number;
  completionRate: string;
  monthlyCompleted: TaxReturnMetrics[];
}

export interface DashboardData {
  yearlyMetrics: TaxReturnMetrics[];
  summary: DashboardSummary;
  statusDistribution: StatusDistribution;
  accountantStats?: AccountantStats; 
}