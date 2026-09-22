"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContentAIPanel({
  siteId,
  jobs,
}: {
  siteId: string;
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    creditsUsed: number;
    createdAt: string | Date;
    outputJson: unknown;
  }>;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("ai search visibility");
  const [msg, setMsg] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/sites/${siteId}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ARTICLE",
        sync: true,
        input: { keyword, tone: "expert" },
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg(`Article job ${data.job.status}`);
    setOutput(JSON.stringify(data.job.outputJson, null, 2));
    router.refresh();
  }

  async function score() {
    setBusy(true);
    const res = await fetch(`/api/sites/${siteId}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "CONTENT_SCORE",
        input: {
          url: "https://example.com/guide",
          keyword,
          text: `# Guide to ${keyword}\n\n## Overview\n\nThis long-form draft covers ${keyword} with headings, FAQs, and actionable steps for SEO and AI visibility teams. `.repeat(
            40,
          ),
        },
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Content score: ${data.page.score}` : data.error);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ink-100 bg-white p-5">
        <label className="text-sm font-medium">Target keyword</label>
        <input
          className="mt-2 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={generate}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Generate article
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={score}
            className="rounded-lg border border-ink-100 px-3 py-2 text-sm"
          >
            Score draft
          </button>
        </div>
        {msg && <p className="mt-3 text-sm text-accent-dark">{msg}</p>}
        {output && (
          <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-ink-950 p-4 text-xs text-ink-100">
            {output}
          </pre>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Credits</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-ink-50">
                <td className="px-4 py-3">{j.type}</td>
                <td className="px-4 py-3">{j.status}</td>
                <td className="px-4 py-3">{j.creditsUsed}</td>
                <td className="px-4 py-3">{new Date(j.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
