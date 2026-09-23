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
      ? "bg-accent text-white hover:bg-accent-dark"
      : variant === "outline"
        ? "border border-ink-100 bg-white text-ink-800"
        : "bg-transparent text-ink-700";

  return (
    <m.button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold will-change-transform disabled:opacity-60",
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
