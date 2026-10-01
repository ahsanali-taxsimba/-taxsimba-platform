"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DepartmentTheme } from "./tokens";
import { resolveTheme, themeToCssVars, type ThemeMode } from "./themes";

type ThemeContextValue = {
  mode: ThemeMode;
  department: DepartmentTheme;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setDepartment: (dept: DepartmentTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_KEY = "taxotools-ui-mode";
const DEPT_KEY = "taxotools-ui-department";

export function ThemeProvider({
  children,
  defaultMode = "light",
  defaultDepartment = "default",
}: {
  children: ReactNode;
  defaultMode?: ThemeMode;
  defaultDepartment?: DepartmentTheme;
}) {
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);
  const [department, setDepartmentState] = useState<DepartmentTheme>(defaultDepartment);

  useEffect(() => {
    try {
      const storedMode = localStorage.getItem(MODE_KEY) as ThemeMode | null;
      const storedDept = localStorage.getItem(DEPT_KEY) as DepartmentTheme | null;
      if (storedMode === "light" || storedMode === "dark") setModeState(storedMode);
      if (storedDept) setDepartmentState(storedDept);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const theme = resolveTheme(mode, department);
    const vars = themeToCssVars(theme);
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.dataset.department = department;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    try {
      localStorage.setItem(MODE_KEY, mode);
      localStorage.setItem(DEPT_KEY, department);
    } catch {
      // ignore
    }
  }, [mode, department]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const toggleMode = useCallback(
    () => setModeState((m) => (m === "light" ? "dark" : "light")),
    [],
  );
  const setDepartment = useCallback((dept: DepartmentTheme) => setDepartmentState(dept), []);

  const value = useMemo(
    () => ({ mode, department, setMode, toggleMode, setDepartment }),
    [mode, department, setMode, toggleMode, setDepartment],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: "light" as ThemeMode,
      department: "default" as DepartmentTheme,
      setMode: (_: ThemeMode) => undefined,
      toggleMode: () => undefined,
      setDepartment: (_: DepartmentTheme) => undefined,
    };
  }
  return ctx;
}
