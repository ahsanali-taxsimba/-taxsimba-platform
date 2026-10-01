"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import { fadeIn, durations, easings } from "./variants";

export function FadeIn({
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

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
      transition={{ delay, duration: durations.normal, ease: easings.smooth }}
    >
      {children}
    </m.div>
  );
}
