"use client";

import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card } from "./Card";
import { hoverLift } from "@/ui/animations";

function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

export function MetricCard({
  label,
  value,
  hint,
  trend,
  trendLabel,
  gradient = false,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  trend?: number;
  trendLabel?: string;
  gradient?: boolean;
  className?: string;
}) {
  const numeric = typeof value === "number" ? value : null;
  const counted = useCountUp(numeric ?? 0);
  const shown = numeric == null ? value : counted;
  const up = (trend ?? 0) > 0;
  const down = (trend ?? 0) < 0;

  return (
    <m.div initial="rest" whileHover="hover" whileTap="tap" variants={hoverLift} className={className}>
      <Card
        surface={gradient ? "gradient" : "glass"}
        className={cn("min-h-[132px]", !gradient && "bg-gradient-to-br from-[var(--bg-panel)] to-[var(--accent-soft)]")}
        data-testid={`metric-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{shown}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="opacity-70">{hint}</span>
          {trend != null && (
            <span
              className={cn(
                "rounded-pill px-2 py-0.5 font-semibold",
                up && "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]",
                down && "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]",
                !up && !down && "bg-[var(--bg-muted)] text-[var(--text-secondary)]",
              )}
            >
              {up ? "▲" : down ? "▼" : "●"} {Math.abs(trend)}%
              {trendLabel ? ` ${trendLabel}` : ""}
            </span>
          )}
        </div>
      </Card>
    </m.div>
  );
}
