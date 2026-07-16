/**
 * Run a DOM-mutating `update` inside a browser View Transition so layout changes (e.g. reordering
 * cards) animate automatically. Falls back to running `update` directly where the API is missing.
 *
 * `update` must apply its changes synchronously — pass `() => flushSync(() => setState(...))` when
 * driving it from React state, so the DOM is committed before the transition snapshots the result.
 */
export function startViewTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(update);
  } else {
    update();
  }
}
