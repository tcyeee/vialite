import { useCallback, useEffect, useRef, useState } from "react";
import type { LenisRef } from "lenis/react";
import type { VirtualScrollData } from "lenis";
import {
  PULL_CURTAIN_MAX_HEIGHT,
  PULL_EXIT_RAW_THRESHOLD,
  PULL_RELEASE_DECAY,
  PULL_RUBBER_BAND_CONSTANT,
  PULL_TO_EXIT_ENABLED,
  PULL_WHEEL_IDLE_RELEASE_MS,
  rubberBand,
} from "./fullscreenPreviewMetrics.ts";

/**
 * "Curtain": once the page is scrolled all the way down, further downward
 * wheel/touch input no longer scrolls (there's nothing left to scroll) and
 * instead grows a dome-shaped curtain from the bottom edge, rubber-banded so
 * it gets progressively harder to pull. Sustained pulling past
 * `PULL_EXIT_RAW_THRESHOLD` calls `onExit`. Extracted from
 * `FullscreenPreviewOverlay` — see `fullscreenPreviewMetrics.ts`'s
 * `PULL_TO_EXIT_ENABLED` for why this is currently a no-op (`handleVirtualScroll`
 * bails out immediately while it's `false`).
 *
 * `active` should be the overlay's own open state (`handle.fullscreen`): the
 * curtain resets whenever it flips true, and any pending release
 * timer/animation is stopped once it flips false.
 */
export function usePullToExitCurtain(active: boolean, onExit: (anchor: Element) => void) {
  // `onExit` is typically a fresh closure every render (it wraps `handle.close`,
  // and `handle` itself is a fresh object every render — see
  // FullscreenPreviewOverlay's own comment on this), so it's mirrored into a
  // ref: `handleVirtualScroll` below is intentionally created once (`useCallback`
  // with `[]`) and must only ever read *current* values through refs, since
  // ReactLenis's own effect that wires up `options.virtualScroll` keys off
  // `JSON.stringify(options)`, which silently drops function values, so a fresh
  // closure passed on a later render would never actually get rewired.
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const lenisRef = useRef<LenisRef>(null);
  const exitAnchorRef = useRef<HTMLDivElement>(null);
  const pullRawRef = useRef(0);
  const exitingRef = useRef(false);
  const wheelIdleTimerRef = useRef<number | null>(null);
  const releaseRafRef = useRef<number | null>(null);
  const [pullRaw, setPullRaw] = useState(0);

  const stopWheelIdleTimer = useCallback(() => {
    if (wheelIdleTimerRef.current != null) {
      window.clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = null;
    }
  }, []);
  const stopReleaseAnimation = useCallback(() => {
    if (releaseRafRef.current != null) {
      cancelAnimationFrame(releaseRafRef.current);
      releaseRafRef.current = null;
    }
  }, []);
  /** Spring the curtain back to 0 — the user let go (touchend, scrolled back up, or stopped generating wheel events) before reaching the exit threshold. */
  const retractPull = useCallback(() => {
    stopWheelIdleTimer();
    stopReleaseAnimation();
    const step = () => {
      pullRawRef.current *= PULL_RELEASE_DECAY;
      if (pullRawRef.current < 1) {
        pullRawRef.current = 0;
        setPullRaw(0);
        releaseRafRef.current = null;
        return;
      }
      setPullRaw(pullRawRef.current);
      releaseRafRef.current = requestAnimationFrame(step);
    };
    releaseRafRef.current = requestAnimationFrame(step);
  }, [stopReleaseAnimation, stopWheelIdleTimer]);
  const scheduleWheelIdleRelease = useCallback(() => {
    stopWheelIdleTimer();
    wheelIdleTimerRef.current = window.setTimeout(() => {
      wheelIdleTimerRef.current = null;
      if (!exitingRef.current) retractPull();
    }, PULL_WHEEL_IDLE_RELEASE_MS);
  }, [retractPull, stopWheelIdleTimer]);
  /** Reached the threshold — exit via `onExit` (the same view-transition `handle.close` the close button/Escape use), anchored at the bottom-center anchor so the reveal expands upward from the bottom instead of from wherever the button sits. */
  const triggerPullExit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    stopWheelIdleTimer();
    stopReleaseAnimation();
    pullRawRef.current = 0;
    setPullRaw(0);
    const anchor = exitAnchorRef.current;
    if (anchor) onExitRef.current(anchor);
  }, [stopReleaseAnimation, stopWheelIdleTimer]);
  // The interception point: Lenis calls this for every wheel/touch tick
  // before consuming it (see the `virtualScroll` option on ReactLenis), letting
  // us read deltas past the scroll limit that would otherwise just be clamped
  // away. Returning `false` tells Lenis to ignore that tick entirely.
  const handleVirtualScroll = useCallback(
    (data: VirtualScrollData): boolean => {
      if (!PULL_TO_EXIT_ENABLED) return true;
      if (exitingRef.current) return false;
      const lenis = lenisRef.current?.lenis;
      if (!lenis) return true;
      if (data.event.type === "touchend") {
        if (pullRawRef.current > 0) {
          retractPull();
          return false;
        }
        return true;
      }
      // `targetScroll` (not `progress`/`scroll`, which track the *animated*,
      // lerp-smoothed position) is what Lenis clamps to `limit` synchronously
      // the instant cumulative wheel/touch input would scroll past the
      // bottom — checking the animated position instead meant waiting for it
      // to visually catch up, which can lag up to ~1s behind a fast/continuous
      // scroll and made the curtain feel like it never engaged at all.
      const atBottom = lenis.targetScroll >= lenis.limit - 0.5;
      if (!atBottom && pullRawRef.current === 0) return true;
      if (data.deltaY <= 0) {
        if (pullRawRef.current > 0) {
          retractPull();
          return false;
        }
        return true;
      }
      stopWheelIdleTimer();
      stopReleaseAnimation();
      pullRawRef.current = Math.min(pullRawRef.current + data.deltaY, PULL_EXIT_RAW_THRESHOLD);
      setPullRaw(pullRawRef.current);
      if (pullRawRef.current >= PULL_EXIT_RAW_THRESHOLD) {
        triggerPullExit();
      } else if (data.event.type === "wheel") {
        scheduleWheelIdleRelease();
      }
      return false;
    },
    [retractPull, scheduleWheelIdleRelease, stopReleaseAnimation, stopWheelIdleTimer, triggerPullExit],
  );
  const curtainHeight = rubberBand(pullRaw, PULL_CURTAIN_MAX_HEIGHT, PULL_RUBBER_BAND_CONSTANT);

  useEffect(() => {
    if (!active) return;
    exitingRef.current = false;
    pullRawRef.current = 0;
    setPullRaw(0);
    return () => {
      stopWheelIdleTimer();
      stopReleaseAnimation();
    };
  }, [active, stopReleaseAnimation, stopWheelIdleTimer]);

  return { lenisRef, exitAnchorRef, curtainHeight, handleVirtualScroll };
}
