'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import Button from '@/components/ui/button/Button';
import clientAxios from '@/lib/axios-client';
import { mapTaxReturnListPayload } from '@/lib/mapTaxReturnList';
import DatePicker from '@/components/form/date-picker';
import { toast } from 'react-toastify';
import { asStringId } from '@/lib/stringId';

interface Accountant {
  id: string;
  name: string;
  email: string;
}

interface AssignAccountantModalProps {
  fileId: string | null;
  isOpen: boolean;
  onClose: () => void;
  setTaxReturns: React.Dispatch<React.SetStateAction<any>>;
}

const AssignAccountantModal: React.FC<AssignAccountantModalProps> = ({
  fileId,
  isOpen,
  onClose,
  setTaxReturns,
}) => {
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [selectedAccountant, setSelectedAccountant] = useState<string>('');
  const [selectionError, setSelectionError] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [deadlineError, setDeadlineError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedAccountant('');
      setSelectionError('');
      fetchAccountants();
    }
  }, [isOpen]);

  const fetchAccountants = async () => {
    setLoading(true);
    try {
      const res = await clientAxios.post('/admin/accountants', {});
      const data = res?.data?.data?.accountants || res?.data?.data;
      setAccountants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch accountants', error);
      setAccountants([]);
      toast.error('Failed to load accountants.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    setDeadlineError('');
    setSelectionError('');
    if (!selectedAccountant) {
      setSelectionError('Please select an accountant.');
      toast.error('Please select an accountant.');
      return;
    }
    if (!fileId) {
      toast.error('Missing tax return to assign.');
      return;
    }

    if (deadline) {
      const selected = new Date(deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) {
        setDeadlineError('Deadline cannot be in the past');
        return;
      }
    }

    setSubmitting(true);
    try {
      const caseId = asStringId(fileId);
      const accountantId = asStringId(selectedAccountant);
      if (!caseId || !accountantId) {
        toast.error('Invalid case or accountant identifier.');
        setSubmitting(false);
        return;
      }
      await clientAxios.post('/admin/assign', {
        taxReturnId: caseId,
        accountantId,
        notes,
        priority,
        deadline: deadline || null,
      });

      const response = await clientAxios.post('/admin/tax-return/files', {});
      setTaxReturns(mapTaxReturnListPayload(response.data?.data));
      toast.success('Case assigned to accountant successfully.');
      onClose();
    } catch (err: any) {
      console.error(' Assignment failed:', err);
      toast.error(err?.response?.data?.message || 'Failed to assign accountant.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px] p-5 lg:p-10 z-[1000]"
    >
      <h4 className="font-semibold text-gray-800 mb-6 text-title-sm dark:text-white/90">
        Assign to Accountant
      </h4>

      {loading ? (
        <p className="text-slate-800 dark:text-slate-100">Loading accountants...</p>
      ) : (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Select Accountant
            </label>
            <select
              className="w-full border rounded px-3 py-2 text-sm text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600"
              value={selectedAccountant}
              onChange={(e) => {
                setSelectedAccountant(String(e.target.value));
                setSelectionError('');
              }}
              data-testid="assign-accountant-select"
            >
              <option value="">-- Choose an accountant --</option>
              {accountants.map((acc) => (
                <option key={acc.id} value={String(acc.id)}>
                  {acc.name} ({acc.email})
                </option>
              ))}
            </select>
            {selectionError && (
              <p className="text-red-500 text-xs mt-1" data-testid="assign-accountant-error">
                {selectionError}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Priority
            </label>
            <select
              className="w-full border rounded px-3 py-2 text-sm text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium (default)</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="mb-6">
            <DatePicker
              id="deadline-picker"
              label="Deadline (optional)"
              defaultDate={deadline ? new Date(deadline) : undefined}
              minDate="today"
              onChange={(selectedDates) => {
                setDeadlineError('');
                if (selectedDates && selectedDates.length > 0) {
                  const date = selectedDates[0];
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, '0');
                  const d = String(date.getDate()).padStart(2, '0');
                  setDeadline(`${y}-${m}-${d}`);
                } else {
                  setDeadline('');
                }
              }}
              placeholder="Select a date"
            />
            {deadlineError && <p className="text-red-500 text-xs mt-1">{deadlineError}</p>}
          </div>

          <div className="flex justify-end gap-3">
            <Button size="sm" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#37a267] hover:bg-[#37a267]"
              onClick={handleAssign}
              disabled={submitting}
            >
              {submitting ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default AssignAccountantModal;
