"use client";

import { m, type HTMLMotionProps } from "framer-motion";
import { staggerContainer, staggerItem } from "./variants";

export function Stagger({
  children,
  className,
  ...rest
}: HTMLMotionProps<"div">) {
  return (
    <m.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      {...rest}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: HTMLMotionProps<"div">) {
  return (
    <m.div className={className} variants={staggerItem} {...rest}>
      {children}
    </m.div>
  );
}
