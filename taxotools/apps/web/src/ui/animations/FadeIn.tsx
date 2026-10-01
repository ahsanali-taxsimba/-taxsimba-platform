"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { fadeIn } from "./variants";

export function FadeIn({
  children,
  className,
  delay = 0,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <m.div
      className={className}
      variants={fadeIn}
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
