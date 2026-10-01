"use client";

import { m, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { staggerContainer, staggerItem, easings, durations } from "./variants";

/**
 * Staggered reveal for text, icons, and card grids.
 * Uses whileInView so sections animate on scroll; respects reduced motion.
 */
export function StaggerChildren({
  children,
  className,
  stagger = 0.07,
  delayChildren = 0.06,
  ...rest
}: HTMLMotionProps<"div"> & { stagger?: number; delayChildren?: number }) {
  const reduce = useReducedMotion();

  return (
    <m.div
      className={className}
      variants={
        reduce
          ? undefined
          : {
              ...staggerContainer,
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: stagger,
                  delayChildren,
                },
              },
            }
      }
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "visible"}
      viewport={{ once: true, amount: 0.15 }}
      {...rest}
    >
      {children}
    </m.div>
  );
}

export function StaggerChild({
  children,
  className,
  ...rest
}: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className={className}
      variants={
        reduce
          ? undefined
          : {
              ...staggerItem,
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: durations.normal, ease: easings.smooth },
              },
            }
      }
      {...rest}
    >
      {children}
    </m.div>
  );
}
