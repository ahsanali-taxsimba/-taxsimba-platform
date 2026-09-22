"use client";

import { AnimatePresence, m } from "framer-motion";
import { usePathname } from "next/navigation";
import { pageVariants, reducedMotionVariants } from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

/** Wrap page content with AnimatePresence for route transitions */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = usePrefersReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={pathname}
        variants={reduce ? reducedMotionVariants : pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        className="will-change-transform"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
