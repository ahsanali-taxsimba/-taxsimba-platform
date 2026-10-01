"use client";

import type { ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
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
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
}) {
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
    >
      {children}
    </m.div>
  );
}

export function StaggerChild({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
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
    >
      {children}
    </m.div>
  );
}
