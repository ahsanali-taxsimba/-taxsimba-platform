"use client";

import { m } from "framer-motion";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";
import { durations, easings } from "@/motion/config";

type Point = { label?: string; value: number };

/** Lightweight SVG rank/visibility sparkline with animated stroke + bars */
export function RankTrackingChart({
  points,
  height = 96,
  color = "#0F9F8F",
}: {
  points: Point[];
  height?: number;
  color?: string;
}) {
  const reduce = usePrefersReducedMotion();
  const width = 320;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = Math.max(max - min, 1);

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
    const y = height - ((p.value - min) / range) * (height - 16) - 8;
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");

  return (
    <div className="w-full overflow-hidden rounded-xl border border-ink-100 bg-white p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-ink-500">Rank / visibility trend</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label="Rank chart">
        <m.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: durations.slow, ease: easings.smooth }
          }
        />
        {coords.map((c, i) => (
          <m.circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={3.5}
            fill={color}
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={
              reduce
                ? { duration: 0 }
                : { delay: 0.05 * i + 0.2, duration: durations.fast }
            }
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-ink-500">
        {points.map((p, i) => (
          <span key={i}>{p.label ?? p.value}</span>
        ))}
      </div>
    </div>
  );
}

/** Animated horizontal bar for AEO share-of-voice */
export function SovBar({
  label,
  value,
  delay = 0,
}: {
  label: string;
  value: number;
  delay?: number;
}) {
  const reduce = usePrefersReducedMotion();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-ink-500">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <m.div
          className="h-full rounded-full bg-accent origin-left"
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ width: `${pct}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { delay, duration: durations.slow, ease: easings.smooth }
          }
        />
      </div>
    </div>
  );
}
