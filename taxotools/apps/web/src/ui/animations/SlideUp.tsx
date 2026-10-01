"use client";

import { m, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { slideUp, durations, easings } from "./variants";

export function SlideUp({
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
      variants={slideUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
      transition={{ delay, duration: durations.normal, ease: easings.snappy }}
      {...rest}
    >
      {children}
    </m.div>
  );
}
