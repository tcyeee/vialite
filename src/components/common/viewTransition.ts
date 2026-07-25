/**
 * Run a DOM-mutating `update` inside a browser View Transition so layout changes (e.g. reordering
 * cards) animate automatically. Falls back to running `update` directly where the API is missing.
 *
 * `update` must apply its changes synchronously — pass `() => flushSync(() => setState(...))` when
 * driving it from React state, so the DOM is committed before the transition snapshots the result.
 */

/**
 * Shared `view-transition-name` for the keyboard hero morph — used both by
 * `StyleConfig.tsx`'s compact↔fullscreen preview toggle and by the
 * NewHomePage→个性化-page navigation animation (see `App.tsx`'s
 * `handlePersonalize`). Only one element in the document may carry this name
 * at any given moment; the two use sites never animate at the same time, so
 * sharing the constant (rather than each defining its own) is what keeps
 * them from silently drifting out of sync if one is renamed.
 */
export const KEYBOARD_HERO_NAME = "keyboard-hero";
/** A minimal handle over the browser transition; `finished` resolves once the animation ends. */
export interface ViewTransitionHandle {
  finished: Promise<void>;
}

export function startViewTransition(update: () => void): ViewTransitionHandle {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition === "function") {
    const transition = doc.startViewTransition(update);
    // Skipped/interrupted transitions reject `finished`; normalise to a resolve
    // so callers can always rely on it firing after the animation settles.
    return { finished: transition.finished.catch(() => undefined) };
  }
  update();
  return { finished: Promise.resolve() };
}
