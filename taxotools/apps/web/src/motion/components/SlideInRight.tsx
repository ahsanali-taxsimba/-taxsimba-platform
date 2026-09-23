"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { slideInRight, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

type Props = HTMLMotionProps<"div"> & { delay?: number };

export function SlideInRight({ delay = 0, children, ...rest }: Props) {
  const reduce = usePrefersReducedMotion();

  return (
    <m.div
      variants={reduce ? reducedMotionVariants : slideInRight}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={reduce ? { duration: 0 } : { delay }}
      {...rest}
    >
      {children}
    </m.div>
  );
}
