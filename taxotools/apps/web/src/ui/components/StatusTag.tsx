"use client";

import { cn } from "@/lib/utils";

const tones = {
  success: "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[var(--success)]",
  warn: "bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-[var(--warn)]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-[var(--danger)]",
  info: "bg-[var(--accent-soft)] text-[var(--accent-blue)]",
  neutral: "bg-[var(--bg-muted)] text-[var(--text-secondary)]",
} as const;

export function StatusTag({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
