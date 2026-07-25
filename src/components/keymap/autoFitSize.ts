// Live auto-fit (预览区域自适应大小) for the keyboard preview.
//
// A wide keyboard config (many columns, or split/Alice boards whose rotated keys
// stretch the bounding box) can overflow a narrow window. When auto-fit is on —
// the default, toggled on the 个性化 page — the board continuously scales to
// whatever width its container currently offers, tracking window resizes, so it
// is always fully visible without the user hunting for a zoom control.
//
// This deliberately replaces an earlier one-shot, device-level fit that nudged
// the discrete 预览区域缩放 (display size) level once and then recorded a
// localStorage flag. Auto-fit is now a live *mode*, not a one-time guess: the
// discrete size setting is left untouched and is only consulted when the user
// turns auto-fit off.

import { useEffect, useState } from "react";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import {
  appearanceMetrics,
  PREVIEW_ZOOM,
  type SpacingLevel,
} from "./KeyboardLayoutPreview.tsx";
import { placeLayout } from "./layoutGeometry.ts";

/**
 * Ceiling for the auto-fit zoom: the "l" level, i.e. the board's natural 1×
 * size. A wide window may leave room to scale past it, but blowing the board up
 * beyond its designed size just wastes space and coarsens the keycap art, so
 * auto-fit only ever shrinks. Shrinking has no floor — a narrow phone viewport
 * gets a small-but-complete board rather than a clipped one.
 */
export const MAX_AUTO_FIT_ZOOM = PREVIEW_ZOOM.l;

/**
 * Continuous zoom that makes a board of `naturalWidth` fit `availableWidth`,
 * capped at {@link MAX_AUTO_FIT_ZOOM}. Returns the cap for a non-positive or
 * non-finite natural width so a not-yet-measured board renders at 1× rather
 * than collapsing to zero.
 */
export function fitZoom(naturalWidth: number, availableWidth: number): number {
  if (!(naturalWidth > 0) || !(availableWidth > 0)) {
    return MAX_AUTO_FIT_ZOOM;
  }
  return Math.min(availableWidth / naturalWidth, MAX_AUTO_FIT_ZOOM);
}

/**
 * The board's natural (1×, pre-zoom) outer width in px — the same quantity
 * {@link KeyboardLayoutEditor} lays out at before {@link KeyboardZoom} scales it:
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

/** Same as {@link boardNaturalWidth}, but the board's outer height. */
export function boardNaturalHeight(
  keyboard: Keyboard,
  spacing: SpacingLevel,
  keycapWidth: SpacingLevel,
  caseThickness: number,
): number {
  const placed = placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices);
  const { PITCH, inset } = appearanceMetrics("m", spacing, keycapWidth, "m", caseThickness);
  return placed.height * PITCH + inset + caseThickness * 2;
}

/** Horizontal padding the preview container reserves around the board (px-4 × 2). */
const CONTAINER_PADDING_PX = 32;

/**
 * Auto-fit for one preview: gives back the `ref` to put on the board's
 * container and the `zoom` the board should render at.
 *
 * `zoom` is `null` — meaning "fall back to the user's discrete 预览区域缩放
 * level" — whenever auto-fit is off, there's no board yet, or the container
 * hasn't been measured, so the board never renders at a bogus scale.
 *
 * `ref` must go on an element whose width is *independent* of the board's (an
 * `overflow-x-auto` viewport), otherwise shrinking the board would shrink the
 * container and feed back into the next measurement.
 *
 * It's a callback ref held in state rather than a `useRef` object on purpose:
 * the measuring effect must re-run whenever the container node itself changes,
 * and a plain ref object mutates silently. Pages here unmount their board when
 * you navigate away, so with a ref object the observer would stay attached to
 * the detached node and never measure the new one on the way back.
 *
 * Re-measures on container resize via ResizeObserver, which covers window
 * resizes, sidebar/panel layout shifts, and device rotation alike — all of them
 * change the container's width, which is the only input that matters.
 */
export function useAutoFitZoom(keyboard: Keyboard | null): {
  ref: (node: HTMLElement | null) => void;
  zoom: number | null;
} {
  const { autoFit, spacing, keycapWidth, caseThickness } = usePreviewAppearance();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!autoFit || !keyboard || !container) {
      // Drop any stale measurement so re-enabling auto-fit re-measures rather
      // than flashing the board at the width from a previous board/container.
      setAvailableWidth(null);
      return;
    }
    const measure = () => {
      const next = container.clientWidth - CONTAINER_PADDING_PX;
      setAvailableWidth(next > 0 ? next : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container, autoFit, keyboard]);

  const zoom =
    !autoFit || !keyboard || availableWidth === null
      ? null
      : fitZoom(
          boardNaturalWidth(keyboard, spacing, keycapWidth, caseThickness),
          availableWidth,
        );
  return { ref: setContainer, zoom };
}
