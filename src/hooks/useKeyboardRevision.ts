import { useSyncExternalStore } from "react";
import type { Keyboard } from "../protocol/keyboard.ts";

/**
 * Subscribes to a Keyboard's write notifications so the calling component re-renders
 * whenever any set-/save-/restore-prefixed write lands — callers don't need to thread
 * an onChange callback manually.
 */
export function useKeyboardRevision(keyboard: Keyboard | null): number {
  return useSyncExternalStore(
    (onStoreChange) => (keyboard ? keyboard.subscribe(onStoreChange) : () => {}),
    () => (keyboard ? keyboard.revision : 0),
  );
}
