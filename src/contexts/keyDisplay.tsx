// User preferences for how keycaps are labelled. Two settings live here, both
// consumed by KeycapFace and persisted so they survive reloads (mirroring
// theme.tsx's persisted-choice pattern):
//   • keyDisplay — how modifier/OS-specific caps read (GUI as ⌘ vs the Windows
//     key), used by capIcon to pick per-OS modifier glyphs.
//   • mediaReset — a Beta toggle (default on) that "beautifies" the media/nav
//     caps: two-word media keys collapse to initials (Play Pause → "PP") and the
//     page-nav keys (Home/End/PgUp/PgDown) plus volume/brightness show glyphs
//     instead of text. Turning it off reverts every one of those caps to plain text.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type KeyDisplay = "macos" | "windows";

const STORAGE_KEY = "vialite-key-display";
const MEDIA_RESET_KEY = "vialite-media-reset";

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

function detectMediaReset(): boolean {
  try {
    const stored = localStorage.getItem(MEDIA_RESET_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // Storage may be unavailable (private mode etc.) — fall through.
  }
  return true; // Default on.
}

interface KeyDisplayValue {
  keyDisplay: KeyDisplay;
  setKeyDisplay: (value: KeyDisplay) => void;
  /** Beta: beautify media/nav caps (initials + glyphs) vs plain text. Default on. */
  mediaReset: boolean;
  setMediaReset: (value: boolean) => void;
}

const KeyDisplayContext = createContext<KeyDisplayValue | null>(null);

export function KeyDisplayProvider({ children }: { children: ReactNode }) {
  const [keyDisplay, setKeyDisplayState] = useState<KeyDisplay>(detectKeyDisplay);
  const [mediaReset, setMediaResetState] = useState<boolean>(detectMediaReset);

  const setKeyDisplay = useCallback((next: KeyDisplay) => {
    setKeyDisplayState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-persistent is fine.
    }
  }, []);

  const setMediaReset = useCallback((next: boolean) => {
    setMediaResetState(next);
    try {
      localStorage.setItem(MEDIA_RESET_KEY, String(next));
    } catch {
      // Non-persistent is fine.
    }
  }, []);

  const value = useMemo(
    () => ({ keyDisplay, setKeyDisplay, mediaReset, setMediaReset }),
    [keyDisplay, setKeyDisplay, mediaReset, setMediaReset],
  );
  return <KeyDisplayContext.Provider value={value}>{children}</KeyDisplayContext.Provider>;
}

export function useKeyDisplay(): KeyDisplayValue {
  const ctx = useContext(KeyDisplayContext);
  if (!ctx) {
    throw new Error("useKeyDisplay must be used inside <KeyDisplayProvider>");
  }
  return ctx;
}
