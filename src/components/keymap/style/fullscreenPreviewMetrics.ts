// Pure layout math + tuning constants for the fullscreen preview overlay
// (FullscreenPreviewOverlay) — no React state, no JSX. Extracted so the
// overlay component isn't buried under geometry bookkeeping.

/** Scroll distance (px) over which the board's parallax shift and shrink both ramp from 0 to their max — one shared progress value drives both. */
export const BOARD_PARALLAX_SCROLL_RANGE = 200;
/** Where the board's top edge should end up once fully scrolled/parallaxed, in px from the viewport top. */
export const BOARD_SCROLLED_TOP = 50;
/** Cap on how much the board shrinks (as a fraction of its size) by the end of the parallax scroll range. */
export const BOARD_SHRINK_MAX = 0.1;
/** Height (px) of the gradient scrim hung off the bottom of the sticky board container — softens the seam where the settings grid, scrolling up from underneath, would otherwise pop into view right at the board's edge. */
export const BOARD_FADE_ZONE_HEIGHT = 64;

/**
 * All the breathing room around the fullscreen board — side padding (feeds the
 * fit-zoom calc in useFullscreenPreview.ts), the sticky container's top padding
 * (clears the close button and sets the parallax travel, see
 * {@link BOARD_SCROLLED_TOP}), and its bottom padding — scales with viewport
 * width between these min/max pairs instead of a fixed value: a phone shouldn't
 * burn a third of its width on padding, and a 4K monitor shouldn't leave the
 * board looking stranded in a sliver at its center. See
 * {@link scaleWithViewportWidth}.
 */
export const VIEWPORT_PADDING_MIN = 96;
export const VIEWPORT_PADDING_MAX = 220;
export const BOARD_TOP_PADDING_MIN = 112;
export const BOARD_TOP_PADDING_MAX = 176;
export const BOARD_BOTTOM_PADDING_MIN = 24;
export const BOARD_BOTTOM_PADDING_MAX = 48;
/** Viewport width range the paddings above interpolate across — clamped to MIN/MAX outside it. */
export const VIEWPORT_SCALE_MIN_WIDTH = 480;
export const VIEWPORT_SCALE_MAX_WIDTH = 1920;
/** Cap the board's height to a share of the viewport rather than fitting it in full, since the settings grid sits below and the page scrolls — the board shouldn't claim the whole screen before a user even sees there's more below. */
export const BOARD_HEIGHT_VH_SHARE = 0.62;

/** Linear interpolation from `min` at {@link VIEWPORT_SCALE_MIN_WIDTH} to `max` at {@link VIEWPORT_SCALE_MAX_WIDTH}, clamped outside that range. */
export function scaleWithViewportWidth(viewportWidth: number, min: number, max: number): number {
  if (viewportWidth <= VIEWPORT_SCALE_MIN_WIDTH) return min;
  if (viewportWidth >= VIEWPORT_SCALE_MAX_WIDTH) return max;
  const t = (viewportWidth - VIEWPORT_SCALE_MIN_WIDTH) / (VIEWPORT_SCALE_MAX_WIDTH - VIEWPORT_SCALE_MIN_WIDTH);
  return min + t * (max - min);
}

/** Extra breathing room appended after the settings grid, before the pull-to-exit curtain zone below can engage. */
export const CONTENT_BOTTOM_SPACER = 50;

/** Temporarily off — flip back to `true` to re-enable the pull-to-exit curtain below. While `false`, `handleVirtualScroll` bails out immediately so scrolling at the bottom behaves exactly like it did before that feature existed. */
export const PULL_TO_EXIT_ENABLED = false;

/** Pull-to-exit "curtain": once the page is scrolled all the way down, further downward wheel/touch input no longer scrolls (there's nothing left to scroll) and instead grows a dome-shaped curtain from the bottom edge, rubber-banded so it gets progressively harder to pull — see {@link rubberBand}. Sustained pulling past {@link PULL_EXIT_RAW_THRESHOLD} exits the page. */
export const PULL_CURTAIN_MAX_HEIGHT = 220;
/** Rubber-band stiffness for the curtain, in the same `(x*d*c)/(d+c*x)` form iOS uses for overscroll — smaller resists harder. */
export const PULL_RUBBER_BAND_CONSTANT = 0.5;
/** Raw accumulated pull distance (px, pre-rubber-band) needed to trigger the exit. Deliberately well past where the curtain's visual height saturates, so reaching it takes sustained pulling rather than a single flick. */
export const PULL_EXIT_RAW_THRESHOLD = 1400;
/** If no further forward (downward) wheel input arrives within this window, the curtain is treated as released and springs back — there's no discrete "wheel end" event to key off like there is for touch (`touchend`). */
export const PULL_WHEEL_IDLE_RELEASE_MS = 150;
/** Multiplier applied to the pull amount each spring-back animation frame — smaller snaps back faster. */
export const PULL_RELEASE_DECAY = 0.72;

/** iOS-style diminishing-returns resistance curve: approaches `max` as `raw` grows, but each additional unit of input yields a smaller visual gain the further in you already are. */
export function rubberBand(raw: number, max: number, constant: number) {
  if (raw <= 0) return 0;
  return (raw * max * constant) / (max + constant * raw);
}
