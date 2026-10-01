"use client";

import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduce = usePrefersReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduce ? "always" : "user"}>{children}</MotionConfig>
    </LazyMotion>
  );
}
