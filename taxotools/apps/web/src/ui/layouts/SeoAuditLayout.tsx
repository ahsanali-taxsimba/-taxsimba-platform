"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/ui/components/SectionHeader";
import { Card } from "@/ui/components/Card";
import { StatusTag } from "@/ui/components/StatusTag";
import { MetricCard } from "@/ui/components/MetricCard";
import { Stagger, StaggerItem } from "@/ui/animations/Stagger";
import { slideUp } from "@/ui/animations";

export type SeoIssue = {
  id: string;
  title: string;
  detail?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
};

export type SeoIssueGroup = {
  id: string;
  label: string;
  issues: SeoIssue[];
  defaultOpen?: boolean;
};

const severityTone = {
  critical: "danger",
  high: "warn",
  medium: "info",
  low: "neutral",
  info: "neutral",
} as const;

export function SeoAuditLayout({
  title = "SEO audit",
  description = "Collapsible issue groups with severity tags and fix-first prioritisation.",
  breadcrumbs,
  actions,
  score,
  metrics,
  groups,
  className,
}: {
  title?: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  score?: number | null;
  metrics?: { label: string; value: number | string; trend?: number }[];
  groups: SeoIssueGroup[];
  className?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.defaultOpen ?? g.id === groups[0]?.id])),
  );

  return (
    <div className={cn("space-y-8", className)} data-testid="seo-audit-layout">
      <SectionHeader
        eyebrow="Technical SEO"
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <MetricCard
            label="Health score"
            value={score ?? "—"}
            hint="Composite audit"
            gradient
            trend={score != null ? Math.round((score - 70) / 3) : undefined}
          />
        </StaggerItem>
        {(metrics ?? []).map((m) => (
          <StaggerItem key={m.label}>
            <MetricCard label={m.label} value={m.value} trend={m.trend} />
          </StaggerItem>
        ))}
      </Stagger>

      <div className="space-y-3">
        {groups.map((group) => {
          const isOpen = open[group.id];
          return (
            <Card key={group.id} surface="glass" className="overflow-hidden p-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-none bg-transparent px-5 py-4 text-left shadow-none"
                onClick={() => setOpen((p) => ({ ...p, [group.id]: !isOpen }))}
              >
                <div>
                  <p className="font-display text-lg font-semibold text-[var(--text-main)]">
                    {group.label}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {group.issues.length} issue{group.issues.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{isOpen ? "▾" : "▸"}</span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <m.ul
                    variants={slideUp}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-2 border-t border-[var(--border-subtle)] px-5 py-4"
                  >
                    {group.issues.map((issue) => (
                      <li
                        key={issue.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-[16px] bg-[var(--bg-muted)]/50 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-main)]">{issue.title}</p>
                          {issue.detail && (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">{issue.detail}</p>
                          )}
                        </div>
                        <StatusTag label={issue.severity} tone={severityTone[issue.severity]} />
                      </li>
                    ))}
                    {!group.issues.length && (
                      <li className="text-sm text-[var(--text-secondary)]">No issues in this group.</li>
                    )}
                  </m.ul>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
