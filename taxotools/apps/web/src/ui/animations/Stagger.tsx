"use client";

import type { ReactNode } from "react";
import { m } from "framer-motion";
import { staggerContainer, staggerItem } from "./variants";

export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div className={className} variants={staggerItem}>
      {children}
    </m.div>
  );
}
