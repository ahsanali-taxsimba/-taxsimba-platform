"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { m } from "framer-motion";
import {
  AnimatedCard,
  StaggerChildren,
  StaggerItem,
  SlideUp,
  MotionButton,
  SovBar,
  RankTrackingChart,
} from "@/motion";
import { staggerContainer, staggerItem, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

export function AeoPanel({
  siteId,
  shareOfVoice,
  records,
}: {
  siteId: string;
  shareOfVoice: Array<{ code: string; name: string; shareOfVoice: number; samples: number }>;
  records: Array<{
    id: string;
    prompt: string;
    brandMentioned: boolean;
    sentiment: number | null;
    engine: { name: string };
    checkedAt: string | Date;
  }>;
}) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const [prompts, setPrompts] = useState(
    "best seo platform for agencies\nai search visibility tools",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function scan() {
    setBusy(true);
    const res = await fetch(`/api/sites/${siteId}/aeo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompts: prompts.split("\n").map((p) => p.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Queued scan for ${data.promptCount} prompts` : data.error);
    router.refresh();
  }

  const chartPoints = shareOfVoice.map((s) => ({
    label: s.name.slice(0, 6),
    value: Math.round(s.shareOfVoice * 100),
  }));

  return (
    <div className="space-y-6">
      {chartPoints.length > 0 && (
        <SlideUp>
          <RankTrackingChart points={chartPoints} color="#0F9F8F" />
        </SlideUp>
      )}

      <StaggerChildren className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shareOfVoice.map((s, i) => (
          <StaggerItem key={s.code}>
            <AnimatedCard className="p-4">
              <p className="text-xs uppercase text-ink-500">{s.name}</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {Math.round(s.shareOfVoice * 100)}%
              </p>
              <div className="mt-3">
                <SovBar label="Share of voice" value={s.shareOfVoice} delay={0.05 * i} />
              </div>
              <p className="mt-2 text-xs text-ink-500">{s.samples} samples</p>
            </AnimatedCard>
          </StaggerItem>
        ))}
        {!shareOfVoice.length && (
          <p className="text-sm text-ink-500">No AEO data yet — run a scan.</p>
        )}
      </StaggerChildren>

      <SlideUp delay={0.08}>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <label className="text-sm font-medium">Prompts (one per line)</label>
          <textarea
            className="mt-2 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
            rows={4}
            value={prompts}
            onChange={(e) => setPrompts(e.target.value)}
          />
          <MotionButton type="button" disabled={busy} onClick={scan} className="mt-3">
            {busy ? "Scanning…" : "Run AEO / GEO scan"}
          </MotionButton>
          {msg && <p className="mt-2 text-sm text-accent-dark">{msg}</p>}
        </div>
      </SlideUp>

      <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-3">Engine</th>
              <th className="px-4 py-3">Prompt</th>
              <th className="px-4 py-3">Mentioned</th>
              <th className="px-4 py-3">Sentiment</th>
              <th className="px-4 py-3">Checked</th>
            </tr>
          </thead>
          <m.tbody
            variants={reduce ? reducedMotionVariants : staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {records.map((r) => (
              <m.tr
                key={r.id}
                variants={reduce ? reducedMotionVariants : staggerItem}
                className="border-b border-ink-50"
              >
                <td className="px-4 py-3">{r.engine.name}</td>
                <td className="px-4 py-3">{r.prompt}</td>
                <td className="px-4 py-3">{r.brandMentioned ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  {r.sentiment != null ? r.sentiment.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3">{new Date(r.checkedAt).toLocaleString()}</td>
              </m.tr>
            ))}
          </m.tbody>
        </table>
      </div>
    </div>
  );
}
