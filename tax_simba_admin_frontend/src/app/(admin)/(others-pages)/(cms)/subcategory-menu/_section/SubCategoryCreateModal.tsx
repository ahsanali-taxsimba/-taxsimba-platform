"use client";

import React, { useEffect, useState } from "react";
import {
  createSubCategory,
  updateSubCategory,
  type SubCategoryPayload,
  type SubCategory,
} from "@/lib/cms/subcategory";
import {
  getCategories,
  type Category,
  type CategoryListResponse,
} from "@/lib/cms/category";

interface SubCategoryCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;         // called after create
  onUpdated?: () => void;        // called after update
  mode: "create" | "edit";
  initialData?: SubCategory | null;
}

const SubCategoryCreateModal: React.FC<SubCategoryCreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onUpdated,
  mode,
  initialData,
}) => {
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isResource, setIsResource] = useState<"active" | "inactive">("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Load categories when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadCategories = async () => {
      try {
        setCatLoading(true);
        setCatError(null);

        const res = await getCategories({
          page: 1,
          limit: 100,
          isActive: true,
          isResource: true,
          sortBy: "displayOrder",
          sortOrder: "ASC",
        });

        const data = res.data as CategoryListResponse;
        setCategories(data.categories || []);
      } catch (err) {
        setCatError("Failed to load categories");
      } finally {
        setCatLoading(false);
      }
    };

    loadCategories();
  }, [isOpen]);

  // Prefill form in edit mode / reset in create mode
  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialData) {
      setCategoryId(String(initialData.categoryId));
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setIcon(initialData.icon || "");
      setDisplayOrder(String(initialData.displayOrder ?? 1));
      setStatus(initialData.isActive ? "active" : "inactive");
      setIsResource(initialData.isResource ? "active" : "inactive");
      setError(null);
    } else if (mode === "create") {
      setCategoryId("");
      setName("");
      setDescription("");
      setIcon("");
      setDisplayOrder("1");
      setStatus("active");
      setIsResource("active");
      setError(null);
    }
  }, [mode, initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId || !name.trim()) {
      setError("Category and Name are required");
      return;
    }

    const payload: SubCategoryPayload = {
      categoryId: Number(categoryId),
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      displayOrder: Number(displayOrder) || 0,
      isActive: status === "active",
      isResource: isResource === "active",
    };

    try {
      setLoading(true);
      setError(null);

      if (mode === "create") {
        await createSubCategory(payload);
        onCreated();
      } else if (mode === "edit" && initialData) {
        await updateSubCategory(initialData.id, payload);
        onUpdated && onUpdated();
      }

      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        `Failed to ${mode === "create" ? "create" : "update"} subcategory`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center p-4 z-999">
      <div className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-4 max-h-[90vh] overflow-y-auto p-4 md:p-6 rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Add SubCategory" : "Edit SubCategory"}
          </h2>
          <button
            type="button"
            onClick={onClose}
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

          {/* CATEGORY DROPDOWN */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Category <span className="text-danger">*</span>
            </label>
            <select
              className="w-full border p-2 rounded text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={catLoading}
            >
              <option value="">
                {catLoading ? "Loading categories..." : "Select category"}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {catError && (
              <p className="text-xs text-red-600 mt-1">{catError}</p>
            )}
          </div>

          {/* NAME */}
          <div>
            <label className="block text-sm font-medium mb-1">
              SubCategory Name <span className="text-danger">*</span>
            </label>
            <input
              className="w-full border p-2 rounded text-sm"
              placeholder="SubCategory Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              className="w-full border p-2 rounded text-sm"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* ICON */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Icon (emoji or text)
            </label>
            <input
              className="w-full border p-2 rounded text-sm"
              placeholder="e.g. 💰"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
            />
          </div>

          {/* ORDER + STATUS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Display Order
              </label>
              <input
                type="number"
                className="w-full border p-2 rounded text-sm"
                placeholder="Display Order"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                className="w-full border p-2 rounded text-sm"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "inactive")
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Resource
              </label>
              <select
                className="w-full border p-2 rounded text-sm"
                value={isResource}
                onChange={(e) =>
                  setIsResource(e.target.value as "active" | "inactive")
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 border rounded text-sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-[#37a267] text-white rounded text-sm disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading
                ? mode === "create"
                  ? "Creating..."
                  : "Updating..."
                : mode === "create"
                  ? "Create"
                  : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubCategoryCreateModal;
