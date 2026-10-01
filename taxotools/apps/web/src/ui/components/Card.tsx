"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { hoverLift, scaleIn } from "@/ui/animations";

type Surface = "glass" | "neu" | "solid" | "gradient";

const surfaceClass: Record<Surface, string> = {
  glass:
    "bg-[var(--glass)] border border-[var(--glass-border)] backdrop-blur-xl shadow-[0_8px_32px_rgba(29,29,31,0.08)]",
  neu: "bg-[var(--bg-panel)] border border-transparent shadow-[8px_8px_20px_rgba(29,29,31,0.08),-6px_-6px_16px_rgba(255,255,255,0.85)]",
  solid: "bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-[0_1px_2px_rgba(29,29,31,0.04),0_8px_24px_rgba(29,29,31,0.06)]",
  gradient:
    "border border-transparent bg-gradient-to-br from-[var(--gradient-a)] to-[var(--gradient-b)] text-[var(--text-inverse)] shadow-[0_16px_40px_rgba(0,113,227,0.22)]",
};

export function Card({
  surface = "glass",
  interactive = false,
  className,
  children,
  ...rest
}: HTMLMotionProps<"div"> & { surface?: Surface; interactive?: boolean }) {
  return (
    <m.div
      className={cn(
        "rounded-[22px] p-5",
        surfaceClass[surface],
        interactive && "cursor-pointer",
        className,
      )}
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      whileHover={interactive ? hoverLift.hover : undefined}
      whileTap={interactive ? hoverLift.tap : undefined}
      {...rest}
    >
      {children}
    </m.div>
  );
}
