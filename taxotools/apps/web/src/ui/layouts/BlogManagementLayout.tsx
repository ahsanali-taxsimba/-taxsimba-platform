"use client";

import { cn } from "@/lib/utils";
import { SectionHeader } from "@/ui/components/SectionHeader";
import { Card } from "@/ui/components/Card";
import { FilterBar, type FilterOption } from "@/ui/components/FilterBar";
import { SlideUp } from "@/ui/animations/SlideUp";

export function BlogManagementLayout({
  title = "Blog management",
  description = "Draft, schedule, and score content with a split editor + pipeline view.",
  breadcrumbs,
  actions,
  filters,
  activeFilter,
  onFilterChange,
  pipeline,
  editor,
  insights,
  className,
}: {
  title?: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (id: string) => void;
  pipeline?: React.ReactNode;
  editor?: React.ReactNode;
  insights?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)} data-testid="blog-management">
      <SectionHeader
        eyebrow="Content"
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {filters && onFilterChange && (
        <FilterBar options={filters} value={activeFilter} onChange={onFilterChange} />
      )}

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_300px]">
        <SlideUp>
          <Card surface="neu" className="min-h-[420px] rounded-[22px_28px_16px_28px]">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Pipeline
            </h3>
            {pipeline ?? <p className="text-sm text-[var(--text-secondary)]">Posts list</p>}
          </Card>
        </SlideUp>
        <SlideUp delay={0.04}>
          <Card surface="glass" className="min-h-[420px]">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Editor
            </h3>
            {editor ?? <p className="text-sm text-[var(--text-secondary)]">Editor canvas</p>}
          </Card>
        </SlideUp>
        <SlideUp delay={0.08}>
          <Card
            surface="solid"
            className="min-h-[420px] rounded-[16px_28px_28px_16px] bg-gradient-to-b from-[var(--bg-panel)] to-[var(--accent-soft)]"
          >
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Insights
            </h3>
            {insights ?? <p className="text-sm text-[var(--text-secondary)]">SEO / AEO scores</p>}
          </Card>
        </SlideUp>
      </div>
    </div>
  );
}
