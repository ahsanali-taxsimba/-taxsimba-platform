"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  AnimatedCard,
  StaggerChildren,
  StaggerItem,
  SlideUp,
  FadeIn,
} from "@/motion";
import { staggerContainer, staggerItem, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

type UsageItem = { metric: string; used: number; limit: number };
type SiteRow = {
  id: string;
  name: string;
  domain: string;
  _count: { keywords: number; crawls: number; pages: number };
};

export function DashboardMotion({
  planName,
  siteCount,
  usageItems,
  sites,
}: {
  planName?: string;
  siteCount: number;
  usageItems: UsageItem[];
  sites: SiteRow[];
}) {
  const reduce = usePrefersReducedMotion();

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="font-display text-3xl font-semibold text-ink-950">Overview</h1>
        <p className="mt-1 text-ink-500">
          {planName} plan · {siteCount} site{siteCount === 1 ? "" : "s"} · workspace health at a
          glance
        </p>
      </FadeIn>

      <StaggerChildren className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {usageItems.map((item) => (
          <StaggerItem key={item.metric}>
            <AnimatedCard className="p-5">
              <p className="text-xs uppercase tracking-wide text-ink-500">
                {item.metric.replace("_", " ")}
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink-900">
                {item.used}
                <span className="text-base font-normal text-ink-300">
                  /{item.limit < 0 ? "∞" : item.limit}
                </span>
              </p>
            </AnimatedCard>
          </StaggerItem>
        ))}
      </StaggerChildren>

      <SlideUp delay={0.08}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Sites</h2>
          <Link href="/onboarding" className="text-sm font-medium text-accent-dark">
            Add site
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Keywords</th>
                <th className="px-4 py-3">Crawls</th>
                <th className="px-4 py-3">Pages</th>
              </tr>
            </thead>
            <m.tbody
              variants={reduce ? reducedMotionVariants : staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {sites.map((site) => (
                <m.tr
                  key={site.id}
                  variants={reduce ? reducedMotionVariants : staggerItem}
                  className="border-b border-ink-50 hover:bg-ink-50/80"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/sites/${site.id}`}
                      className="font-medium text-ink-900 hover:text-accent-dark"
                    >
                      {site.name}
                    </Link>
                    <p className="text-xs text-ink-500">{site.domain}</p>
                  </td>
                  <td className="px-4 py-3">{site._count.keywords}</td>
                  <td className="px-4 py-3">{site._count.crawls}</td>
                  <td className="px-4 py-3">{site._count.pages}</td>
                </m.tr>
              ))}
            </m.tbody>
          </table>
        </div>
      </SlideUp>

      <StaggerChildren className="grid gap-4 md:grid-cols-3">
        {[
          { href: sites[0] ? `/app/sites/${sites[0].id}/keywords` : "#", label: "Keyword intel" },
          { href: sites[0] ? `/app/sites/${sites[0].id}/technical` : "#", label: "Site health" },
          { href: sites[0] ? `/app/sites/${sites[0].id}/aeo` : "#", label: "AEO / GEO" },
        ].map((c) => (
          <StaggerItem key={c.label}>
            <Link href={c.href}>
              <AnimatedCard className="p-5">
                <p className="font-display text-lg font-semibold">{c.label}</p>
                <p className="mt-1 text-sm text-ink-500">Open module →</p>
              </AnimatedCard>
            </Link>
          </StaggerItem>
        ))}
      </StaggerChildren>
    </div>
  );
}
