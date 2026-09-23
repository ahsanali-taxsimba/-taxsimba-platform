"use client";

import { MotionProvider } from "@/motion/MotionProvider";
import { PageTransition } from "@/motion/PageTransition";

export function AppMotionShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <PageTransition>{children}</PageTransition>
    </MotionProvider>
  );
}
