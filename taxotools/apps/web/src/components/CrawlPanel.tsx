"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { m } from "framer-motion";
import { MotionButton, SlideUp, ScaleIn, MotionModal } from "@/motion";
import { staggerContainer, staggerItem, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

export function CrawlPanel({
  siteId,
  crawls,
  healthScore,
}: {
  siteId: string;
  crawls: Array<{
    id: string;
    status: string;
    pagesFound: number;
    issuesFound: number;
    createdAt: string | Date;
    _count: { issues: number; pages: number };
  }>;
  healthScore: number | null;
}) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  async function start() {
    setBusy(true);
    const res = await fetch(`/api/sites/${siteId}/crawls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxPages: 50 }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Crawl ${data.crawl.id} queued` : data.error);
    router.refresh();
  }

  const issueRows = crawls.flatMap((c) =>
    Array.from({ length: Math.min(c.issuesFound || c._count.issues, 5) }, (_, i) => ({
      crawlId: c.id,
      issue: `Issue #${i + 1}`,
      severity: i === 0 ? "HIGH" : i < 3 ? "MEDIUM" : "LOW",
      when: c.createdAt,
    })),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <MotionButton type="button" disabled={busy} onClick={start}>
          {busy ? "Starting…" : "Start crawl"}
        </MotionButton>
        <MotionButton type="button" variant="outline" onClick={() => setIssueOpen(true)}>
          View issue list
        </MotionButton>
        {healthScore != null && (
          <ScaleIn>
            <span className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-dark">
              Health {healthScore}
            </span>
          </ScaleIn>
        )}
      </div>
      {msg && <p className="text-sm text-accent-dark">{msg}</p>}

      <SlideUp>
        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pages</th>
                <th className="px-4 py-3">Issues</th>
              </tr>
            </thead>
            <m.tbody
              variants={reduce ? reducedMotionVariants : staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {crawls.map((c) => (
                <m.tr
                  key={c.id}
                  variants={reduce ? reducedMotionVariants : staggerItem}
                  className="border-b border-ink-50"
                >
                  <td className="px-4 py-3">{new Date(c.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{c.status}</td>
                  <td className="px-4 py-3">{c.pagesFound || c._count.pages}</td>
                  <td className="px-4 py-3">{c.issuesFound || c._count.issues}</td>
                </m.tr>
              ))}
            </m.tbody>
          </table>
        </div>
      </SlideUp>

      <MotionModal open={issueOpen} onClose={() => setIssueOpen(false)} title="SEO audit issues">
        <m.ul
          className="max-h-80 space-y-2 overflow-auto"
          variants={reduce ? reducedMotionVariants : staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {issueRows.length === 0 && (
            <li className="text-sm text-ink-500">No issues yet — run a crawl.</li>
          )}
          {issueRows.map((row, idx) => (
            <m.li
              key={`${row.crawlId}-${idx}`}
              variants={reduce ? reducedMotionVariants : staggerItem}
              className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
            >
              <span className="font-medium">{row.issue}</span>
              <span className="ml-2 text-xs text-ink-500">{row.severity}</span>
            </m.li>
          ))}
        </m.ul>
      </MotionModal>
    </div>
  );
}
