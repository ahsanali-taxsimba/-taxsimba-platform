"use client";

import { cn } from "@/lib/utils";

export type FilterOption = { id: string; label: string };

export function FilterBar({
  options,
  value,
  onChange,
  className,
}: {
  options: FilterOption[];
  value?: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-pill border border-[var(--border-subtle)] bg-[var(--bg-muted)]/70 p-1",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-[var(--bg-panel)] text-[var(--text-main)] shadow-sm"
                : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
