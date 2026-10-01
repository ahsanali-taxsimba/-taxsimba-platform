"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { scaleIn, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

type Props = HTMLMotionProps<"div"> & { delay?: number };

export function ScaleIn({ delay = 0, children, ...rest }: Props) {
  const reduce = usePrefersReducedMotion();

  return (
    <m.div
      variants={reduce ? reducedMotionVariants : scaleIn}
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
