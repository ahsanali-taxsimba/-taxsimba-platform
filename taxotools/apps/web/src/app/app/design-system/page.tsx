"use client";

import { useState } from "react";
import {
  SectionHeader,
  MetricCard,
  Button,
  Card,
  StatusTag,
  ChartContainer,
  FilterBar,
  DashboardGrid,
  MarketingWorkspaceLayout,
  BlogManagementLayout,
  AnalyticsLayout,
  AnalyticsMetricSlot,
  FadeIn,
  Stagger,
  StaggerItem,
} from "@/ui";

export default function DesignSystemPage() {
  const [filter, setFilter] = useState("all");
  const [blogFilter, setBlogFilter] = useState("drafts");

  return (
    <div className="space-y-16" data-testid="design-system-page">
      <FadeIn>
        <SectionHeader
          eyebrow="Design system"
          title="UI kit playground"
          description="Tokens, glass/neu surfaces, layouts, and motion primitives for Taxotools dashboards."
          breadcrumbs={[
            { label: "App", href: "/app" },
            { label: "Design system" },
          ]}
          actions={
            <>
              <Button variant="ghost">Ghost</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="solid">Solid</Button>
            </>
          }
        />
      </FadeIn>

      <section className="space-y-4 !p-0">
        <h2 className="font-display text-2xl font-semibold">Surfaces & metrics</h2>
        <DashboardGrid>
          <MetricCard label="Keywords" value={248} trend={12} gradient />
          <MetricCard label="Health" value={86} trend={4} />
          <MetricCard label="Backlinks" value={1204} trend={-2} />
          <MetricCard label="AEO score" value={71} hint="Share of voice" />
        </DashboardGrid>
        <Stagger className="grid gap-4 md:grid-cols-3">
          <StaggerItem>
            <Card surface="glass">Glass card</Card>
          </StaggerItem>
          <StaggerItem>
            <Card surface="neu">Neumorphic card</Card>
          </StaggerItem>
          <StaggerItem>
            <Card surface="gradient">Gradient card</Card>
          </StaggerItem>
        </Stagger>
        <div className="flex flex-wrap gap-2">
          <StatusTag label="success" tone="success" />
          <StatusTag label="warn" tone="warn" />
          <StatusTag label="danger" tone="danger" />
          <StatusTag label="info" tone="info" />
        </div>
      </section>

      <AnalyticsLayout
        title="Analytics pattern"
        description="Multi-section analytics grid with filters and staggered load."
        metrics={
          <>
            <AnalyticsMetricSlot>
              <MetricCard label="Sessions" value={18420} trend={9} />
            </AnalyticsMetricSlot>
            <AnalyticsMetricSlot>
              <MetricCard label="Conversions" value={312} trend={6} />
            </AnalyticsMetricSlot>
            <AnalyticsMetricSlot>
              <MetricCard label="CTR" value="4.2%" />
            </AnalyticsMetricSlot>
            <AnalyticsMetricSlot>
              <MetricCard label="Pipeline" value={18} gradient />
            </AnalyticsMetricSlot>
          </>
        }
        primaryChart={
          <ChartContainer
            title="Engagement"
            description="Filterable chart shell"
            filters={[
              { id: "7d", label: "7d" },
              { id: "30d", label: "30d" },
              { id: "all", label: "All" },
            ]}
            activeFilter={filter}
            onFilterChange={setFilter}
          >
            <div className="flex h-40 items-end gap-2">
              {[40, 65, 48, 80, 55, 72, 90].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-lg bg-gradient-to-t from-[var(--gradient-a)] to-[var(--gradient-b)]"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </ChartContainer>
        }
        secondaryChart={
          <Card surface="neu">
            <p className="text-sm font-semibold">Secondary panel</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Use for donuts, rankings, or insight lists.
            </p>
            <FilterBar
              className="mt-4"
              options={[
                { id: "a", label: "Organic" },
                { id: "b", label: "Paid" },
              ]}
              value="a"
              onChange={() => undefined}
            />
          </Card>
        }
      />

      <MarketingWorkspaceLayout
        hero={
          <div>
            <p className="text-sm font-semibold opacity-80">This week</p>
            <h3 className="mt-1 font-display text-2xl font-semibold">Campaign board</h3>
            <p className="mt-2 max-w-lg text-sm opacity-90">
              Asymmetric marketing workspace with calendar + creative queue.
            </p>
          </div>
        }
        calendar={<p className="text-sm text-[var(--text-secondary)]">Editorial calendar slot</p>}
        campaignRail={<p className="text-sm text-[var(--text-secondary)]">Active campaigns rail</p>}
        creativeQueue={<p className="text-sm">Creative brief · waiting on copy</p>}
      />

      <BlogManagementLayout
        filters={[
          { id: "drafts", label: "Drafts" },
          { id: "scheduled", label: "Scheduled" },
          { id: "live", label: "Live" },
        ]}
        activeFilter={blogFilter}
        onFilterChange={setBlogFilter}
        pipeline={<p className="text-sm text-[var(--text-secondary)]">Post pipeline list</p>}
        editor={<p className="text-sm text-[var(--text-secondary)]">Rich editor canvas</p>}
        insights={<p className="text-sm text-[var(--text-secondary)]">SEO / AEO score panel</p>}
      />
    </div>
  );
}
