"use client";

import { m } from "framer-motion";
import { staggerContainer, staggerItem, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

type Column = { key: string; label: string };

type Props = {
  columns: Column[];
  rows: Array<Record<string, unknown>>;
  className?: string;
  maxRows?: number;
};

export function AnimatedTable({ columns, rows, className, maxRows = 50 }: Props) {
  const reduce = usePrefersReducedMotion();

  return (
    <div className={cn("overflow-auto rounded-xl border border-ink-100 bg-white", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase text-ink-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <m.tbody
          variants={reduce ? reducedMotionVariants : staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {rows.slice(0, maxRows).map((row, idx) => (
            <m.tr
              key={idx}
              variants={reduce ? reducedMotionVariants : staggerItem}
              className="border-b border-ink-50"
            >
              {columns.map((c) => (
                <td key={c.key} className="max-w-[240px] truncate px-3 py-2">
                  {formatCell(row[c.key])}
                </td>
              ))}
            </m.tr>
          ))}
        </m.tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value);
}
