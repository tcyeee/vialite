import { useEffect, useState } from "react";

/**
 * Boolean UI preference backed by localStorage. Persists across reloads and
 * degrades gracefully when storage is unavailable (private mode / test env),
 * mirroring the guard style in `debug.ts`.
 */
export function usePersistedBoolean(
  key: string,
  fallback = false,
): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : stored === "1";
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Non-persistent is fine.
    }
  }, [key, value]);

  return [value, setValue];
}
