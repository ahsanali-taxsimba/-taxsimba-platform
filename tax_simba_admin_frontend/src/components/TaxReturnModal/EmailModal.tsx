import React, { useState, useEffect } from 'react';
import { X, Mail, Send, RefreshCw } from 'lucide-react';

interface EmailTemplate {
  id: number;
  name: string;
  templateContent: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  availablePlaceholders: string[];
}

interface Client {
  id: number;
  name: string;
  email: string;
}

interface TaxReturn {
  taxReturnId: string;
  taxYear: string;
  client: Client;
}

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (emailData: {
    subject: string;
    htmlContent: string;
    documentList?: string;
    templateId?: number;
  }) => Promise<void>;
  taxReturn: TaxReturn | null;
  fetchEmailTemplate: () => Promise<any>;
}

const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  onSend,
  taxReturn,
  fetchEmailTemplate
}) => {
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate | null>(null);
  const [emailTemplateLoading, setEmailTemplateLoading] = useState(false);
  const [emailBody, setEmailBody] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [documentList, setDocumentList] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplate();
    }
  }, [isOpen]);

  const loadTemplate = async () => {
    setEmailTemplateLoading(true);
    setError(null);
    try {
      const response = await fetchEmailTemplate();
      if (response.success && response.data?.template) {
        setEmailTemplate(response.data.template);
      } else {
        setError('Failed to load email template');
      }
    } catch (err) {
      setError('Error loading email template');
      console.error('Error loading template:', err);
    } finally {
      setEmailTemplateLoading(false);
    }
  };

  const handleSend = async () => {
    if (!taxReturn || !emailTemplate || !emailBody.trim() || !emailSubject.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const finalEmailContent = generateEmailBody();

      await onSend({
        subject: emailSubject,
        htmlContent: finalEmailContent,
        documentList: documentList || '',
        templateId: emailTemplate.id
      });

      // Reset form on successful send
      setEmailBody('');
      setEmailSubject('');
      setDocumentList('');
      setError(null);
    } catch (err) {
      setError('Failed to send email');
      console.error('Error sending email:', err);
    }
  };

  // Update generateEmailBody to NOT include the client greeting (template will handle this)
  const generateEmailBody = () => {
    let body = '';

    // Add the main message content with proper HTML formatting
    if (emailBody && emailBody.trim()) {
      // Convert line breaks to proper HTML paragraphs
      const formattedMessage = emailBody
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p style="margin-bottom: 15px; color: #666; font-size: 16px; line-height: 1.6;">${line}</p>`)
        .join('');

      body += formattedMessage;
    } else {
      body += `<p style="margin-bottom: 15px; color: #666; font-size: 16px; line-height: 1.6;">We are writing to you regarding your tax return.</p>`;
    }

    // Add document list if provided
    if (documentList && documentList.trim()) {
      const formattedDocuments = documentList
        .split('\n')
        .map(doc => doc.trim())
        .filter(doc => doc.length > 0)
        .map(doc => doc.startsWith('•') || doc.startsWith('-') || doc.startsWith('*') ? doc : `• ${doc}`)
        .join('<br/>');

      body += `<div style="background: #f8f9fa; padding: 20px; margin: 25px 0; border-left: 4px solid #667eea; border-radius: 8px;">
      <h3 style="margin-top: 0; margin-bottom: 15px; color: #333; font-size: 18px; font-weight: 600;">Required Documents:</h3>
      <div style="color: #555; font-size: 15px; line-height: 1.8;">${formattedDocuments}</div>
    </div>`;
    }

    return body;
  };

  // Update generateFinalEmail for preview to show what the final email will look like
  const generateFinalEmail = () => {
    if (!emailTemplate) return '';

    const currentDate = new Date().toLocaleDateString();
    const clientName = taxReturn?.client?.name || 'Valued Client';
    const body = generateEmailBody();

    const templateContent = typeof emailTemplate === 'string'
      ? emailTemplate
      : emailTemplate.templateContent;

    return templateContent
      .replace(/\{\{currentDate\}\}/g, currentDate)
      .replace(/\{\{clientName\}\}/g, clientName)
      .replace(/\{\{body\}\}/g, body)
      .replace(/\{\{appName\}\}/g, 'TaxSimba')
      .replace(/\{\{supportEmail\}\}/g, 'support@taxsimba.com')
      .replace(/\{\{currentYear\}\}/g, new Date().getFullYear().toString());
  };

  const handleClose = () => {
    setError(null);
    setEmailBody('');
    setEmailSubject('');
    setDocumentList('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Email Client</h3>
                <p className="text-sm text-gray-500">
                  To: {taxReturn?.client?.name} (Client-{taxReturn?.client?.id?.toString().padStart(4, "0") || 'XXXX'})
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {emailTemplateLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading email template...</p>
            </div>
          ) : emailTemplate ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Tax Return Update - ${taxReturn?.taxReturnId || ''}`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message Content *
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={5}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Write your message here..."
                    required
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}
              </div>

              {/* Preview Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Email Preview
                  </label>
                  <button
                    onClick={loadTemplate}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </button>
                </div>
                <div
                  className="border border-gray-300 rounded-md p-4 h-96 overflow-y-auto bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: generateFinalEmail() }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Unable to load email template</p>
              <button
                onClick={loadTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center mx-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {emailBody.trim() && documentList.trim() ?
                'Email includes message content and document list' :
                emailBody.trim() ? 'Email includes message content' :
                  'Please add message content'}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!emailTemplate || emailTemplateLoading || !emailBody.trim() || !emailSubject.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>Send Email</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailModal;