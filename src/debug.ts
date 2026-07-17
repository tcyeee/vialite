// Opt-in verbose logging for the connect/protocol path, toggled from the
// 网站设置 (Website Settings) page and persisted to localStorage.
//
// Off by default so the console stays clean. Genuine failures are still logged
// unconditionally (see the console.error calls in protocol/ and App.tsx) — what
// this gates is the surrounding *context* a diagnosis needs: every reload step
// and its timing, the device descriptor, the negotiated protocol versions, and
// the vial.json xz header. When a user reports a connect failure, ask them to
// switch this on and retry.
//
// Deliberately a plain module rather than a React context: `src/protocol/` is
// framework-agnostic and has to be able to log through it too.

const STORAGE_KEY = "vialite-debug";

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage may be unavailable (private mode, or a non-browser test env
    // where `localStorage` isn't even defined).
    return false;
  }
}

let enabled = read();

export function isDebugEnabled(): boolean {
  return enabled;
}

export function setDebugEnabled(next: boolean): void {
  enabled = next;
  try {
    if (next) {
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Non-persistent is fine.
  }
}

/** Verbose trace — no-op unless debug logging is switched on. */
export function debugLog(...args: unknown[]): void {
  if (enabled) {
    console.log(...args);
  }
}

/** Non-fatal oddity worth seeing while diagnosing — no-op unless debug is on. */
export function debugWarn(...args: unknown[]): void {
  if (enabled) {
    console.warn(...args);
  }
}
