"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { staggerContainer, staggerItem, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

type ContainerProps = HTMLMotionProps<"div"> & {
  fast?: boolean;
};

export function StaggerChildren({ children, fast, ...rest }: ContainerProps) {
  const reduce = usePrefersReducedMotion();

  return (
    <m.div
      variants={reduce ? reducedMotionVariants : staggerContainer}
      initial="hidden"
      animate="visible"
      {...rest}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div">) {
  const reduce = usePrefersReducedMotion();

  return (
    <m.div variants={reduce ? reducedMotionVariants : staggerItem} {...rest}>
      {children}
    </m.div>
  );
}
