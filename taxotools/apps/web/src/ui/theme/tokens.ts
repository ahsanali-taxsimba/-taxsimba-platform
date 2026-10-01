/** Design tokens — spacing, radius, shadows, type, motion */

export const spacing = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
} as const;

export const radius = {
  sm: "10px",
  md: "16px",
  lg: "22px",
  xl: "28px",
  "2xl": "36px",
  pill: "999px",
  asymmetric: "28px 16px 28px 16px",
} as const;

export const shadows = {
  soft: "0 1px 2px rgba(29,29,31,0.04), 0 8px 24px rgba(29,29,31,0.06)",
  glass: "0 8px 32px rgba(29,29,31,0.08), inset 0 1px 0 rgba(255,255,255,0.55)",
  neu: "8px 8px 20px rgba(29,29,31,0.08), -6px -6px 16px rgba(255,255,255,0.85)",
  neuInset: "inset 4px 4px 10px rgba(29,29,31,0.06), inset -4px -4px 10px rgba(255,255,255,0.8)",
  float: "0 16px 40px rgba(29,29,31,0.14)",
  focus: "0 0 0 3px rgba(0,113,227,0.28)",
} as const;

export const typography = {
  h1: { size: "56px", weight: 600, tracking: "-0.02em", lineHeight: 1.07 },
  h2: { size: "40px", weight: 600, tracking: "-0.015em", lineHeight: 1.1 },
  h3: { size: "34px", weight: 600, tracking: "-0.01em", lineHeight: 1.15 },
  h4: { size: "28px", weight: 400, tracking: "-0.01em", lineHeight: 1.2 },
  h5: { size: "21px", weight: 600, tracking: "-0.01em", lineHeight: 1.25 },
  h6: { size: "17px", weight: 600, tracking: "-0.01em", lineHeight: 1.3 },
  body: { size: "17px", weight: 400, tracking: "-0.022em", lineHeight: 1.47 },
  caption: { size: "13px", weight: 500, tracking: "-0.01em", lineHeight: 1.35 },
  label: { size: "21px", weight: 600, tracking: "-0.01em", lineHeight: 1.2 },
} as const;

export const zIndex = {
  header: 40,
  sidebar: 50,
  fab: 60,
  drawer: 70,
  modal: 80,
  toast: 90,
} as const;

export type DepartmentTheme = "default" | "marketing" | "admin" | "ops";
