import { CheckCircle, Clock, DollarSign, FileText, User } from "lucide-react";
import { GenerateEmailBodyParams } from "./interface";

  export const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  export const statusMapping = {
  'pending': 'pending_assignment',
  'assigned': 'assigned',
  'progress': 'in_progress',
  'draft': 'draft_ready',
  'review': 'client_review',
  'approved': 'approved',
  'submitted': 'submitted',
  'completed': 'completed'
};

// Reverse mapping for UI display
export const uiStatusMapping = {
  'pending_assignment': 'pending',
  'assigned': 'assigned',
  'in_progress': 'progress',
  'draft_ready': 'draft',
  'client_review': 'review',
  'approved': 'approved',
  'submitted': 'submitted',
  'completed': 'completed'
};
export   const statusSteps = [
    { 
      key: 'pending_assignment', 
      label: 'Assigned Pending', 
      icon: User,
      description: 'Assigned Tax Professional Pending',
      color: 'orange'
    },
    { 
      key: 'assigned', 
      label: 'Assigned', 
      icon: User,
      description: 'Assigned to tax professional',
      color: 'blue'
    },
    { 
      key: 'preparation_started', 
      label: 'In Progress', 
      icon: Clock,
      description: 'Tax return preparation in progress',
      color: 'blue'
    },
    { 
      key: 'draft_ready', 
      label: 'Review', 
      icon: FileText,
      description: 'Draft ready for client review',
      color: 'yellow'
    },
    { 
      key: 'completed', 
      label: 'Completed', 
      icon: CheckCircle,
      description: 'Tax return filed successfully',
      color: 'green'
    }
  ];
const toListHtml = (docList?: string | string[]) =>
  Array.isArray(docList)
    ? `<ul style="margin:0;padding-left:18px">${docList
        .map(item => `<li>${item}</li>`)
        .join('')}</ul>`
    : docList ?? '';

const formatDeadline = (d?: string | Date) =>
  d instanceof Date ? d.toLocaleDateString() : d ?? '';
export const generateEmailBody = (params: GenerateEmailBodyParams): string => {
  const {
    emailBody,
    clientName,
    documentList,
    deadline,
    additionalNotes,
    accountantName,
    accountantEmail,
  } = params;

  let body = `<p style="font-size: 16px; margin-bottom: 20px; color: #333;"><strong>Dear ${clientName || '{{clientName}}'},</strong></p>`;

  body += `<div style="margin: 25px 0; line-height: 1.8; color: #666; font-size: 16px;">
    ${emailBody || '{{messageContent}}'}
  </div>`;

  const docsHtml = toListHtml(documentList);
  if (docsHtml) {
    body += `<div style="background: #f8f9fa; padding: 20px; margin: 25px 0; border-left: 4px solid #667eea; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #333; font-size: 18px;">Required Documents:</h3>
      <div style="margin-bottom: 0; color: #555;">${docsHtml}</div>
    </div>`;
  }

  const deadlineText = formatDeadline(deadline);
  if (deadlineText) {
    body += `<div style="background: #fff3cd; padding: 15px; margin: 25px 0; border-radius: 4px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;"><strong>⏰ Deadline:</strong> ${deadlineText}</p>
    </div>`;
  }

  if (additionalNotes) {
    body += `<div style="margin: 25px 0; padding: 20px; background: #e3f2fd; border-radius: 4px;">
      <h4 style="color: #1976d2; margin-top: 0;">💡 Additional Notes:</h4>
      <div style="color: #0d47a1; margin-bottom: 0;">${additionalNotes}</div>
    </div>`;
  }

  body += `<div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
    <p style="color: #666;">If you have any questions, please don't hesitate to contact me.</p>
    <p style="color: #333;">
      Best regards,<br>
      <strong>${accountantName || '{{accountantName}}'}</strong><br>
      <span style="color: #667eea;">${accountantEmail || '{{accountantEmail}}'}</span>
    </p>
  </div>`;

  return body;
};

