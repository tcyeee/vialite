// Manual light/dark theme toggle. Independent of the OS-level `color-scheme:
// light dark` fallback already in index.css — this overrides it once the
// user picks explicitly, mirroring i18n.tsx's persisted-choice pattern.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

export type Theme = "light" | "dark";

const STORAGE_KEY = "vialite-theme";

export function detectTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Storage may be unavailable (private mode etc.) — fall through.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeValue {
  theme: Theme;
  /**
   * `origin` is the element that triggered the switch (the toggle button, the
   * settings `<select>`, ...); its center becomes the center of the circular
   * reveal. Omit it to fall back to a plain, un-animated swap.
   */
  setTheme: (theme: Theme, origin?: Element | null) => void;
}

/**
 * Drive the circular-reveal keyframes in index.css by publishing the reveal
 * center and the radius it has to grow to. The radius is the distance from the
 * origin to the furthest viewport corner, so the new theme always finishes
 * covering the screen no matter where the button sits.
 */
function setRevealGeometry(origin: Element) {
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const style = document.documentElement.style;
  style.setProperty("--theme-reveal-x", `${x}px`);
  style.setProperty("--theme-reveal-y", `${y}px`);
  style.setProperty("--theme-reveal-r", `${radius}px`);
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(detectTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme, origin?: Element | null) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-persistent is fine.
    }

    // No origin to grow from, no View Transitions support (only Chrome/Edge
    // have it — the same browsers WebHID limits us to, so this is really just
    // belt-and-braces), or the user asked for less motion: swap instantly.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!origin || reduceMotion || !document.startViewTransition) {
      setThemeState(next);
      return;
    }

    setRevealGeometry(origin);
    const root = document.documentElement;
    root.dataset.themeAnim = "reveal";
    const transition = document.startViewTransition(() => {
      // The effect below also writes `data-theme`, but effects don't run inside
      // this callback deterministically — and the callback must leave the DOM
      // already showing the new theme for the snapshot to be correct. So set
      // the attribute here and let the effect re-set the identical value.
      flushSync(() => setThemeState(next));
      root.setAttribute("data-theme", next);
    });
    void transition.finished.finally(() => {
      delete root.dataset.themeAnim;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
