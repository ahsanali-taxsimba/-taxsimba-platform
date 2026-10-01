"use client";

import { m } from "framer-motion";
import { usePathname } from "next/navigation";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

/** Lightweight enter animation — no exit wait (mode=wait felt sluggish). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = usePrefersReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <m.div
      key={pathname}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}
