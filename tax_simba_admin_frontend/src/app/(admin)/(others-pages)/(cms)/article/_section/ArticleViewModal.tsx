"use client";

import React from "react";
import type { Article } from "@/lib/cms/article";
import { Modal } from "@/components/ui/modal";
import Badge from "@/components/ui/badge/Badge";
import { FileText, Tag, Layers, CheckCircle2, Star, ListOrdered, Image as ImageIcon, Calendar } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: Article | null;
}

const ArticleViewModal: React.FC<Props> = ({ isOpen, onClose, data }) => {
  if (!data) return null;

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[800px] p-0 overflow-hidden"
    >
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-[#37a267] to-[#45b67d] p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Article Details</h2>
            <p className="text-white/80 text-sm">Full content and metadata overview</p>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-6 md:p-8 bg-white dark:bg-gray-900 overflow-y-auto max-h-[80vh]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 space-y-6">
             <DetailIcon icon={<Tag className="w-4 h-4" />} label="Title" value={data.title} fullWidth />
             
             <div className="grid grid-cols-2 gap-4">
               <DetailIcon icon={<Layers className="w-4 h-4" />} label="Category ID" value={data.categoryId} />
               <DetailIcon icon={<Layers className="w-4 h-4" />} label="SubCategory ID" value={data.subCategoryId ?? "Direct Category"} />
             </div>

             <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Excerpt
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 italic">
                  {data.excerpt || "No excerpt provided."}
                </p>
             </div>
          </div>

          <div className="space-y-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
             <DetailIcon icon={<ListOrdered className="w-4 h-4" />} label="Display Order" value={data.displayOrder ?? 0} />
             
             <div className="space-y-3">
               <div>
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <Badge color={data.isPublished ? "success" : "light"} size="md">
                    {data.isPublished ? "Published" : "Draft"}
                  </Badge>
               </div>
               <div>
                  <p className="text-xs text-gray-400 mb-1">Visibility</p>
                  <Badge color={data.isFeatured ? "warning" : "light"} size="md">
                    {data.isFeatured ? "Featured" : "Standard"}
                  </Badge>
               </div>
             </div>

             <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-400 mb-2 truncate">Feature Image URL</p>
                <p className="text-[10px] break-all text-blue-600">{data.featuredImage || "None"}</p>
             </div>
          </div>

          <div className="md:col-span-3 pt-6 border-t border-gray-100 dark:border-gray-800">
             <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2 text-[#37a267]">
               <FileText className="w-4 h-4" /> Full Content
             </p>
             <div 
               className="prose prose-sm max-w-none dark:prose-invert bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl shadow-inner min-h-[150px]"
               dangerouslySetInnerHTML={{ __html: data.content || "<p className='text-gray-400 italic'>No content available.</p>" }}
             />
          </div>

          <div className="md:col-span-3 grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
             <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>Created: {formatDate((data as any).createdAt)}</span>
             </div>
             <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>Updated: {formatDate((data as any).updatedAt)}</span>
             </div>
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
    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-2">
      {icon} {label}
    </p>
    <div className="text-base font-bold text-gray-800 dark:text-gray-200 leading-relaxed">
      {value}
    </div>
  </div>
);

export default ArticleViewModal;
