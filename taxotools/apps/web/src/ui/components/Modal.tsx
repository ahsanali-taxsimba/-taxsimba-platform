"use client";

import { AnimatePresence, m } from "framer-motion";
import { modalPop, fadeIn } from "@/ui/animations";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <m.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />
          <m.div
            role="dialog"
            aria-modal
            variants={modalPop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "relative z-10 w-full max-w-lg rounded-[28px] border border-[var(--glass-border)] bg-[var(--glass)] p-6 shadow-[0_16px_40px_rgba(29,29,31,0.14)] backdrop-blur-xl",
              className,
            )}
          >
            {title && (
              <h2 className="mb-3 font-display text-xl font-semibold text-[var(--text-main)]">{title}</h2>
            )}
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
