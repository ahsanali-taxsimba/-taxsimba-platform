"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { slideUp } from "./variants";

export function SlideUp({
  children,
  className,
  delay = 0,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <m.div
      className={className}
      variants={slideUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ delay }}
      {...rest}
    >
      {children}
    </m.div>
  );
}
