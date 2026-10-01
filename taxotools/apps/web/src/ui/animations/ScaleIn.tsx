"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import { scaleIn, durations, easings } from "./variants";

export function ScaleIn({
  children,
  className,
  delay = 0,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={className}
      variants={scaleIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
      transition={{ delay, duration: durations.fast, ease: easings.soft }}
    >
      {children}
    </m.div>
  );
}
