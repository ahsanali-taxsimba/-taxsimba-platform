"use client";

import React from "react";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { Edit, Trash2, Eye } from "lucide-react";
import { EyeIcon, PencilIcon, TrashBinIcon } from "@/icons";

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type Column<T> = {
  header: string;
  // how to render this column for a given row
  render: (row: T) => React.ReactNode;
};

interface Props<T extends { id: number | string; isActive?: boolean }> {
  categories: T[];
  loading: boolean;
  error: string | null;
  pagination?: Pagination;
  columns: Column<T>[];

  // handlers for actions
  onView?: (row: T) => void;
  onToggleStatus?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

function CommonTable<T extends { id: number | string; isActive?: boolean }>({
  categories,
  loading,
  error,
  pagination,
  columns,
  onView,
  onToggleStatus,
  onEdit,
  onDelete,
}: Props<T>) {
  if (loading) return <p>Loading...</p>;

  if (error) {
    return (
      <p className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  const hasActions = !!(onView || onToggleStatus || onEdit || onDelete);

  return (
    <div>
      {pagination && (
        <div className="mb-3 text-sm text-gray-600">
          Total: {pagination.total} | Page {pagination.page} of{" "}
          {pagination.totalPages}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200 scrollbar-custom">
        <table className="min-w-full border-collapse bg-white text-sm text-nowrap">
          <thead className="border-b border-gray-100 dark:border-white/[0.05] text-nowrap">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">
                  {col.header}
                </th>
              ))}

              {hasActions && (
                <th className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 text-center">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                <td
                  colSpan={columns.length + (hasActions ? 1 : 0)}
                  className="px-4 py-4 text-center text-gray-500"
                >
                  No records found.
                </td>
              </tr>
            )}

            {categories.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                {columns.map((col, idx) => (
                  <td key={idx} className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                    {col.render(row)}
                  </td>
                ))}

                {hasActions && (
                  <td className="px-4 py-3 text-gray-500 text-center text-theme-sm dark:text-gray-400">
                    <div className="flex items-center justify-center gap-3">
                      {onToggleStatus && (
                        <div className="flex items-center switch-btn">
                          <ToggleSwitch
                            checked={!!row.isActive}
                            onChange={() => onToggleStatus(row)}
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(row)}
                            className="inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500 cursor-pointer"
                            title="View"
                          >
                            <EyeIcon className="me-1" /> View
                          </button>
                        )}


                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="w-auto inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400 cursor-pointer"
                            title="Edit"
                          >
                            <PencilIcon className="me-1" /> Edit
                          </button>
                        )}

                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="w-auto inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500 cursor-pointer"
                            title="Delete"
                          >
                            <TrashBinIcon className="me-1" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CommonTable;
