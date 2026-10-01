"use client";

import { MotionProvider } from "@/motion/MotionProvider";
import { PageTransition } from "@/motion/PageTransition";
import { ThemeProvider } from "@/ui/theme";

export function AppMotionShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultMode="light" defaultDepartment="default">
      <MotionProvider>
        <PageTransition>{children}</PageTransition>
      </MotionProvider>
    </ThemeProvider>
  );
}
