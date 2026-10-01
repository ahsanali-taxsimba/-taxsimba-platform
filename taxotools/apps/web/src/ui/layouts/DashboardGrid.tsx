"use client";

import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "@/ui/animations/Stagger";

export function DashboardGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
        ? "sm:grid-cols-2 xl:grid-cols-3"
        : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <Stagger className={cn("grid gap-4", cols, className)} data-testid="dashboard-grid">
      {Array.isArray(children)
        ? children.map((child, i) => <StaggerItem key={i}>{child}</StaggerItem>)
        : <StaggerItem>{children}</StaggerItem>}
    </Stagger>
  );
}
