/**
 * Run a DOM-mutating `update` inside a browser View Transition so layout changes (e.g. reordering
 * cards) animate automatically. Falls back to running `update` directly where the API is missing.
 *
 * `update` must apply its changes synchronously — pass `() => flushSync(() => setState(...))` when
 * driving it from React state, so the DOM is committed before the transition snapshots the result.
 */
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
