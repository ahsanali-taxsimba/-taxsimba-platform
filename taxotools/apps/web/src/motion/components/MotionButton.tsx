"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { buttonHover } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

type Props = HTMLMotionProps<"button"> & {
  variant?: "primary" | "ghost" | "outline";
};

export function MotionButton({
  variant = "primary",
  className,
  children,
  ...rest
}: Props) {
  const reduce = usePrefersReducedMotion();

  const styles =
    variant === "primary"
      ? "bg-accent text-apple-inverse hover:bg-accent-dark shadow-none"
      : variant === "outline"
        ? "border border-apple-border bg-apple-panel text-apple-text hover:bg-apple-bg"
        : "bg-transparent text-apple-text hover:text-apple-link";

  return (
    <m.button
      className={cn(
        "inline-flex items-center justify-center rounded-pill px-6 py-2.5 text-label will-change-transform disabled:opacity-60",
        styles,
        className,
      )}
      initial={reduce ? false : "rest"}
      whileHover={reduce ? undefined : "hover"}
      whileTap={reduce ? undefined : "tap"}
      variants={reduce ? undefined : buttonHover}
      {...rest}
    >
      {children}
    </m.button>
  );
}
