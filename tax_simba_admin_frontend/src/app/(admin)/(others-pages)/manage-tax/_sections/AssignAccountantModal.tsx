"use client";

import clientAxios from "@/lib/axios-client";
import { Accountant, TaxReturnData } from "@/utils/interface";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

const AssignAccountantModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  fileId: number | null;
  setTaxReturns: React.Dispatch<React.SetStateAction<TaxReturnData[]>>;
}> = ({ isOpen, onClose, fileId, setTaxReturns }) => {
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [selectedAccountant, setSelectedAccountant] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [deadlineError, setDeadlineError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
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
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    setDeadlineError('');
    if (!selectedAccountant || !fileId) return;

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
      const res = await clientAxios.post('/admin/assign', {
        taxReturnId: fileId,
        accountantId: selectedAccountant,
        notes,
        priority,
        deadline: deadline || null
      });

      console.log('Assignment response:', res.data);
      const response = await clientAxios.post('/admin/tax-return/files', {});
      setTaxReturns(response.data?.data ?? []);
      
      onClose();
      // Reset form
      setSelectedAccountant(null);
      setNotes('');
      setPriority('medium');
      setDeadline('');
    } catch (err) {
      console.error('Assignment failed:', err);
      alert('Failed to assign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[500px] p-6 z-[9999]"
    >
      <h4 className="font-semibold text-gray-800 mb-6 text-lg dark:text-white/90">
        Assign to Accountant
      </h4>

      {loading ? (
        <p>Loading accountants...</p>
      ) : (
        <>
          {/* Accountant Dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Select Accountant</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#37a267] focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              value={selectedAccountant || ''}
              onChange={(e) => setSelectedAccountant(Number(e.target.value))}
            >
              <option value="">-- Choose an accountant --</option>
              {accountants.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.email})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#37a267] focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Priority</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#37a267] focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium (default)</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Deadline */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Deadline (optional)</label>
            <input
              type="date"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#37a267] focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white ${deadlineError ? 'border-red-500' : 'border-gray-300'}`}
              value={deadline}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => {
                setDeadline(e.target.value);
                setDeadlineError('');
              }}
            />
            {deadlineError && <p className="text-red-500 text-xs mt-1">{deadlineError}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 disabled:opacity-60"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-[#37a267] text-white rounded text-sm disabled:opacity-60"
              onClick={handleAssign}
              disabled={!selectedAccountant || submitting}
            >
              {submitting ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default AssignAccountantModal;