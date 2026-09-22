import type { Transition, Variants } from "framer-motion";

/** Easing curves — GPU-friendly cubic-beziers */
export const easings = {
  smooth: [0.22, 1, 0.36, 1] as const,
  snappy: [0.16, 1, 0.3, 1] as const,
  soft: [0.33, 1, 0.68, 1] as const,
  emphasized: [0.2, 0, 0, 1] as const,
};

/** Duration presets (seconds) */
export const durations = {
  instant: 0.12,
  fast: 0.2,
  normal: 0.35,
  slow: 0.55,
  page: 0.28,
} as const;

export const transitions = {
  fade: {
    duration: durations.normal,
    ease: easings.smooth,
  } satisfies Transition,
  slide: {
    duration: durations.normal,
    ease: easings.snappy,
  } satisfies Transition,
  scale: {
    duration: durations.fast,
    ease: easings.emphasized,
  } satisfies Transition,
  page: {
    duration: durations.page,
    ease: easings.smooth,
  } satisfies Transition,
  springSoft: {
    type: "spring",
    stiffness: 320,
    damping: 28,
    mass: 0.8,
  } satisfies Transition,
  springSnappy: {
    type: "spring",
    stiffness: 420,
    damping: 32,
  } satisfies Transition,
  stagger: {
    staggerChildren: 0.06,
    delayChildren: 0.04,
  } satisfies Transition,
  staggerFast: {
    staggerChildren: 0.04,
    delayChildren: 0.02,
  } satisfies Transition,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.fade },
  exit: { opacity: 0, transition: { duration: durations.fast, ease: easings.soft } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: transitions.slide },
  exit: { opacity: 0, y: -8, transition: { duration: durations.fast } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: transitions.slide },
  exit: { opacity: 0, x: -12, transition: { duration: durations.fast } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: transitions.slide },
  exit: { opacity: 0, x: 12, transition: { duration: durations.fast } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.scale },
  exit: { opacity: 0, scale: 0.98, transition: { duration: durations.fast } },
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: transitions.page },
  exit: { opacity: 0, y: -6, transition: { duration: durations.fast, ease: easings.soft } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.stagger,
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.slide,
  },
};

export const sidebarVariants: Variants = {
  closed: { x: "-100%", opacity: 0.6 },
  open: {
    x: 0,
    opacity: 1,
    transition: transitions.springSoft,
  },
};

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durations.fast } },
  exit: { opacity: 0, transition: { duration: durations.fast } },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.springSoft,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 8,
    transition: { duration: durations.fast },
  },
};

export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.springSnappy,
  },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: durations.instant } },
};

export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.01, transition: transitions.springSnappy },
  tap: { scale: 0.985, transition: { duration: durations.instant } },
};

export const buttonHover = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: transitions.springSnappy },
  tap: { scale: 0.97, transition: { duration: durations.instant } },
};

/** Instant variants when user prefers reduced motion */
export const reducedMotionVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: { opacity: 1 },
  initial: { opacity: 1 },
  enter: { opacity: 1 },
};
