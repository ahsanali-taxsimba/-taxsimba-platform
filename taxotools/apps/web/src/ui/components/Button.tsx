"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { hoverLift } from "@/ui/animations";

type Variant = "solid" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  solid:
    "bg-[var(--accent-blue)] text-[var(--text-inverse)] hover:bg-[var(--link-blue-hover)] border-transparent",
  outline:
    "bg-transparent text-[var(--text-main)] border-[var(--border-subtle)] hover:bg-[var(--bg-muted)]",
  ghost: "bg-transparent text-[var(--text-main)] border-transparent hover:bg-[var(--accent-soft)]",
};

const sizeClass: Record<Size, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-6 py-2.5 text-[15px]",
  lg: "px-7 py-3 text-[17px]",
};

export function Button({
  variant = "solid",
  size = "md",
  className,
  children,
  ...rest
}: HTMLMotionProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <m.button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill border font-semibold shadow-none transition-colors disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={hoverLift}
      {...rest}
    >
      {children}
    </m.button>
  );
}
