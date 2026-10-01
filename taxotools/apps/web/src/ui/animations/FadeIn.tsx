"use client";

import { m, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { fadeIn, durations, easings } from "./variants";

export function FadeIn({
  children,
  className,
  delay = 0,
  once = true,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number; once?: boolean }) {
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
      {...rest}
    >
      {children}
    </m.div>
  );
}
