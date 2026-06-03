"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";

/**
 * Minimal theme provider. Replaces next-themes which (as of 0.4.x)
 * injects an inline <script> inside its provider to apply the theme
 * before hydration - that script trips React 19's "Encountered a
 * script tag while rendering React component" warning
 * (https://github.com/pacocoursey/next-themes/issues/385, /387).
 *
 * API is a drop-in for the bits we actually use:
 *
 *   const { theme, setTheme, resolvedTheme } = useTheme();
 *
 * Differences vs next-themes:
 *   - Theme is applied in a useEffect, so on the first paint the page
 *     uses whatever class is on <html> from SSR (none, i.e. light).
 *     For users who picked dark, this flashes light briefly. We accept
 *     that trade rather than ship a no-op inline script.
 *   - `attribute` is hard-coded to "class" (matches our Tailwind setup).
 *   - System preference is followed when theme is "system".
 */

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: ResolvedTheme;
}

const STORAGE_KEY = "theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // Read stored preference once after mount. We never read localStorage
  // during render, which keeps SSR + first client paint consistent.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
    setSystemDark(systemPrefersDark());
  }, []);

  // Track system colour-scheme changes so a user on `theme=system`
  // follows their OS toggle without a manual page reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemDark(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === "dark") return "dark";
    if (theme === "light") return "light";
    return systemDark ? "dark" : "light";
  }, [theme, systemDark]);

  // Apply the resolved theme class to <html>. We add `dark` for dark
  // mode (matches Tailwind's `darkMode: "class"` setup), or remove it
  // for light.
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (resolvedTheme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [resolvedTheme, mounted]);

  function setTheme(t: Theme) {
    setThemeState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, t);
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
