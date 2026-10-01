"use client";

import { cn } from "@/lib/utils";
import { Card } from "./Card";
import { FilterBar, type FilterOption } from "./FilterBar";

export function ChartContainer({
  title,
  description,
  filters,
  activeFilter,
  onFilterChange,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (id: string) => void;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card surface="glass" className={cn("overflow-hidden", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[21px] font-semibold tracking-tight text-[var(--text-main)]">{title}</h3>
          {description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters && onFilterChange && (
            <FilterBar options={filters} value={activeFilter} onChange={onFilterChange} />
          )}
          {actions}
        </div>
      </div>
      <div className="min-h-[140px]">{children}</div>
    </Card>
  );
}
