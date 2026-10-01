"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MotionButton, FadeIn, SlideUp } from "@/motion";

type Summary = {
  summary?: {
    total: number;
    toxic: number;
    highValue: number;
    normal: number;
    competitorMonitored: number;
    openAlerts: number;
    disavowPending: number;
  };
  init?: Record<string, unknown>;
  pages?: Array<Record<string, unknown>>;
  alerts?: Array<{ rule: string; message: string; severity: string }>;
  providerResults?: Array<{
    provider: string;
    mode: string;
    links: number;
    error?: string | null;
  }>;
  providers?: Array<{ id: string; displayName: string; configured: boolean }>;
  content?: string;
  filename?: string;
  error?: string;
};

export function BacklinksEnginePanel({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "init" | "refresh" | "disavow_export" | "competitors") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sites/${siteId}/backlinks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        sourceApis: ["crawlgraph", "openpagerank"],
        crawlMode: "external",
        refreshInterval: "24h",
        enableDisavow: true,
        enableCompetitorMonitoring: true,
        competitors: ["ahrefs.com", "semrush.com"],
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

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap gap-3">
          <MotionButton type="button" disabled={busy} onClick={() => run("init")}>
            {busy ? "Running…" : "seo.backlinks.init"}
          </MotionButton>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("refresh")}
            className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
          >
            Refresh (24h engine)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("disavow_export")}
            className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
          >
            Export disavow
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("competitors")}
            className="rounded-lg border border-ink-100 px-4 py-2 text-sm"
          >
            Competitor monitor
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Sources: crawlgraph + openpagerank (live when keys set; stub fallback) ·
          crawl=external · score=(authority×relevance)−(spam×risk) · toxic: spam&gt;70 ||
          risk&gt;0.6
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </FadeIn>

      {s && (
        <SlideUp>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total", s.total],
              ["High value", s.highValue],
              ["Toxic", s.toxic],
              ["Disavow pending", s.disavowPending],
            ].map(([label, val]) => (
              <div key={String(label)} className="border-t border-ink-100 pt-3">
                <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
                <p className="font-display text-2xl font-semibold text-ink-900">{val}</p>
              </div>
            ))}
          </div>
          {data?.providerResults && data.providerResults.length > 0 && (
            <p className="mt-3 text-sm text-ink-500">
              Providers:{" "}
              {data.providerResults
                .map((p) => `${p.provider}=${p.mode}(${p.links})`)
                .join(" · ")}
            </p>
          )}
        </SlideUp>
      )}

      {data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-800">Alerts</p>
          {data.alerts.map((a, i) => (
            <p key={i} className="text-sm text-ink-600">
              <span className="font-medium text-warn">{a.rule}</span> — {a.message}
            </p>
          ))}
        </div>
      )}

      {data?.content && (
        <pre className="max-h-48 overflow-auto rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
          {data.content}
        </pre>
      )}

      {data?.pages && data.pages.length > 0 && (
        <div className="overflow-auto rounded-xl border border-ink-100 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Authority</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.slice(0, 30).map((row, i) => (
                <tr key={i} className="border-b border-ink-50">
                  <td className="max-w-[240px] truncate px-3 py-2">{String(row.name || "")}</td>
                  <td className="px-3 py-2">{String(row.status || "")}</td>
                  <td className="px-3 py-2">{String(row.score ?? "—")}</td>
                  <td className="px-3 py-2">{String(row.metric ?? "—")}</td>
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
