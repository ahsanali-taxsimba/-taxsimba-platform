"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { slideUp } from "@/ui/animations";

export type FabAction = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
};

export function FloatingActionBar({
  actions,
  className,
}: {
  actions: FabAction[];
  className?: string;
}) {
  if (!actions.length) return null;
  return (
    <m.div
      variants={slideUp}
      initial="hidden"
      animate="visible"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4",
        className,
      )}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-pill border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-2 shadow-[0_16px_40px_rgba(29,29,31,0.14)] backdrop-blur-xl">
        {actions.map((action) => {
          const className = cn(
            "rounded-pill px-4 py-2 text-sm font-semibold transition-colors",
            action.primary
              ? "bg-[var(--accent-blue)] text-[var(--text-inverse)] hover:bg-[var(--link-blue-hover)]"
              : "bg-transparent text-[var(--text-main)] hover:bg-[var(--bg-muted)]",
          );
          if (action.href) {
            return (
              <a key={action.id} href={action.href} className={className}>
                {action.label}
              </a>
            );
          }
          return (
            <button key={action.id} type="button" onClick={action.onClick} className={className}>
              {action.label}
            </button>
          );
        })}
      </div>
    </m.div>
  );
}
