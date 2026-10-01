"use client";

import { cn } from "@/lib/utils";
import { SectionHeader } from "@/ui/components/SectionHeader";
import { Stagger, StaggerItem } from "@/ui/animations/Stagger";
import { SlideUp } from "@/ui/animations/SlideUp";

export function AnalyticsLayout({
  title,
  description,
  breadcrumbs,
  actions,
  metrics,
  primaryChart,
  secondaryChart,
  table,
  sidebar,
  className,
}: {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  metrics?: React.ReactNode;
  primaryChart?: React.ReactNode;
  secondaryChart?: React.ReactNode;
  table?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-8", className)} data-testid="analytics-layout">
      <SectionHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {metrics && (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics}</Stagger>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {primaryChart && (
          <SlideUp className="xl:col-span-2 [&>*]:rounded-[28px_16px_28px_16px]">{primaryChart}</SlideUp>
        )}
        {secondaryChart && <SlideUp delay={0.05}>{secondaryChart}</SlideUp>}
      </div>

      <div className={cn("grid gap-4", sidebar && "xl:grid-cols-[1.4fr_1fr]")}>
        {table && <SlideUp>{table}</SlideUp>}
        {sidebar && <SlideUp delay={0.04}>{sidebar}</SlideUp>}
      </div>
    </div>
  );
}

export function AnalyticsMetricSlot({ children }: { children: React.ReactNode }) {
  return <StaggerItem>{children}</StaggerItem>;
}
