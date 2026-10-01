"use client";

import { cn } from "@/lib/utils";
import { SlideUp } from "@/ui/animations/SlideUp";

export function SplitView({
  primary,
  secondary,
  primaryRatio = "lg",
  reverseOnMobile = false,
  className,
}: {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  primaryRatio?: "md" | "lg" | "xl";
  reverseOnMobile?: boolean;
  className?: string;
}) {
  const grid =
    primaryRatio === "xl"
      ? "xl:grid-cols-[1.6fr_1fr]"
      : primaryRatio === "md"
        ? "xl:grid-cols-[1.1fr_1fr]"
        : "xl:grid-cols-[1.35fr_1fr]";

  return (
    <div
      className={cn(
        "grid gap-4",
        grid,
        reverseOnMobile && "[&>*:first-child]:order-2 [&>*:last-child]:order-1 xl:[&>*]:order-none",
        className,
      )}
    >
      <SlideUp>{primary}</SlideUp>
      <SlideUp delay={0.05}>{secondary}</SlideUp>
    </div>
  );
}
