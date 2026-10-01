"use client";

import { m } from "framer-motion";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  hint,
  tone = "default",
  children,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warn" | "accent";
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === "good"
      ? "from-accent-soft/80 to-white"
      : tone === "warn"
        ? "from-amber-50 to-white"
        : tone === "accent"
          ? "from-sky-50 to-white"
          : "from-white to-ink-50/60";

  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-100 bg-gradient-to-br p-4 shadow-sm",
        toneClass,
      )}
      data-testid={`metric-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-ink-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function UsageGauge({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = limit < 0 ? 12 : limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? "#DC2626" : pct >= 70 ? "#D97706" : "#0F9F8F";
  return (
    <MetricTile
      label={label}
      value={limit < 0 ? `${used} / ∞` : `${used} / ${limit}`}
      hint={limit < 0 ? "Unlimited on this plan" : `${pct}% of plan used`}
      tone={pct >= 90 ? "warn" : "default"}
    >
      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </MetricTile>
  );
}

export function ScoreRing({
  score,
  label,
  size = 132,
}: {
  score: number | null;
  label: string;
  size?: number;
}) {
  const reduce = usePrefersReducedMotion();
  const value = score ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const color = value >= 80 ? "#0F9F8F" : value >= 55 ? "#D97706" : value > 0 ? "#DC2626" : "#A8B3C7";

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={label}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#E8EDF5" strokeWidth="12" />
        <m.circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          transform="rotate(-90 70 70)"
        />
        <text
          x="70"
          y="74"
          textAnchor="middle"
          className="fill-ink-950"
          style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-display)" }}
        >
          {score == null ? "—" : Math.round(score)}
        </text>
      </svg>
      <p className="mt-1 text-sm font-medium text-ink-700">{label}</p>
      <p className="text-xs text-ink-500">
        {score == null
          ? "Run a crawl to score this site"
          : score >= 80
            ? "Healthy — keep monitoring"
            : score >= 55
              ? "Needs attention this week"
              : "Priority fixes recommended"}
      </p>
    </div>
  );
}

export function Sparkline({
  points,
  color = "#0F9F8F",
  height = 56,
}: {
  points: number[];
  color?: string;
  height?: number;
}) {
  const reduce = usePrefersReducedMotion();
  const width = 240;
  const vals = points.length ? points : [0, 0];
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = Math.max(max - min, 1);
  const coords = vals.map((v, i) => {
    const x = vals.length === 1 ? width / 2 : (i / (vals.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 10) - 5;
    return `${x},${y}`;
  });
  const path = `M${coords.join(" L")}`;
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full" aria-hidden>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <m.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7 }}
      />
    </svg>
  );
}

export function BarSeries({
  items,
  color = "#0F9F8F",
}: {
  items: { label: string; value: number }[];
  color?: string;
}) {
  const reduce = usePrefersReducedMotion();
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex h-40 items-end gap-2">
      {items.map((item, idx) => {
        const h = Math.max(8, Math.round((item.value / max) * 100));
        return (
          <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
            <m.div
              className="w-full origin-bottom rounded-t-md"
              style={{ background: color, height: `${h}%` }}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: idx * 0.04, duration: 0.45 }}
              title={`${item.label}: ${item.value}`}
            />
            <span className="truncate text-center text-[10px] text-ink-500">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DonutBreakdown({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string | number;
}) {
  const total = Math.max(
    segments.reduce((s, x) => s + x.value, 0),
    1,
  );
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        {segments.map((seg) => {
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={seg.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += len;
          return el;
        })}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          style={{ fontSize: 18, fontWeight: 700, fill: "#0B1220" }}
        >
          {centerValue}
        </text>
        <text x="60" y="74" textAnchor="middle" style={{ fontSize: 10, fill: "#5B6B8C" }}>
          {centerLabel}
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2 text-ink-700">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
            <span className="flex-1">{seg.label}</span>
            <span className="font-medium text-ink-900">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SovBarList({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  const reduce = usePrefersReducedMotion();
  if (!items.length) {
    return <p className="text-sm text-ink-500">No AI visibility samples yet — run an AEO scan.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = Math.round(Math.max(0, Math.min(1, item.value)) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-xs text-ink-600">
              <span>{item.label}</span>
              <span className="font-medium text-ink-900">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
              <m.div
                className="h-full rounded-full bg-accent"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ActionRow({
  title,
  detail,
  href,
  cta,
}: {
  title: string;
  detail: string;
  href: string;
  cta: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 transition-colors hover:border-accent hover:bg-accent-soft/40"
      data-testid="dashboard-action"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-900">{title}</p>
        <p className="truncate text-xs text-ink-500">{detail}</p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-accent-dark">{cta}</span>
    </a>
  );
}
