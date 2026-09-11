'use client';
import React from 'react';
import { Modal } from '@/components/ui/modal'; // Assuming you have a reusable Modal component
import Button from '@/components/ui/button/Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  confirmationText?: string;
  confirmBtnText?: string;
  isDanger?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = "Confirm Action",
  confirmationText = "Are you sure you want to proceed?",
  confirmBtnText = "Confirm",
  isDanger = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} className="max-w-md p-0 overflow-hidden comman-main-modal">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
          {title}
        </h3>
      </div>

      {/* Modal Body */}
      <div className="p-8 text-center">
        <p className="text-base mb-0 leading-relaxed text-gray-600 dark:text-gray-400">
          {confirmationText}
        </p>
      </div>

      {/* Modal Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 p-6 dark:border-gray-800">
        <Button
          onClick={onConfirm}
          className={`main-btn ${isDanger ? "!bg-red-500 !border-red-500 hover:!opacity-90" : ""}`}
        >
          {confirmBtnText}
        </Button>
        <button
          onClick={onCancel}
          className="dlete-btn"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
