"use client";

import Link from "next/link";
import { RankTrackingChart } from "@/motion";
import {
  ScoreRing,
  SovBarList,
  ActionRow,
  DonutBreakdown,
  Sparkline,
} from "@/components/dashboard/ChartKit";
import {
  SectionHeader,
  Button,
  MetricCard,
  ChartContainer,
  Card,
  StatusTag,
  SplitView,
  Stagger,
  StaggerItem,
  FadeIn,
  SeoAuditLayout,
  type SeoIssueGroup,
} from "@/ui";

type Tool = { id: string; name: string; path: string };
type Group = { id: string; name: string; description: string; tools: readonly Tool[] };
type SovItem = { code: string; name: string; shareOfVoice: number; samples: number };
type IssueCounts = {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  INFO: number;
};

export function SiteOverviewMotion({
  siteId,
  siteName,
  domain,
  url,
  healthScore,
  keywordCount,
  pageCount,
  crawlCount,
  backlinkCount,
  sovAvg,
  sov,
  issueCounts,
  groups,
}: {
  siteId: string;
  siteName: string;
  domain: string;
  url: string;
  healthScore: number | null;
  keywordCount: number;
  pageCount: number;
  crawlCount: number;
  backlinkCount: number;
  sovAvg: string;
  sov: SovItem[];
  issueCounts: IssueCounts;
  groups: Group[];
}) {
  const issueTotal =
    issueCounts.CRITICAL +
    issueCounts.HIGH +
    issueCounts.MEDIUM +
    issueCounts.LOW +
    issueCounts.INFO;

  const rankPoints = Array.from({ length: 8 }, (_, i) => ({
    label: `W${i + 1}`,
    value: Math.max(
      1,
      Math.round(
        (keywordCount || 8) * (0.55 + i * 0.06) + (healthScore ? healthScore / 20 : 2),
      ),
    ),
  }));

  const featuredTools = [
    { path: "technical", name: "Site audit", detail: "Crawl & fix issues" },
    { path: "keywords", name: "Rank tracker", detail: "Positions & gaps" },
    { path: "backlinks", name: "Backlinks", detail: "Authority graph" },
    { path: "aeo", name: "AEO / GEO", detail: "AI visibility" },
    { path: "content", name: "Content Genius", detail: "Briefs & scores" },
    { path: "reports", name: "Client reports", detail: "White-label PDF/HTML" },
  ];

  const issueGroups: SeoIssueGroup[] = [
    {
      id: "critical",
      label: "Critical & high",
      defaultOpen: true,
      issues: [
        ...(issueCounts.CRITICAL
          ? [
              {
                id: "c1",
                title: `${issueCounts.CRITICAL} critical issue${issueCounts.CRITICAL === 1 ? "" : "s"}`,
                detail: "Blocks indexing or major UX regressions",
                severity: "critical" as const,
              },
            ]
          : []),
        ...(issueCounts.HIGH
          ? [
              {
                id: "h1",
                title: `${issueCounts.HIGH} high-priority issue${issueCounts.HIGH === 1 ? "" : "s"}`,
                detail: "Strong impact on rankings or crawlability",
                severity: "high" as const,
              },
            ]
          : []),
      ],
    },
    {
      id: "medium",
      label: "Medium",
      issues: issueCounts.MEDIUM
        ? [
            {
              id: "m1",
              title: `${issueCounts.MEDIUM} medium issue${issueCounts.MEDIUM === 1 ? "" : "s"}`,
              detail: "Worth fixing in the next sprint",
              severity: "medium" as const,
            },
          ]
        : [],
    },
    {
      id: "low",
      label: "Low & info",
      issues: [
        ...(issueCounts.LOW
          ? [
              {
                id: "l1",
                title: `${issueCounts.LOW} low issue${issueCounts.LOW === 1 ? "" : "s"}`,
                severity: "low" as const,
              },
            ]
          : []),
        ...(issueCounts.INFO
          ? [
              {
                id: "i1",
                title: `${issueCounts.INFO} informational note${issueCounts.INFO === 1 ? "" : "s"}`,
                severity: "info" as const,
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <div className="space-y-8" data-testid="site-overview">
      <FadeIn>
        <SectionHeader
          breadcrumbs={[
            { label: "Sites", href: "/app/sites" },
            { label: domain },
          ]}
          title={siteName}
          description={url}
          actions={
            <>
              <Link href={`/app/sites/${siteId}/technical`}>
                <Button variant="outline">Run crawl</Button>
              </Link>
              <Link href={`/app/sites/${siteId}/tools`}>
                <Button>Full toolkit</Button>
              </Link>
            </>
          }
        />
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-4">
        <ScoreRing score={healthScore} label="Site health score" />
        <MetricCard
          label="Keywords"
          value={keywordCount}
          hint="Tracked phrases"
          trend={keywordCount ? 6 : 0}
        />
        <MetricCard
          label="Pages discovered"
          value={pageCount}
          hint={`${crawlCount} crawls run`}
          trend={pageCount ? 4 : 0}
        />
        <MetricCard
          label="AI share of voice"
          value={sovAvg}
          hint={sov.length ? `${sov.length} engines sampled` : "No scans yet"}
          gradient
        />
      </div>

      <SplitView
        primaryRatio="xl"
        primary={
          <ChartContainer
            title="Visibility trend"
            description={`Auto SEO style rank / activity pulse for ${domain}`}
            actions={
              <Link
                href={`/app/sites/${siteId}/keywords`}
                className="text-sm font-medium text-[var(--accent-blue)] hover:underline"
              >
                Manage keywords
              </Link>
            }
          >
            <RankTrackingChart points={rankPoints} height={110} />
            <div className="mt-3">
              <Sparkline points={rankPoints.map((p) => p.value)} color="#2997FF" />
            </div>
          </ChartContainer>
        }
        secondary={
          <ChartContainer title="Issue breakdown" description="From the latest completed crawl">
            <DonutBreakdown
              segments={(
                [
                  { label: "Critical", value: issueCounts.CRITICAL || 0, color: "#DC2626" },
                  { label: "High", value: issueCounts.HIGH || 0, color: "#D97706" },
                  { label: "Medium", value: issueCounts.MEDIUM || 0, color: "#2997FF" },
                  {
                    label: "Low / info",
                    value: (issueCounts.LOW || 0) + (issueCounts.INFO || 0),
                    color: "#A1A1A6",
                  },
                ] as const
              )
                .filter((s) => s.value > 0).length
                ? [
                    { label: "Critical", value: issueCounts.CRITICAL || 0, color: "#DC2626" },
                    { label: "High", value: issueCounts.HIGH || 0, color: "#D97706" },
                    { label: "Medium", value: issueCounts.MEDIUM || 0, color: "#2997FF" },
                    {
                      label: "Low / info",
                      value: (issueCounts.LOW || 0) + (issueCounts.INFO || 0),
                      color: "#A1A1A6",
                    },
                  ].filter((s) => s.value > 0)
                : [{ label: "No issues yet", value: 1, color: "#E8F2FF" }]}
              centerLabel="issues"
              centerValue={issueTotal || "0"}
            />
          </ChartContainer>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card surface="glass">
          <h2 className="font-display text-xl font-semibold">AI / AEO share of voice</h2>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">How often engines mention your brand</p>
          <SovBarList
            items={sov.map((s) => ({ label: s.name || s.code, value: s.shareOfVoice }))}
          />
          <div className="mt-4">
            <Link href={`/app/sites/${siteId}/aeo`}>
              <Button variant="outline">Run AEO scan</Button>
            </Link>
          </div>
        </Card>

        <Card surface="neu">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Priority actions</h2>
            <StatusTag label={`${backlinkCount} links`} tone="neutral" />
          </div>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">Suggested workflow for this project</p>
          <div className="space-y-2">
            <ActionRow
              title={issueTotal ? "Fix technical issues" : "Run first technical crawl"}
              detail={
                issueTotal
                  ? `${issueTotal} issues waiting in the latest crawl`
                  : "Generate a health score and issue list"
              }
              href={`/app/sites/${siteId}/technical`}
              cta="Audit"
            />
            <ActionRow
              title="Expand keyword map"
              detail={`${keywordCount} tracked · add clusters & gap terms`}
              href={`/app/sites/${siteId}/keywords`}
              cta="Keywords"
            />
            <ActionRow
              title="Review backlink profile"
              detail={`${backlinkCount} backlinks stored`}
              href={`/app/sites/${siteId}/backlinks`}
              cta="Links"
            />
            <ActionRow
              title="Draft content with AI"
              detail="Outlines, FAQs, and content scores"
              href={`/app/sites/${siteId}/content`}
              cta="Create"
            />
          </div>
        </Card>
      </div>

      <SeoAuditLayout
        title="Technical issue groups"
        description="Collapsible severity groups from the latest crawl snapshot."
        breadcrumbs={[
          { label: domain, href: `/app/sites/${siteId}` },
          { label: "Audit" },
        ]}
        score={healthScore}
        metrics={[
          { label: "Critical", value: issueCounts.CRITICAL, trend: issueCounts.CRITICAL ? -2 : 0 },
          { label: "High", value: issueCounts.HIGH },
          { label: "Medium", value: issueCounts.MEDIUM },
        ]}
        groups={issueGroups}
        actions={
          <Link href={`/app/sites/${siteId}/technical`}>
            <Button size="sm">Open full audit</Button>
          </Link>
        }
      />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Toolkit shortcuts</h2>
            <p className="text-sm text-[var(--text-secondary)]">Most-used Auto SEO modules for this site</p>
          </div>
          <Link
            href={`/app/sites/${siteId}/tools`}
            className="text-sm font-medium text-[var(--accent-blue)] hover:underline"
          >
            View all tools
          </Link>
        </div>
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {featuredTools.map((tool) => (
            <StaggerItem key={tool.path}>
              <Link
                href={`/app/sites/${siteId}/${tool.path === "technical" || tool.path === "keywords" || tool.path === "backlinks" || tool.path === "aeo" || tool.path === "content" || tool.path === "reports" ? tool.path : `tools/${tool.path}`}`}
              >
                <Card surface="glass" interactive className="h-full">
                  <p className="font-display text-lg font-semibold text-[var(--text-main)]">{tool.name}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{tool.detail}</p>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <Card surface="solid">
        <details>
          <summary className="cursor-pointer font-display text-lg font-semibold text-[var(--text-main)]">
            All toolkit groups ({groups.reduce((n, g) => n + g.tools.length, 0)} tools)
          </summary>
          <div className="mt-4 space-y-5">
            {groups.map((group) => (
              <div key={group.id}>
                <h3 className="text-sm font-semibold text-[var(--text-main)]">{group.name}</h3>
                <p className="text-xs text-[var(--text-secondary)]">{group.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.tools.map((tool) => (
                    <Link
                      key={tool.id}
                      href={`/app/sites/${siteId}/tools/${tool.path}`}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-main)] hover:border-[var(--accent-blue)] hover:bg-[var(--accent-soft)]"
                    >
                      {tool.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </Card>
    </div>
  );
}
