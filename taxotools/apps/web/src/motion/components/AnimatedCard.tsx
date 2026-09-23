"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { cardHover } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

type Props = HTMLMotionProps<"div"> & {
  interactive?: boolean;
};

export function AnimatedCard({
  interactive = true,
  className,
  children,
  ...rest
}: Props) {
  const reduce = usePrefersReducedMotion();

  return (
    <m.div
      className={cn(
        "rounded-xl border border-ink-100 bg-white will-change-transform",
        className,
      )}
      initial={reduce ? false : "rest"}
      whileHover={interactive && !reduce ? "hover" : undefined}
      whileTap={interactive && !reduce ? "tap" : undefined}
      variants={interactive && !reduce ? cardHover : undefined}
      {...rest}
    >
      {children}
    </m.div>
  );
}
