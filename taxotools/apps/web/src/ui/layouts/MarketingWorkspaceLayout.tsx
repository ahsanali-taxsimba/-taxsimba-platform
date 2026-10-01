"use client";

import { cn } from "@/lib/utils";
import { SectionHeader } from "@/ui/components/SectionHeader";
import { Card } from "@/ui/components/Card";
import { SplitView } from "./SplitView";
import { Stagger, StaggerItem } from "@/ui/animations/Stagger";

export function MarketingWorkspaceLayout({
  title = "Marketing workspace",
  description = "Campaigns, content calendar, and creative pipeline in one asymmetric board.",
  breadcrumbs,
  actions,
  hero,
  campaignRail,
  calendar,
  creativeQueue,
  className,
}: {
  title?: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  hero?: React.ReactNode;
  campaignRail?: React.ReactNode;
  calendar?: React.ReactNode;
  creativeQueue?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-8", className)} data-testid="marketing-workspace">
      <SectionHeader
        eyebrow="Marketing"
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {hero && (
        <Card
          surface="gradient"
          className="rounded-[36px_18px_36px_18px] min-h-[160px]"
        >
          {hero}
        </Card>
      )}

      <SplitView
        primaryRatio="xl"
        primary={
          <Card surface="glass" className="min-h-[280px] rounded-[28px_16px_28px_16px]">
            {calendar ?? (
              <p className="text-sm text-[var(--text-secondary)]">Drop calendar widgets here.</p>
            )}
          </Card>
        }
        secondary={
          <Card surface="neu" className="min-h-[280px]">
            {campaignRail ?? (
              <p className="text-sm text-[var(--text-secondary)]">Campaign rail goes here.</p>
            )}
          </Card>
        }
      />

      {creativeQueue ? (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StaggerItem>
            <Card surface="solid" interactive>
              {creativeQueue}
            </Card>
          </StaggerItem>
        </Stagger>
      ) : null}
    </div>
  );
}
