"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { scaleIn } from "./variants";

export function ScaleIn({
  children,
  className,
  delay = 0,
  ...rest
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <m.div
      className={className}
      variants={scaleIn}
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
