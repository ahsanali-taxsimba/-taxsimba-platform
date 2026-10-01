"use client";

import { m, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { hoverLift } from "./variants";

type Depth = 0 | 1 | 2 | 3 | 4;

const depthStyle: Record<Depth, string> = {
  0: "z-0",
  1: "z-[1] shadow-[0_8px_24px_rgba(10,42,106,0.06)]",
  2: "z-[2] shadow-[0_16px_40px_rgba(10,42,106,0.1)]",
  3: "z-[3] shadow-[0_24px_56px_rgba(10,42,106,0.14)]",
  4: "z-[4] shadow-[0_32px_72px_rgba(10,42,106,0.18)]",
};

const depthScale: Record<Depth, number> = {
  0: 0.98,
  1: 1,
  2: 1.01,
  3: 1.02,
  4: 1.035,
};

/**
 * Apple-style depth layer — scale + soft shadow stacking without heavy blur.
 */
export function DepthLayer({
  depth = 1,
  interactive = false,
  className,
  children,
  ...rest
}: HTMLMotionProps<"div"> & { depth?: Depth; interactive?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <m.div
      className={cn(
        "relative transform-gpu rounded-[22px]",
        depthStyle[depth],
        interactive && "cursor-pointer",
        className,
      )}
      style={{
        transform: reduce ? undefined : `scale(${depthScale[depth]})`,
        transformOrigin: "center center",
      }}
      initial={reduce ? false : { opacity: 0, y: 16 + depth * 2 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: depth * 0.04 }}
      whileHover={interactive && !reduce ? hoverLift.hover : undefined}
      whileTap={interactive && !reduce ? hoverLift.tap : undefined}
      {...rest}
    >
      {children}
    </m.div>
  );
}
