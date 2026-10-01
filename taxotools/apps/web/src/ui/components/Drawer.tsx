"use client";

import { AnimatePresence, m } from "framer-motion";
import { drawerSlide, fadeIn } from "@/ui/animations";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onClose,
  side = "left",
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: React.ReactNode;
  className?: string;
}) {
  const variants = drawerSlide(side);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <m.button
            type="button"
            aria-label="Close drawer"
            className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />
          <m.aside
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "absolute top-0 h-full w-[min(320px,88vw)] border-[var(--glass-border)] bg-[var(--glass)] p-4 shadow-[0_16px_40px_rgba(29,29,31,0.14)] backdrop-blur-xl",
              side === "left" ? "left-0 border-r" : "right-0 border-l",
              className,
            )}
          >
            {children}
          </m.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
