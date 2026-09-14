"use client";

import React from "react";
import type { SubCategory } from "@/lib/cms/subcategory";
import { Modal } from "@/components/ui/modal";
import Badge from "@/components/ui/badge/Badge";
import { Calendar, Tag, Info, Layers, ListOrdered, Layers2, FileText, CheckCircle2 } from "lucide-react";

interface ViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SubCategory | null;
}

const SubCategoryViewModal: React.FC<ViewModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!data) return null;

  const category = (data as any).category;
  const articles = (data as any).articles as any[] | undefined;

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[700px] p-0 overflow-hidden"
    >
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#37a267] to-[#45b67d] p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Layers2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Subcategory Details</h2>
            <p className="text-white/80 text-sm">Full professional overview of this subcategory</p>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-6 md:p-8 bg-white dark:bg-gray-900 overflow-y-auto max-h-[75vh]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DetailIcon icon={<Tag className="w-4 h-4" />} label="Subcategory Name" value={data.name} />
          <DetailIcon icon={<Layers2 className="w-4 h-4" />} label="Slug" value={(data as any).slug ?? "-"} />
          
          <DetailIcon 
            icon={<Layers className="w-4 h-4" />} 
            label="Parent Category" 
            value={category ? `${category.name} (${category.slug})` : (data as any).categoryId ?? "-"} 
          />
          <DetailIcon icon={<ListOrdered className="w-4 h-4" />} label="Display Order" value={data.displayOrder ?? "-"} />

          <div className="md:col-span-2">
            <DetailIcon 
               icon={<Info className="w-4 h-4" />} 
               label="Description" 
               value={data.description || "No description provided."} 
               fullWidth
            />
          </div>
          
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                 Status
              </p>
              <Badge color={(data as any).isActive ? "success" : "light"} size="md">
                {(data as any).isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                 Is Resource
              </p>
              <Badge color={(data as any).isResource ? "primary" : "light"} size="md">
                {(data as any).isResource ? "Yes" : "No"}
              </Badge>
            </div>
          </div>

          <div className="md:col-span-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Articles Linked
            </p>
            {Array.isArray(articles) && articles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {articles.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate pr-2">
                        {a.title}
                      </p>
                      <CheckCircle2 className={`w-4 h-4 ${a.isPublished ? 'text-green-500' : 'text-gray-300'}`} />
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono">{a.slug}</p>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">No articles linked to this subcategory</span>
            )}
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
            <DetailIcon icon={<Calendar className="w-4 h-4" />} label="Created On" value={formatDate((data as any).createdAt)} />
            <DetailIcon icon={<Calendar className="w-4 h-4" />} label="Last Updated" value={formatDate((data as any).updatedAt)} />
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
    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
      {value}
    </div>
  </div>
);

export default SubCategoryViewModal;
