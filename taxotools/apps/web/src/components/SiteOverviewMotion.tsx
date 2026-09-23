"use client";

import Link from "next/link";
import {
  FadeIn,
  SlideUp,
  StaggerChildren,
  StaggerItem,
  AnimatedCard,
  MotionButton,
} from "@/motion";

type Tool = { id: string; name: string; path: string };
type Group = { id: string; name: string; description: string; tools: readonly Tool[] };

export function SiteOverviewMotion({
  siteId,
  siteName,
  domain,
  url,
  healthScore,
  keywordCount,
  pageCount,
  sovAvg,
  groups,
}: {
  siteId: string;
  siteName: string;
  domain: string;
  url: string;
  healthScore: number | null;
  keywordCount: number;
  pageCount: number;
  sovAvg: string;
  groups: Group[];
}) {
  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-500">
              <Link href="/app/sites" className="hover:text-accent-dark">
                Sites
              </Link>{" "}
              / {domain}
            </p>
            <h1 className="font-display text-3xl font-semibold text-ink-950">{siteName}</h1>
            <p className="text-ink-500">{url}</p>
          </div>
          <Link href={`/app/sites/${siteId}/tools`}>
            <MotionButton type="button">Open full toolkit</MotionButton>
          </Link>
        </div>
      </FadeIn>

      <StaggerChildren className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Health score", value: healthScore ?? "—" },
          { label: "Keywords", value: keywordCount },
          { label: "Pages", value: pageCount },
          { label: "AI SOV (avg)", value: sovAvg },
        ].map((m) => (
          <StaggerItem key={m.label}>
            <AnimatedCard className="p-5">
              <p className="text-xs uppercase tracking-wide text-ink-500">{m.label}</p>
              <p className="mt-2 font-display text-3xl font-semibold">{m.value}</p>
            </AnimatedCard>
          </StaggerItem>
        ))}
      </StaggerChildren>

      {groups.map((group, gi) => (
        <SlideUp key={group.id} delay={0.04 * gi}>
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-semibold">{group.name}</h2>
              <p className="text-sm text-ink-500">{group.description}</p>
            </div>
            <StaggerChildren className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.tools.map((tool) => (
                <StaggerItem key={tool.id}>
                  <Link href={`/app/sites/${siteId}/tools/${tool.path}`}>
                    <AnimatedCard className="p-4">
                      <p className="font-medium text-ink-900">{tool.name}</p>
                      <p className="mt-1 text-xs text-ink-500">Open tool →</p>
                    </AnimatedCard>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </section>
        </SlideUp>
      ))}
    </div>
  );
}
