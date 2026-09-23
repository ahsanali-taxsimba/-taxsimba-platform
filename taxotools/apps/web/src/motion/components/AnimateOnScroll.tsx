"use client";

import { m, type HTMLMotionProps, useInView } from "framer-motion";
import { useRef } from "react";
import { slideUp, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

type Props = HTMLMotionProps<"div"> & {
  once?: boolean;
  amount?: number;
  delay?: number;
};

/** Viewport-triggered entrance animation */
export function AnimateOnScroll({
  once = true,
  amount = 0.2,
  delay = 0,
  children,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once, amount });
  const reduce = usePrefersReducedMotion();

  return (
    <m.div
      ref={ref}
      variants={reduce ? reducedMotionVariants : slideUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={reduce ? { duration: 0 } : { delay }}
      {...rest}
    >
      {children}
    </m.div>
  );
}
