"use client";

import React, { useEffect, useState } from "react";
import {
  createCategory,
  updateCategory,
  type CategoryPayload,
  type Category,
} from "@/lib/cms/category";

interface CategoryCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;         // called after successful create / update
  editingCategory?: Category | null; // 👈 NEW: if present → Edit mode
}

const CategoryCreateModal: React.FC<CategoryCreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  editingCategory,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [displayOrder, setDisplayOrder] = useState<string>("1");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isResource, setIsResource] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editingCategory;

  const resetForm = () => {
    setName("");
    setDescription("");
    setIcon("");
    setDisplayOrder("1");
    setIsActive(true);
    setError(null);
  };

  // 🔁 Prefill when editing / reset when creating
  useEffect(() => {
    if (!isOpen) return;

    if (editingCategory) {
      setName(editingCategory.name ?? "");
      setDescription(editingCategory.description ?? "");
      setIcon(editingCategory.icon ?? "");
      setDisplayOrder(String(editingCategory.displayOrder ?? "1"));
      setIsActive(!!editingCategory.isActive);
      setIsResource(!!editingCategory.isResource);
      setError(null);
    } else {
      resetForm();
    }
  }, [isOpen, editingCategory]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const payload: CategoryPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      displayOrder: Number(displayOrder) || 0,
      isActive,
      isResource,
    };

    try {
      setSubmitting(true);
      setError(null);

      if (isEdit && editingCategory) {
        // ✏️ UPDATE
        await updateCategory(editingCategory.id, payload);
      } else {
        // ➕ CREATE
        await createCategory(payload);
      }

      resetForm();
      onCreated();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          `Failed to ${isEdit ? "update" : "create"} category`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-4 max-h-[90vh] overflow-y-auto p-4 md:p-6 rounded-xl bg-white shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Category" : "Add New Category"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="e.g. Tax News"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Short description about this category"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Icon (emoji or icon text)
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="e.g. 📚"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Display Order
              </label>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* Status dropdown */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Resource
              </label>
              <select
                value={isResource ? "active" : "inactive"}
                onChange={(e) => setIsResource(e.target.value === "active")}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#37a267] px-4 py-2 text-sm font-medium text-white hover:bg-[#37a267] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting
                ? isEdit
                  ? "Updating..."
                  : "Creating..."
                : isEdit
                ? "Update Category"
                : "Create Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryCreateModal;
