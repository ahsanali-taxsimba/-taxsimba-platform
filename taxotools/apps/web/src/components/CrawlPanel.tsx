"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CrawlPanel({
  siteId,
  crawls,
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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
      >
        {busy ? "Starting…" : "Start crawl"}
      </button>
      {msg && <p className="text-sm text-accent-dark">{msg}</p>}
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
          <tbody>
            {crawls.map((c) => (
              <tr key={c.id} className="border-b border-ink-50">
                <td className="px-4 py-3">{new Date(c.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{c.status}</td>
                <td className="px-4 py-3">{c.pagesFound || c._count.pages}</td>
                <td className="px-4 py-3">{c.issuesFound || c._count.issues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
