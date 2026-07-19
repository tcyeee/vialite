// One-shot, device-level auto-fit for the preview display size.
//
// A wide keyboard config (many columns, or split/Alice boards whose rotated keys
// stretch the bounding box) can overflow a narrow window. The very first time
// this device shows a board, we pick the largest display-size level whose board
// still fits the available width, so it's visible without the user hunting for
// the zoom control. After that we never touch the size again — the flag below is
// what makes it "device-level once" rather than per-load.
//
// The flag uses the `vialite-` prefix so SiteSettingsPanel's clearSiteCache()
// (which wipes every `vialite-` key) resets it for free: after clearing the
// cache, the next board shown auto-fits again.

import { useLayoutEffect, type RefObject } from "react";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import {
  appearanceMetrics,
  PREVIEW_ZOOM,
  type PreviewSize,
  type SpacingLevel,
} from "./KeyboardLayoutPreview.tsx";
import { placeLayout } from "./layoutGeometry.ts";

export const AUTOFIT_DONE_KEY = "vialite-autofit-done";

/** Display-size levels, largest first — the order auto-fit tries. */
const SIZES_LARGEST_FIRST: PreviewSize[] = ["xl", "l", "m", "s", "xs"];

/**
 * Largest display size whose board (natural 1× width times that level's zoom)
 * fits `availableWidth`. Floors at the smallest level ("xs") when even that
 * overflows — below it the caller's container scrolls horizontally rather than
 * shrinking keys into illegibility.
 */
export function pickFitSize(naturalWidth: number, availableWidth: number): PreviewSize {
  for (const size of SIZES_LARGEST_FIRST) {
    if (naturalWidth * PREVIEW_ZOOM[size] <= availableWidth) {
      return size;
    }
  }
  return "xs";
}

/**
 * The board's natural (1×, pre-zoom) outer width in px — the same quantity
 * {@link KeyboardLayout} lays out at before {@link KeyboardZoom} scales it:
 * plate width (bounding box + one inter-key gap) plus the case bezel on both
 * sides. Rotated keys are already accounted for: `placeLayout` derives
 * `placed.width` from rotated corner points, so an angled board reports its true
 * horizontal span, not a naive column count.
 */
export function boardNaturalWidth(
  keyboard: Keyboard,
  spacing: SpacingLevel,
  keycapWidth: SpacingLevel,
  caseThickness: number,
): number {
  const placed = placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices);
  // size and caseRadius don't affect PITCH/inset, so any value works here.
  const { PITCH, inset } = appearanceMetrics("m", spacing, keycapWidth, "m", caseThickness);
  return placed.width * PITCH + inset + caseThickness * 2;
}

/** Horizontal padding the preview container reserves around the board (px-4 × 2). */
const CONTAINER_PADDING_PX = 32;

/**
 * Runs the one-shot auto-fit when a keyboard first becomes available: measures
 * the (overflow-scrolling) container's inner width and sets the display size to
 * the largest level that fits, then marks it done so it never runs again on this
 * device. Guarded by {@link AUTOFIT_DONE_KEY}, so reconnecting a different (wider)
 * board or reloading won't re-fit once the user is presumed to be in control.
 *
 * `containerRef` must point at an element whose width is *independent* of the
 * board's — an `overflow-x-auto` viewport — so a shrink can't feed back into the
 * measurement.
 */
export function useAutoFitPreviewSize(
  containerRef: RefObject<HTMLElement | null>,
  keyboard: Keyboard | null,
): void {
  const { spacing, keycapWidth, caseThickness, setSize } = usePreviewAppearance();
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!keyboard || !el) {
      return;
    }
    try {
      if (window.localStorage.getItem(AUTOFIT_DONE_KEY)) {
        return;
      }
    } catch {
      // localStorage unavailable (private mode / blocked): skip auto-fit rather
      // than fitting on every load with no way to record that we did.
      return;
    }
    const available = el.clientWidth - CONTAINER_PADDING_PX;
    if (!(available > 0)) {
      // Container not laid out yet; leave the flag unset so a later mount retries.
      return;
    }
    const natural = boardNaturalWidth(keyboard, spacing, keycapWidth, caseThickness);
    setSize(pickFitSize(natural, available));
    try {
      window.localStorage.setItem(AUTOFIT_DONE_KEY, "1");
    } catch {
      // Best-effort: if we can't record it, worst case is another fit next load.
    }
    // Intentionally keyed only on the keyboard: appearance knobs changing later
    // are the user tuning things, which must not re-trigger auto-fit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboard]);
}
