"use client";

import { AnimatePresence, m } from "framer-motion";
import {
  dropdownVariants,
  modalVariants,
  overlayVariants,
  reducedMotionVariants,
} from "@/motion/config";
import { usePrefersReducedMotion } from "@/motion/hooks/usePrefersReducedMotion";

export function MotionModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const reduce = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <m.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-ink-950/40"
            variants={reduce ? reducedMotionVariants : overlayVariants}
            onClick={onClose}
          />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-ink-100 bg-white p-6 shadow-lg"
            variants={reduce ? reducedMotionVariants : modalVariants}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              <button type="button" onClick={onClose} className="text-sm text-ink-500">
                Close
              </button>
            </div>
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function MotionDrawer({
  open,
  onClose,
  side = "right",
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: React.ReactNode;
}) {
  const reduce = usePrefersReducedMotion();
  const xHidden = side === "right" ? "100%" : "-100%";

  return (
    <AnimatePresence>
      {open && (
        <m.div className="fixed inset-0 z-50" initial="hidden" animate="visible" exit="exit">
          <m.button
            type="button"
            aria-label="Close drawer"
            className="absolute inset-0 bg-ink-950/40"
            variants={reduce ? reducedMotionVariants : overlayVariants}
            onClick={onClose}
          />
          <m.aside
            className={`absolute top-0 h-full w-full max-w-md bg-white p-6 shadow-xl ${
              side === "right" ? "right-0" : "left-0"
            }`}
            initial={reduce ? false : { x: xHidden }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: xHidden }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 32 }}
          >
            {children}
          </m.aside>
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function MotionDropdown({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className={className}
          variants={reduce ? reducedMotionVariants : dropdownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
