"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { MotionButton, SlideUp, RankTrackingChart } from "@/motion";
import { staggerContainer, staggerItem, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

type Keyword = {
  id: string;
  phrase: string;
  volume: number | null;
  difficulty: number | null;
  intent: string | null;
  ranks: { position: number | null; hasAiOverview: boolean }[];
};

export function KeywordsPanel({
  siteId,
  initial,
}: {
  siteId: string;
  initial: Keyword[];
}) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const [phrases, setPhrases] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addKeywords() {
    setBusy(true);
    setMessage(null);
    const list = phrases
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const res = await fetch(`/api/sites/${siteId}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phrases: list }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Failed");
      return;
    }
    setPhrases("");
    setMessage(`Added ${data.keywords.length} keywords`);
    router.refresh();
  }

  async function runKeywordAction(next: "cluster" | "rank-check" | "gap") {
    setBusy(true);
    const res = await fetch(`/api/sites/${siteId}/keywords`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: next, competitorDomain: "semrush.com" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Failed");
      return;
    }
    setMessage(
      next === "gap"
        ? `Gap: ${data.gap.missing.length} missing vs competitor`
        : next === "cluster"
          ? `Created ${data.clusters.length} clusters`
          : "Rank check queued",
    );
    router.refresh();
  }

  const chartPoints = initial.slice(0, 8).map((kw) => ({
    label: kw.phrase.slice(0, 8),
    value: kw.ranks[0]?.position
      ? 41 - kw.ranks[0].position
      : kw.volume
        ? Math.min(40, kw.volume / 500)
        : 10,
  }));

  return (
    <div className="space-y-6">
      {chartPoints.length > 0 && (
        <SlideUp>
          <RankTrackingChart points={chartPoints} />
        </SlideUp>
      )}

      <SlideUp delay={0.05}>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <label className="text-sm font-medium">Add keywords (comma or newline)</label>
          <textarea
            className="mt-2 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
            rows={3}
            value={phrases}
            onChange={(e) => setPhrases(e.target.value)}
            placeholder="seo tools, ai overview tracking"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <MotionButton type="button" disabled={busy} onClick={addKeywords}>
              Add keywords
            </MotionButton>
            <MotionButton
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => runKeywordAction("rank-check")}
            >
              Run rank check
            </MotionButton>
            <MotionButton
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => runKeywordAction("cluster")}
            >
              Auto-cluster
            </MotionButton>
            <MotionButton
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => runKeywordAction("gap")}
            >
              Keyword gap
            </MotionButton>
          </div>
          {message && <p className="mt-3 text-sm text-accent-dark">{message}</p>}
        </div>
      </SlideUp>

      <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-3">Keyword</th>
              <th className="px-4 py-3">Vol</th>
              <th className="px-4 py-3">KD</th>
              <th className="px-4 py-3">Intent</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">AIO</th>
            </tr>
          </thead>
          <m.tbody
            variants={reduce ? reducedMotionVariants : staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {initial.map((kw) => (
              <m.tr
                key={kw.id}
                variants={reduce ? reducedMotionVariants : staggerItem}
                className="border-b border-ink-50"
              >
                <td className="px-4 py-3 font-medium">{kw.phrase}</td>
                <td className="px-4 py-3">{kw.volume ?? "—"}</td>
                <td className="px-4 py-3">{kw.difficulty ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{kw.intent ?? "—"}</td>
                <td className="px-4 py-3">{kw.ranks[0]?.position ?? "—"}</td>
                <td className="px-4 py-3">{kw.ranks[0]?.hasAiOverview ? "Yes" : "—"}</td>
              </m.tr>
            ))}
          </m.tbody>
        </table>
      </div>
    </div>
  );
}
