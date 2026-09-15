"use client";

import React from "react";
import type { Category } from "@/lib/cms/category";
import { Modal } from "@/components/ui/modal";
import Badge from "@/components/ui/badge/Badge";
import { Calendar, Tag, Info, Layers, ListOrdered, Layers2 } from "lucide-react";

interface CategoryViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Category | null;
}

const CategoryViewModal: React.FC<CategoryViewModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!data) return null;

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const subCategories = data.subCategories?.length
    ? data.subCategories.map((s) => s.name)
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px] p-0 overflow-hidden"
    >
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#37a267] to-[#45b67d] p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Category Details</h2>
            <p className="text-white/80 text-sm">View full information for this category</p>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-6 md:p-8 bg-white dark:bg-gray-900 overflow-y-auto max-h-[70vh]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DetailIcon icon={<Tag className="w-4 h-4" />} label="Category Name" value={data.name} />
          <DetailIcon icon={<Layers2 className="w-4 h-4" />} label="Slug" value={data.slug ?? "-"} />
          
          <div className="md:col-span-2">
            <DetailIcon 
               icon={<Info className="w-4 h-4" />} 
               label="Description" 
               value={data.description || "No description provided."} 
               fullWidth
            />
          </div>

          <DetailIcon icon={<ListOrdered className="w-4 h-4" />} label="Display Order" value={data.displayOrder} />
          
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
               Status
            </p>
            <Badge color={data.isActive ? "success" : "light"} size="md">
              {data.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="md:col-span-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Subcategories
            </p>
            <div className="flex flex-wrap gap-2">
              {subCategories.length > 0 ? (
                subCategories.map((name, i) => (
                  <Badge key={i} color="primary" variant="light" size="sm">
                    {name}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-gray-400 italic">No subcategories linked</span>
              )}
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs">
            <DetailIcon icon={<Calendar className="w-3 h-3" />} label="Created On" value={formatDate(data.createdAt)} />
            <DetailIcon icon={<Calendar className="w-3 h-3" />} label="Last Updated" value={formatDate(data.updatedAt)} />
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

const DetailIcon = ({
  icon,
  label,
  value,
  fullWidth = false
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) => (
  <div className={fullWidth ? "w-full" : ""}>
    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
      {icon} {label}
    </p>
    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
      {value}
    </p>
  </div>
);

export default CategoryViewModal;
