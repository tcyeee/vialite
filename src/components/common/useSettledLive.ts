import { useEffect, useState } from "react";

/** Matches `.keyboard-zoom`'s CSS transition duration in index.css — how long a freshly-turned-on zoom override keeps the transition enabled before switching to per-frame `live` tracking. */
const LIVE_SETTLE_MS = 260;

/**
 * Delays a zoom override's `live` (transition-disabled) status by one CSS
 * transition duration after it turns on, so the initial jump into auto-fit
 * sizing — e.g. toggling 自适应大小 on, which swaps the board straight from the
 * discrete 预览区域缩放 level to the fitted zoom — eases in via `.keyboard-zoom`'s
 * transition instead of snapping. Once settled, `live` tracks `active`
 * directly so ongoing resize-driven updates skip the transition as intended
 * (see `.keyboard-zoom-live` in index.css) instead of lagging behind the
 * window edge.
 */
export function useSettledLive(active: boolean): boolean {
  const [settling, setSettling] = useState(false);
  const [prevActive, setPrevActive] = useState(active);

  // React's "adjusting state during render" pattern: comparing to state from
  // the previous render (rather than a ref) means the very first render after
  // `active` flips on already reports `settling`, instead of one render late.
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setSettling(true);
  }

  useEffect(() => {
    if (!settling) return;
    const timer = setTimeout(() => setSettling(false), LIVE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [settling]);

  return active && !settling;
}
