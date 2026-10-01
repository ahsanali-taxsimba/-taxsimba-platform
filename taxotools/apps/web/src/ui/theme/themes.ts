import type { DepartmentTheme } from "./tokens";

export type ThemeMode = "light" | "dark";

export type ColorTokens = {
  bgMain: string;
  bgPanel: string;
  bgElevated: string;
  bgMuted: string;
  textMain: string;
  textMuted: string;
  textInverse: string;
  accent: string;
  accentSoft: string;
  accentHover: string;
  link: string;
  linkHover: string;
  border: string;
  success: string;
  warn: string;
  danger: string;
  glass: string;
  glassBorder: string;
  neuLight: string;
  neuDark: string;
  gradientA: string;
  gradientB: string;
};

const lightBase: ColorTokens = {
  bgMain: "#F5F5F7",
  bgPanel: "#FFFFFF",
  bgElevated: "rgba(255,255,255,0.72)",
  bgMuted: "#EEEEEF",
  textMain: "#1D1D1F",
  textMuted: "#86868B",
  textInverse: "#FFFFFF",
  accent: "#0071E3",
  accentSoft: "#E8F2FF",
  accentHover: "#0066CC",
  link: "#2997FF",
  linkHover: "#0066CC",
  border: "#D2D2D7",
  success: "#34C759",
  warn: "#FF9F0A",
  danger: "#FF3B30",
  glass: "rgba(255,255,255,0.62)",
  glassBorder: "rgba(255,255,255,0.55)",
  neuLight: "#FFFFFF",
  neuDark: "#E8E8ED",
  gradientA: "#0071E3",
  gradientB: "#64D2FF",
};

const darkBase: ColorTokens = {
  bgMain: "#000000",
  bgPanel: "#1C1C1E",
  bgElevated: "rgba(28,28,30,0.78)",
  bgMuted: "#2C2C2E",
  textMain: "#F5F5F7",
  textMuted: "#A1A1A6",
  textInverse: "#000000",
  accent: "#0A84FF",
  accentSoft: "rgba(10,132,255,0.18)",
  accentHover: "#409CFF",
  link: "#64D2FF",
  linkHover: "#2997FF",
  border: "#38383A",
  success: "#30D158",
  warn: "#FFD60A",
  danger: "#FF453A",
  glass: "rgba(28,28,30,0.66)",
  glassBorder: "rgba(255,255,255,0.08)",
  neuLight: "#2C2C2E",
  neuDark: "#000000",
  gradientA: "#0A84FF",
  gradientB: "#5E5CE6",
};

const departmentOverrides: Record<
  DepartmentTheme,
  Partial<Record<ThemeMode, Partial<ColorTokens>>>
> = {
  default: {},
  marketing: {
    light: { accent: "#0071E3", gradientA: "#0071E3", gradientB: "#FF375F" },
    dark: { accent: "#0A84FF", gradientA: "#0A84FF", gradientB: "#FF375F" },
  },
  admin: {
    light: { accent: "#5856D6", gradientA: "#5856D6", gradientB: "#0071E3", accentSoft: "#EEEEFF" },
    dark: { accent: "#5E5CE6", gradientA: "#5E5CE6", gradientB: "#0A84FF" },
  },
  ops: {
    light: { accent: "#34C759", gradientA: "#34C759", gradientB: "#0071E3", accentSoft: "#E8F8ED" },
    dark: { accent: "#30D158", gradientA: "#30D158", gradientB: "#0A84FF" },
  },
};

export function resolveTheme(
  mode: ThemeMode = "light",
  department: DepartmentTheme = "default",
): ColorTokens {
  const base = mode === "dark" ? darkBase : lightBase;
  const override = departmentOverrides[department]?.[mode] ?? {};
  return { ...base, ...override };
}

export function themeToCssVars(theme: ColorTokens): Record<string, string> {
  return {
    "--bg-main": theme.bgMain,
    "--bg-panel": theme.bgPanel,
    "--bg-elevated": theme.bgElevated,
    "--bg-muted": theme.bgMuted,
    "--text-main": theme.textMain,
    "--text-secondary": theme.textMuted,
    "--text-inverse": theme.textInverse,
    "--accent-blue": theme.accent,
    "--accent-soft": theme.accentSoft,
    "--link-blue": theme.link,
    "--link-blue-hover": theme.linkHover,
    "--border-subtle": theme.border,
    "--success": theme.success,
    "--warn": theme.warn,
    "--danger": theme.danger,
    "--glass": theme.glass,
    "--glass-border": theme.glassBorder,
    "--neu-light": theme.neuLight,
    "--neu-dark": theme.neuDark,
    "--gradient-a": theme.gradientA,
    "--gradient-b": theme.gradientB,
    "--accent": theme.accent,
    "--surface": theme.bgPanel,
    "--ink": theme.textMain,
  };
}
