"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { MotionButton, SlideUp, ScaleIn, MotionModal } from "@/motion";
import { staggerContainer, staggerItem, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

type CrawlRow = {
  id: string;
  status: string;
  pagesFound: number;
  issuesFound: number;
  createdAt: string | Date;
  errorMessage?: string | null;
  _count: { issues: number; pages: number };
};

type IssueRow = {
  id: string;
  type: string;
  severity: string;
  message: string;
  url: string;
};

export function CrawlPanel({
  siteId,
  crawls,
  healthScore,
  dataSource,
}: {
  siteId: string;
  crawls: CrawlRow[];
  healthScore: number | null;
  dataSource?: string;
}) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  const pending = crawls.some((c) => c.status === "QUEUED" || c.status === "RUNNING");

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [pending, router]);

  async function start() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/sites/${siteId}/crawls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxPages: 20 }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Crawl failed");
    } else {
      const transport = data.crawl?.transport || "queued";
      setMsg(
        transport === "inline"
          ? `Live crawl finished · ${data.crawl.pagesFound ?? 0} pages · ${data.crawl.issuesFound ?? 0} issues`
          : `Crawl ${data.crawl.id} queued (worker)`,
      );
    }
    router.refresh();
  }

  async function openIssues() {
    setIssueOpen(true);
    const latest = crawls.find((c) => c.status === "COMPLETED") || crawls[0];
    if (!latest) {
      setIssues([]);
      return;
    }
    setLoadingIssues(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/crawls?crawlId=${latest.id}`);
      const data = await res.json();
      setIssues(res.ok ? data.issues || [] : []);
    } finally {
      setLoadingIssues(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <MotionButton type="button" disabled={busy} onClick={start}>
          {busy ? "Crawling…" : "Start live crawl"}
        </MotionButton>
        <MotionButton type="button" variant="outline" onClick={() => void openIssues()}>
          View issue list
        </MotionButton>
        {healthScore != null && (
          <ScaleIn>
            <span className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-dark">
              Health {healthScore}
            </span>
          </ScaleIn>
        )}
        <span className="rounded-pill border border-ink-100 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-600">
          {dataSource === "live-http" ? "Live HTTP" : pending ? "Running" : "No crawl yet"}
        </span>
      </div>
      {msg && <p className="text-sm text-accent-dark">{msg}</p>}
      <p className="text-xs text-ink-500">
        Fetches your real pages over HTTP, extracts titles/meta/H1/schema, and writes issues to the
        database. Works inline when Redis/worker is offline.
      </p>

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
                  <td className="px-4 py-3">
                    {c.status}
                    {c.errorMessage ? (
                      <span className="mt-0.5 block max-w-xs truncate text-[11px] text-danger">
                        {c.errorMessage}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{c.pagesFound || c._count.pages}</td>
                  <td className="px-4 py-3">{c.issuesFound || c._count.issues}</td>
                </m.tr>
              ))}
              {!crawls.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                    No crawls yet — start a live crawl.
                  </td>
                </tr>
              )}
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
          {loadingIssues && <li className="text-sm text-ink-500">Loading issues…</li>}
          {!loadingIssues && issues.length === 0 && (
            <li className="text-sm text-ink-500">No issues yet — run a crawl.</li>
          )}
          {issues.map((row) => (
            <m.li
              key={row.id}
              variants={reduce ? reducedMotionVariants : staggerItem}
              className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.message}</span>
                <span className="text-[11px] font-semibold uppercase text-ink-500">{row.severity}</span>
                <span className="text-[11px] text-ink-400">{row.type}</span>
              </div>
              <p className="mt-1 truncate text-xs text-ink-500">{row.url}</p>
            </m.li>
          ))}
        </m.ul>
      </MotionModal>
    </div>
  );
}
