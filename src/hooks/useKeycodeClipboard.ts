import { useSyncExternalStore } from "react";

/**
 * App-global "keycode clipboard": the one keycode most recently copied off a cap
 * via the layout's right-click menu, ready to be pasted onto another cap.
 *
 * It's a module-level store rather than React state so the value survives page
 * switches (键盘配置 → 键盘配色 → back) without any provider threading it through,
 * and it's mirrored into localStorage so a reload/reconnect doesn't lose it. The
 * OS clipboard is deliberately not involved: this holds a QMK keycode id, not
 * text, and reading the system clipboard needs a permission prompt.
 */
const STORAGE_KEY = "vialite-keycode-clipboard";

const listeners = new Set<() => void>();

// Private-mode Safari and friends can throw on storage access, and a missing
// clipboard is never worth breaking the page over — degrade to memory-only.
function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let copied: string | null = readStored();

/** The copied keycode, or null if nothing has been copied yet. */
export function copiedKeycode(): string | null {
  return copied;
}

/** Store `qmkId` as the clipboard's contents, replacing whatever was there. */
export function copyKeycode(qmkId: string): void {
  copied = qmkId;
  try {
    window.localStorage.setItem(STORAGE_KEY, qmkId);
  } catch {
    // Memory-only fallback; the in-session copy still works.
  }
  for (const listener of listeners) listener();
}

/** Subscribe to the copied keycode; re-renders on every copy. */
export function useKeycodeClipboard(): string | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => copied,
  );
}
