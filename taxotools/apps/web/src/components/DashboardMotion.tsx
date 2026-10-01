"use client";

import Link from "next/link";
import { FadeIn, SlideUp, MotionButton } from "@/motion";
import {
  UsageGauge,
  Sparkline,
  BarSeries,
  DonutBreakdown,
  ActionRow,
  MetricTile,
} from "@/components/dashboard/ChartKit";

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
    { label: "Keywords tracked", value: Math.max(totalKeywords, 1), color: "#0F9F8F" },
    { label: "Pages indexed", value: Math.max(totalPages, 1), color: "#38BDF8" },
    { label: "Crawls run", value: Math.max(totalCrawls, 1), color: "#818CF8" },
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
        <div className="overflow-hidden rounded-3xl border border-ink-100 bg-grid-fade px-6 py-7 shadow-sm md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-accent-dark">Workspace command center</p>
              <h1 className="mt-1 font-display text-3xl font-semibold text-ink-950 md:text-4xl">
                Welcome back, {greeting}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-ink-500">
                {planName || "Trial"} plan · {siteCount} project{siteCount === 1 ? "" : "s"} · Auto
                SEO style visibility, health, and opportunity graphs in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/onboarding">
                <MotionButton type="button" variant="outline">
                  Add site
                </MotionButton>
              </Link>
              {primary && (
                <Link href={`/app/sites/${primary.id}`}>
                  <MotionButton type="button">Open {primary.domain}</MotionButton>
                </Link>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {usageItems.map((item) => (
          <UsageGauge
            key={item.metric}
            label={metricLabel(item.metric)}
            used={item.used}
            limit={item.limit}
          />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <SlideUp className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-950">Visibility pulse</h2>
              <p className="text-sm text-ink-500">Keyword + crawl activity trend across projects</p>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-dark">
              Live workspace
            </span>
          </div>
          <Sparkline points={seedTrend(totalKeywords + totalCrawls, totalPages + 4)} />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MetricTile label="Keywords" value={totalKeywords} hint="Tracked phrases" tone="accent" />
            <MetricTile label="Crawls" value={totalCrawls} hint="Technical scans" />
            <MetricTile label="Pages" value={totalPages} hint="Discovered URLs" tone="good" />
          </div>
        </SlideUp>

        <SlideUp delay={0.05} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink-950">Coverage mix</h2>
          <p className="mb-4 text-sm text-ink-500">How your SEO stack is weighted right now</p>
          <DonutBreakdown
            segments={coverageSegments}
            centerLabel="signals"
            centerValue={totalKeywords + totalPages + totalCrawls || "—"}
          />
        </SlideUp>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <SlideUp className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Project scoreboard</h2>
              <p className="text-sm text-ink-500">Relative activity by site (keywords · pages · crawls)</p>
            </div>
            <Link href="/app/sites" className="text-sm font-medium text-accent-dark hover:underline">
              All sites
            </Link>
          </div>
          {siteBars.length ? (
            <BarSeries items={siteBars} />
          ) : (
            <p className="text-sm text-ink-500">Add a site to populate the scoreboard.</p>
          )}
          <div className="mt-5 space-y-2">
            {sites.slice(0, 4).map((site) => (
              <Link
                key={site.id}
                href={`/app/sites/${site.id}`}
                className="flex items-center justify-between rounded-xl border border-ink-100 px-4 py-3 transition-colors hover:border-accent hover:bg-accent-soft/30"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{site.name}</p>
                  <p className="text-xs text-ink-500">{site.domain}</p>
                </div>
                <div className="text-right text-xs text-ink-500">
                  <p>{site._count.keywords} kw</p>
                  <p>
                    {site._count.crawls} crawls · {site._count.pages} pages
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </SlideUp>

        <SlideUp delay={0.06} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="font-display text-xl font-semibold">Recommended next steps</h2>
          <p className="mb-4 text-sm text-ink-500">Auto SEO style action queue for this workspace</p>
          <div className="space-y-2">
            {actions.map((a) => (
              <ActionRow key={a.title} {...a} />
            ))}
          </div>
        </SlideUp>
      </div>

      <SlideUp delay={0.08}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Jump into tools</h2>
          <Link href="/app/toolkits" className="text-sm font-medium text-accent-dark">
            Browse all toolkits
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition-colors hover:border-accent hover:bg-accent-soft/25"
            >
              <p className="font-display text-lg font-semibold text-ink-950">{item.title}</p>
              <p className="mt-1 text-sm text-ink-500">{item.detail}</p>
              <p className="mt-3 text-xs font-semibold text-accent-dark">Open →</p>
            </Link>
          ))}
        </div>
      </SlideUp>
    </div>
  );
}
