"use client";

import Link from "next/link";
import {
  UsageGauge,
  Sparkline,
  BarSeries,
  DonutBreakdown,
  ActionRow,
} from "@/components/dashboard/ChartKit";
import {
  MetricCard,
  ChartContainer,
  Card,
  SectionHeader,
  Button,
  DashboardGrid,
  SplitView,
  Stagger,
  StaggerItem,
  FadeIn,
  StatusTag,
} from "@/ui";

type UsageItem = { metric: string; used: number; limit: number };
type SiteRow = {
  id: string;
  name: string;
  domain: string;
  _count: { keywords: number; crawls: number; pages: number };
};

function metricLabel(metric: string) {
  return metric
    .split("_")
    .join(" ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function seedTrend(n: number, seed: number) {
  const out: number[] = [];
  let v = Math.max(1, seed);
  for (let i = 0; i < 8; i++) {
    v = Math.max(0, v + ((seed * (i + 3)) % 7) - 3);
    out.push(v + i);
  }
  if (n > 0) out[out.length - 1] = n;
  return out;
}

export function DashboardMotion({
  planName,
  siteCount,
  usageItems,
  sites,
  userName,
}: {
  planName?: string;
  siteCount: number;
  usageItems: UsageItem[];
  sites: SiteRow[];
  userName?: string | null;
}) {
  const primary = sites[0];
  const totalKeywords = sites.reduce((s, x) => s + x._count.keywords, 0);
  const totalCrawls = sites.reduce((s, x) => s + x._count.crawls, 0);
  const totalPages = sites.reduce((s, x) => s + x._count.pages, 0);
  const greeting = userName?.split(" ")[0] || "there";

  const coverageSegments = [
    { label: "Keywords tracked", value: Math.max(totalKeywords, 1), color: "#0071E3" },
    { label: "Pages indexed", value: Math.max(totalPages, 1), color: "#2997FF" },
    { label: "Crawls run", value: Math.max(totalCrawls, 1), color: "#86868B" },
  ];

  const siteBars = sites.slice(0, 6).map((s) => ({
    label: s.domain.replace(/^www\./, "").slice(0, 10),
    value: s._count.keywords + s._count.pages + s._count.crawls * 3,
  }));

  const actions = primary
    ? [
        {
          title: "Run Auto SEO health check",
          detail: `Scan ${primary.domain} for technical issues and quick wins`,
          href: `/app/sites/${primary.id}/technical`,
          cta: "Crawl",
        },
        {
          title: "Grow keyword visibility",
          detail:
            totalKeywords === 0
              ? "Add seed keywords to start rank tracking"
              : `${totalKeywords} keywords tracked — expand clusters`,
          href: `/app/sites/${primary.id}/keywords`,
          cta: "Keywords",
        },
        {
          title: "Check AI / AEO presence",
          detail: "See how ChatGPT & AI Overviews mention your brand",
          href: `/app/sites/${primary.id}/aeo`,
          cta: "AEO",
        },
        {
          title: "Explore UK firm intelligence",
          detail: "Coverage map, firm scorecards, and lead lists",
          href: "/app/intelligence",
          cta: "Open",
        },
      ]
    : [];

  return (
    <div className="space-y-8" data-testid="dashboard-overview">
      <FadeIn>
        <SectionHeader
          eyebrow="Workspace command center"
          title={`Welcome back, ${greeting}`}
          description={`${planName || "Trial"} plan · ${siteCount} project${siteCount === 1 ? "" : "s"} · glass + neu dashboards with live visibility graphs.`}
          actions={
            <>
              <Link href="/onboarding">
                <Button variant="outline">Add site</Button>
              </Link>
              {primary && (
                <Link href={`/app/sites/${primary.id}`}>
                  <Button>Open {primary.domain}</Button>
                </Link>
              )}
            </>
          }
        />
      </FadeIn>

      <DashboardGrid columns={4}>
        {usageItems.map((item) => (
          <UsageGauge
            key={item.metric}
            label={metricLabel(item.metric)}
            used={item.used}
            limit={item.limit}
          />
        ))}
      </DashboardGrid>

      <Stagger className="grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <MetricCard label="Keywords" value={totalKeywords} hint="Tracked phrases" trend={8} gradient />
        </StaggerItem>
        <StaggerItem>
          <MetricCard label="Crawls" value={totalCrawls} hint="Technical scans" trend={3} />
        </StaggerItem>
        <StaggerItem>
          <MetricCard label="Pages" value={totalPages} hint="Discovered URLs" trend={5} />
        </StaggerItem>
      </Stagger>

      <SplitView
        primaryRatio="xl"
        primary={
          <ChartContainer
            title="Visibility pulse"
            description="Keyword + crawl activity trend across projects"
            actions={<StatusTag label="Live workspace" tone="info" />}
          >
            <Sparkline points={seedTrend(totalKeywords + totalCrawls, totalPages + 4)} />
          </ChartContainer>
        }
        secondary={
          <ChartContainer title="Coverage mix" description="How your SEO stack is weighted">
            <DonutBreakdown
              segments={coverageSegments}
              centerLabel="signals"
              centerValue={totalKeywords + totalPages + totalCrawls || "—"}
            />
          </ChartContainer>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ChartContainer
            title="Project scoreboard"
            description="Relative activity by site (keywords · pages · crawls)"
            actions={
              <Link href="/app/sites" className="text-sm font-medium text-[var(--accent-blue)] hover:underline">
                All sites
              </Link>
            }
          >
            {siteBars.length ? (
              <BarSeries items={siteBars} />
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">Add a site to populate the scoreboard.</p>
            )}
            <div className="mt-5 space-y-2">
              {sites.slice(0, 4).map((site) => (
                <Link
                  key={site.id}
                  href={`/app/sites/${site.id}`}
                  className="flex items-center justify-between rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-panel)]/60 px-4 py-3 transition-colors hover:border-[var(--accent-blue)] hover:bg-[var(--accent-soft)]/40"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">{site.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{site.domain}</p>
                  </div>
                  <div className="text-right text-xs text-[var(--text-secondary)]">
                    <p>{site._count.keywords} kw</p>
                    <p>
                      {site._count.crawls} crawls · {site._count.pages} pages
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </ChartContainer>
        </div>

        <div className="xl:col-span-2">
          <Card surface="neu" className="h-full">
            <h2 className="font-display text-xl font-semibold">Recommended next steps</h2>
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              Auto SEO style action queue for this workspace
            </p>
            <div className="space-y-2">
              {actions.map((a) => (
                <ActionRow key={a.title} {...a} />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Jump into tools</h2>
          <Link href="/app/toolkits" className="text-sm font-medium text-[var(--accent-blue)]">
            Browse all toolkits
          </Link>
        </div>
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: primary ? `/app/sites/${primary.id}/keywords` : "/onboarding",
              title: "Rank tracking",
              detail: "Keywords, clusters, gaps",
            },
            {
              href: primary ? `/app/sites/${primary.id}/backlinks` : "/onboarding",
              title: "Backlink engine",
              detail: "Authority & toxic links",
            },
            {
              href: primary ? `/app/sites/${primary.id}/content` : "/onboarding",
              title: "Content Genius",
              detail: "Briefs, outlines, scores",
            },
            {
              href: "/app/intelligence",
              title: "UK Intelligence",
              detail: "Firms, markets, leads",
            },
          ].map((item) => (
            <StaggerItem key={item.title}>
              <Link href={item.href}>
                <Card surface="glass" interactive className="h-full">
                  <p className="font-display text-lg font-semibold text-[var(--text-main)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.detail}</p>
                  <p className="mt-3 text-xs font-semibold text-[var(--accent-blue)]">Open →</p>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
