"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MotionButton, FadeIn, SlideUp } from "@/motion";

type Payload = {
  summary?: {
    status: string;
    frequency: string;
    maxDepth: number;
    parallelThreads: number;
    respectRobots: boolean;
    storeFormat: string;
    runs: number;
    extracts: number;
    serpSnapshots?: number;
    crawlerLogs?: number;
    byModule?: Record<string, number>;
    queues?: string[];
    workers?: string[];
    dbSchema?: string[];
    ukDirectories?: string[];
    accountingDirectories?: string[];
    govSources?: string[];
  };
  init?: Record<string, unknown>;
  architecture?: {
    queues?: string[];
    workers?: string[];
    dbSchema?: unknown;
    ukDirectories?: string[];
    accountingDirectories?: string[];
    govSources?: string[];
    dispatched?: Array<{ queue: string; worker: string; jobId: string }>;
  };
  pages?: Array<Record<string, unknown>>;
  logs?: string[];
  error?: string;
};

const INIT_BODY = {
  enable: ["backlinks", "keywords", "serp", "competitors", "traffic"],
  providers: [
    "ahrefs",
    "semrush",
    "majestic",
    "dataforseo",
    "serpapi",
    "google_index",
    "bing_index",
  ],
  ukDirectories: [
    "yell.com",
    "192.com",
    "thomsonlocal.com",
    "checkatrade.com",
    "ukbusinessforums.co.uk",
    "freeindex.co.uk",
    "hotfrog.co.uk",
    "businessmagnet.co.uk",
    "applegate.co.uk",
    "approvedbusiness.co.uk",
  ],
  accountingDirectories: [
    "icaew.com/find-a-chartered-accountant",
    "accaglobal.com/uk/en/member/find-an-accountant",
    "aat.org.uk/aat-directory",
    "ifa.org.uk/find-a-member",
    "gorillaaccounting.com",
    "crunch.co.uk/accountants-directory",
  ],
  govSources: ["gov.uk", "companieshouse.gov.uk", "hmrc.gov.uk"],
  queues: [
    "crawl.urls",
    "crawl.api.backlinks",
    "crawl.api.serp",
    "crawl.api.index",
    "process.raw",
    "alerts.events",
  ],
  workers: [
    "url_crawler",
    "backlink_api",
    "serp_api",
    "index_api",
    "processor",
    "alerts",
  ],
  dbSchema: [
    "projects",
    "crawler_configs",
    "crawl_jobs",
    "backlinks",
    "serp_snapshots",
    "raw_documents",
    "crawler_logs",
  ],
  crawlModes: ["live", "scheduled", "deep", "external"],
  frequency: "6h",
  maxDepth: 12,
  parallelThreads: 32,
  respectRobots: true,
  extract: ["links", "anchors", "metadata", "schemas", "keywords", "geo", "language"],
  storeFormat: "jsonl",
  autoClean: true,
  errorRetry: 3,
  logLevel: "verbose",
};

export function CrawlerMasterPanel({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "init" | "run", mode?: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sites/${siteId}/crawler-master`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        mode,
        ...INIT_BODY,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setData(json);
    router.refresh();
  }

  const s = data?.summary;
  const arch = data?.architecture;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap gap-3">
          <MotionButton type="button" disabled={busy} onClick={() => run("init")}>
            {busy ? "Running…" : "seo.crawler.master.init"}
          </MotionButton>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("run", "live")}
            className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
          >
            Live crawl
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("run", "deep")}
            className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
          >
            Deep crawl
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("run", "external")}
            className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
          >
            External crawl
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          --enable=backlinks…traffic · --uk-directories=yell.com… ·
          --accounting-directories=icaew… · --gov-sources=gov.uk,companieshouse,hmrc ·
          --queues=crawl.urls…alerts.events · 6h · depth=12 · threads=32 · jsonl · verbose
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </FadeIn>

      {s && (
        <SlideUp>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Status", s.status],
              ["Extracts", s.extracts],
              ["Depth / Threads", `${s.maxDepth} / ${s.parallelThreads}`],
              ["Frequency", s.frequency],
            ].map(([label, val]) => (
              <div key={String(label)} className="border-t border-ink-100 pt-3">
                <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
                <p className="font-display text-2xl font-semibold text-ink-900">{val}</p>
              </div>
            ))}
          </div>
          {s.byModule && (
            <p className="mt-3 text-sm text-ink-500">
              By module:{" "}
              {Object.entries(s.byModule)
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")}
            </p>
          )}
          {(s.queues || arch?.queues) && (
            <p className="mt-2 text-sm text-ink-500">
              Queues: {(s.queues || arch?.queues || []).join(", ")}
            </p>
          )}
          {(s.workers || arch?.workers) && (
            <p className="mt-1 text-sm text-ink-500">
              Workers: {(s.workers || arch?.workers || []).join(", ")}
            </p>
          )}
          {(s.dbSchema || (arch?.dbSchema as string[] | undefined)) && (
            <p className="mt-1 text-sm text-ink-500">
              Schema:{" "}
              {(
                (s.dbSchema as string[]) ||
                (arch?.dbSchema as string[]) ||
                []
              ).join(", ")}
            </p>
          )}
          {(s.ukDirectories || arch?.ukDirectories) && (
            <p className="mt-1 text-sm text-ink-500">
              UK directories ({(s.ukDirectories || arch?.ukDirectories || []).length}):{" "}
              {(s.ukDirectories || arch?.ukDirectories || []).slice(0, 5).join(", ")}
              {(s.ukDirectories || arch?.ukDirectories || []).length > 5 ? "…" : ""}
            </p>
          )}
          {(s.accountingDirectories || arch?.accountingDirectories) && (
            <p className="mt-1 text-sm text-ink-500">
              Accounting dirs ({(s.accountingDirectories || arch?.accountingDirectories || []).length}
              ): {(s.accountingDirectories || arch?.accountingDirectories || []).slice(0, 3).join(", ")}
              …
            </p>
          )}
          {(s.govSources || arch?.govSources) && (
            <p className="mt-1 text-sm text-ink-500">
              Gov sources: {(s.govSources || arch?.govSources || []).join(", ")}
            </p>
          )}
          {typeof s.serpSnapshots === "number" && (
            <p className="mt-1 text-sm text-ink-500">
              SERP snapshots: {s.serpSnapshots} · logs: {s.crawlerLogs ?? 0}
            </p>
          )}
        </SlideUp>
      )}

      {data?.logs && data.logs.length > 0 && (
        <pre className="max-h-40 overflow-auto rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
          {data.logs.join("\n")}
        </pre>
      )}

      {data?.pages && data.pages.length > 0 && (
        <div className="overflow-auto rounded-xl border border-ink-100 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Depth</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.slice(0, 25).map((row, i) => (
                <tr key={i} className="border-b border-ink-50">
                  <td className="max-w-[260px] truncate px-3 py-2">{String(row.name || "")}</td>
                  <td className="px-3 py-2">{String(row.status || "")}</td>
                  <td className="px-3 py-2">{String(row.score ?? "—")}</td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-ink-500">
                    {String(row.note || "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
