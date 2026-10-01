"use client";

import { useRef, type ReactNode } from "react";
import { m, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * GPU-friendly scroll parallax. Uses transform + will-change only.
 * Disabled when prefers-reduced-motion is set.
 */
export function ScrollParallax({
  children,
  className,
  speed = 0.2,
  opacityRange,
  scaleRange,
}: {
  children: ReactNode;
  className?: string;
  /** Positive = moves slower than scroll (recedes). Negative = advances. */
  speed?: number;
  opacityRange?: [number, number];
  scaleRange?: [number, number];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [speed * -120, speed * 120]);
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.35, 0.75, 1],
    reduce || !opacityRange ? [1, 1, 1, 1] : [opacityRange[0], 1, 1, opacityRange[1]],
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    reduce || !scaleRange ? [1, 1, 1] : [scaleRange[0], 1, scaleRange[1]],
  );

  return (
    <m.div
      ref={ref}
      className={cn("will-change-transform", className)}
      style={{ y, opacity, scale }}
    >
      {children}
    </m.div>
  );
}
