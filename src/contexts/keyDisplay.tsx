// User preference for how modifier/OS-specific keycaps are labelled (e.g. GUI
// shown as ⌘ vs the Windows key). Reserved for future use — nothing consumes
// `keyDisplay` yet, but the choice is persisted so the eventual keycap renderer
// can read it. Mirrors theme.tsx's persisted-choice pattern.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type KeyDisplay = "macos" | "windows";

const STORAGE_KEY = "vialite-key-display";

export function detectKeyDisplay(): KeyDisplay {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "macos" || stored === "windows") {
      return stored;
    }
  } catch {
    // Storage may be unavailable (private mode etc.) — fall through.
  }
  return navigator.platform?.toLowerCase().startsWith("mac") ? "macos" : "windows";
}

interface KeyDisplayValue {
  keyDisplay: KeyDisplay;
  setKeyDisplay: (value: KeyDisplay) => void;
}

const KeyDisplayContext = createContext<KeyDisplayValue | null>(null);

export function KeyDisplayProvider({ children }: { children: ReactNode }) {
  const [keyDisplay, setKeyDisplayState] = useState<KeyDisplay>(detectKeyDisplay);

  const setKeyDisplay = useCallback((next: KeyDisplay) => {
    setKeyDisplayState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-persistent is fine.
    }
  }, []);

  const value = useMemo(() => ({ keyDisplay, setKeyDisplay }), [keyDisplay, setKeyDisplay]);
  return <KeyDisplayContext.Provider value={value}>{children}</KeyDisplayContext.Provider>;
}

export function useKeyDisplay(): KeyDisplayValue {
  const ctx = useContext(KeyDisplayContext);
  if (!ctx) {
    throw new Error("useKeyDisplay must be used inside <KeyDisplayProvider>");
  }
  return ctx;
}
