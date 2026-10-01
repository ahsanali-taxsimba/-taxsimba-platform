"use client";

import Link from "next/link";
import { FadeIn, SlideUp, MotionButton, RankTrackingChart } from "@/motion";
import {
  ScoreRing,
  MetricTile,
  SovBarList,
  ActionRow,
  DonutBreakdown,
  Sparkline,
} from "@/components/dashboard/ChartKit";

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

  return (
    <div className="space-y-8" data-testid="site-overview">
      <FadeIn>
        <div className="overflow-hidden rounded-3xl border border-ink-100 bg-grid-fade px-6 py-7 shadow-sm md:px-8">
          <p className="text-sm text-ink-500">
            <Link href="/app/sites" className="hover:text-accent-dark">
              Sites
            </Link>{" "}
            / {domain}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold text-ink-950 md:text-4xl">
                {siteName}
              </h1>
              <p className="mt-1 text-sm text-ink-500">{url}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/app/sites/${siteId}/technical`}>
                <MotionButton type="button" variant="outline">
                  Run crawl
                </MotionButton>
              </Link>
              <Link href={`/app/sites/${siteId}/tools`}>
                <MotionButton type="button">Full toolkit</MotionButton>
              </Link>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-4">
        <ScoreRing score={healthScore} label="Site health score" />
        <MetricTile label="Keywords" value={keywordCount} hint="Tracked phrases" tone="accent">
          <Sparkline points={rankPoints.map((p) => p.value)} color="#2997FF" />
        </MetricTile>
        <MetricTile label="Pages discovered" value={pageCount} hint={`${crawlCount} crawls run`} />
        <MetricTile
          label="AI share of voice"
          value={sovAvg}
          hint={sov.length ? `${sov.length} engines sampled` : "No scans yet"}
          tone="good"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SlideUp className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Visibility trend</h2>
              <p className="text-sm text-ink-500">
                Auto SEO style rank / activity pulse for {domain}
              </p>
            </div>
            <Link
              href={`/app/sites/${siteId}/keywords`}
              className="text-sm font-medium text-accent-dark hover:underline"
            >
              Manage keywords
            </Link>
          </div>
          <RankTrackingChart points={rankPoints} height={110} />
        </SlideUp>

        <SlideUp delay={0.05} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Issue breakdown</h2>
          <p className="mb-4 text-sm text-ink-500">From the latest completed crawl</p>
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
            ).filter((s) => s.value > 0).length
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
        </SlideUp>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SlideUp className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-semibold">AI / AEO share of voice</h2>
          <p className="mb-4 text-sm text-ink-500">How often engines mention your brand</p>
          <SovBarList
            items={sov.map((s) => ({ label: s.name || s.code, value: s.shareOfVoice }))}
          />
          <div className="mt-4">
            <Link href={`/app/sites/${siteId}/aeo`}>
              <MotionButton type="button" variant="outline">
                Run AEO scan
              </MotionButton>
            </Link>
          </div>
        </SlideUp>

        <SlideUp delay={0.05} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Priority actions</h2>
          <p className="mb-4 text-sm text-ink-500">Suggested workflow for this project</p>
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
        </SlideUp>
      </div>

      <SlideUp delay={0.08}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Toolkit shortcuts</h2>
            <p className="text-sm text-ink-500">Most-used Auto SEO modules for this site</p>
          </div>
          <Link
            href={`/app/sites/${siteId}/tools`}
            className="text-sm font-medium text-accent-dark hover:underline"
          >
            View all tools
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {featuredTools.map((tool) => (
            <Link
              key={tool.path}
              href={`/app/sites/${siteId}/${tool.path === "technical" || tool.path === "keywords" || tool.path === "backlinks" || tool.path === "aeo" || tool.path === "content" || tool.path === "reports" ? tool.path : `tools/${tool.path}`}`}
              className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition-colors hover:border-accent hover:bg-accent-soft/30"
            >
              <p className="font-display text-lg font-semibold text-ink-950">{tool.name}</p>
              <p className="mt-1 text-sm text-ink-500">{tool.detail}</p>
            </Link>
          ))}
        </div>
      </SlideUp>

      <details className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-display text-lg font-semibold text-ink-900">
          All toolkit groups ({groups.reduce((n, g) => n + g.tools.length, 0)} tools)
        </summary>
        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <div key={group.id}>
              <h3 className="text-sm font-semibold text-ink-800">{group.name}</h3>
              <p className="text-xs text-ink-500">{group.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.tools.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/app/sites/${siteId}/tools/${tool.path}`}
                    className="rounded-lg border border-ink-100 bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-accent hover:bg-accent-soft hover:text-accent-dark"
                  >
                    {tool.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
