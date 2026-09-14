"use client";

import React from "react";

type Props = {
  page: number;
  totalPages: number;
  totalItems?: number;
  limit?: number;

  onPageChange: (page: number) => void;

  siblingCount?: number; // how many pages to show around current
  className?: string;
  disabled?: boolean;
};

const range = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);

const getPaginationItems = (
  current: number,
  total: number,
  siblingCount: number
): Array<number | "dots"> => {
  const totalNumbers = siblingCount * 2 + 5; // first, last, current, 2*siblings, 2 dots
  if (total <= totalNumbers) return range(1, total);

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);

  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < total - 1;

  if (!showLeftDots && showRightDots) {
    const leftRange = range(1, 3 + siblingCount * 2);
    return [...leftRange, "dots", total];
  }

  if (showLeftDots && !showRightDots) {
    const rightRange = range(total - (3 + siblingCount * 2) + 1, total);
    return [1, "dots", ...rightRange];
  }

  const middleRange = range(leftSibling, rightSibling);
  return [1, "dots", ...middleRange, "dots", total];
};

export default function Pagination({
  page,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  siblingCount = 1,
  className = "",
  disabled = false,
}: Props) {
  if (!totalPages || totalPages <= 1) return null;

  const items = getPaginationItems(page, totalPages, siblingCount);

  const go = (p: number) => {
    if (disabled) return;
    if (p < 1 || p > totalPages) return;
    if (p === page) return;
    onPageChange(p);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* info row */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div>
          Page <span className="font-medium">{page}</span> of{" "}
          <span className="font-medium">{totalPages}</span>
        </div>

        {typeof totalItems === "number" && typeof limit === "number" && (
          <div>
            Showing{" "}
            <span className="font-medium">
              {(page - 1) * limit + 1}
            </span>
            –
            <span className="font-medium">
              {Math.min(page * limit, totalItems)}
            </span>{" "}
            of <span className="font-medium">{totalItems}</span>
          </div>
        )}
      </div>

      {/* buttons row */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={disabled || page === 1}
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Prev
        </button>

        {items.map((it, idx) =>
          it === "dots" ? (
            <span key={`dots-${idx}`} className="px-2 text-gray-500">
              …
            </span>
          ) : (
            <button
              key={it}
              type="button"
              onClick={() => go(it)}
              disabled={disabled}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                it === page ? "bg-gray-900 text-white border-gray-900" : ""
              }`}
            >
              {it}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={disabled || page === totalPages}
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
