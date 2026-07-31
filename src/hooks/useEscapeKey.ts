import { useEffect, useRef } from "react";

/**
 * Calls `onEscape` when Escape is pressed, while `active`. Used to back out of a selection — the
 * combo / tap dance tables' field under configuration (see `.field-selected` in index.css).
 *
 * Deliberately on `window` rather than `document`: the popovers that can be open *inside* such a
 * selection (the keycode cascade, the modifier menu) close themselves from `document`-level
 * listeners and stop the event there, and bubble-phase `window` runs after bubble-phase
 * `document`. Escape therefore peels one layer at a time — dismissing whatever popover is open
 * first, and only reaching this handler once the selection itself is the topmost layer. Ordering
 * by target that way holds however the two mount relative to each other, unlike a shared flag or
 * `stopImmediatePropagation`, which would depend on which listener registered first.
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  // Kept in a ref so an inline arrow at the call site doesn't re-subscribe every render.
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);
}
