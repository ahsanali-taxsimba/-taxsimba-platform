import type { Transition, Variants } from "framer-motion";

export const easings = {
  smooth: [0.22, 1, 0.36, 1] as const,
  snappy: [0.16, 1, 0.3, 1] as const,
  soft: [0.33, 1, 0.68, 1] as const,
};

export const durations = {
  fast: 0.18,
  normal: 0.32,
  slow: 0.5,
  page: 0.28,
} as const;

export const transitions = {
  fade: { duration: durations.normal, ease: easings.smooth } satisfies Transition,
  slide: { duration: durations.normal, ease: easings.snappy } satisfies Transition,
  scale: { duration: durations.fast, ease: easings.soft } satisfies Transition,
  page: { duration: durations.page, ease: easings.smooth } satisfies Transition,
  stagger: { staggerChildren: 0.06, delayChildren: 0.05 } satisfies Transition,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.fade },
  exit: { opacity: 0, transition: { duration: durations.fast } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: transitions.slide },
  exit: { opacity: 0, y: -10, transition: { duration: durations.fast } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.scale },
  exit: { opacity: 0, scale: 0.98, transition: { duration: durations.fast } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.stagger },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: transitions.slide },
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: transitions.page },
  exit: { opacity: 0, y: -6, transition: { duration: durations.fast } },
};

export const hoverLift = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.01, transition: { duration: durations.fast } },
  tap: { scale: 0.985, transition: { duration: 0.1 } },
};

export const drawerSlide = (side: "left" | "right" = "left"): Variants => ({
  hidden: { x: side === "left" ? "-100%" : "100%", opacity: 0.6 },
  visible: { x: 0, opacity: 1, transition: transitions.slide },
  exit: {
    x: side === "left" ? "-100%" : "100%",
    opacity: 0.6,
    transition: { duration: durations.fast },
  },
});

export const modalPop: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: transitions.scale },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: { duration: durations.fast } },
};
