// Fullscreen keyboard preview (全屏预览): a portal overlay that hides everything
// but an enlarged board plus the full set of 个性化 appearance settings (passed
// in as `settings`), scrolling as one page. Reuses two patterns already
// established elsewhere in the codebase rather than inventing new ones:
//  - the circular clip-path "reveal" View Transition theme.tsx uses for the
//    light/dark switch (same technique, separate CSS vars/data-attr so the two
//    can't clobber each other if both somehow fire back-to-back);
//  - the per-element `view-transition-name` shared-element morph
//    ExpandableCardColumn.tsx uses for its card expand/collapse, so the board
//    itself smoothly grows from its in-page spot to the centered fullscreen
//    spot (and shrinks back on exit) instead of just cross-fading.
//
// The name is only ever applied to whichever of {compact board, overlay board}
// is currently mounted, and only for the duration of the transition — see
// ExpandableCardColumn's `animating` for why a persistently-named element is
// avoided (it would get pulled into *every* unrelated transition's top layer).
//
// The open/close view-transition state machine lives in useFullscreenPreview.ts,
// the pull-to-exit curtain gesture in usePullToExitCurtain.ts, and the pure
// layout math/tuning constants in fullscreenPreviewMetrics.ts — this file is
// just the overlay's own scroll/parallax wiring and JSX.

import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref, type UIEvent as ReactUIEvent } from "react";
import { createPortal } from "react-dom";
import { ReactLenis } from "lenis/react";
import { useI18n } from "../../../contexts/i18n.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { CornerCloseButton } from "../../common/CornerCloseButton.tsx";
import { KEYBOARD_HERO_NAME } from "../../common/viewTransition.ts";
import { KeyboardLayoutPreview } from "../layout/KeyboardLayoutPreview.tsx";
import type { FullscreenPreviewHandle } from "./useFullscreenPreview.ts";
import { useFullscreenFitZoom } from "./useFullscreenPreview.ts";
import { usePullToExitCurtain } from "./usePullToExitCurtain.ts";
import {
  BOARD_BOTTOM_PADDING_MAX,
  BOARD_BOTTOM_PADDING_MIN,
  BOARD_FADE_ZONE_HEIGHT,
  BOARD_PARALLAX_SCROLL_RANGE,
  BOARD_SCROLLED_TOP,
  BOARD_SHRINK_MAX,
  BOARD_TOP_PADDING_MAX,
  BOARD_TOP_PADDING_MIN,
  CONTENT_BOTTOM_SPACER,
  PULL_CURTAIN_MAX_HEIGHT,
  PULL_TO_EXIT_ENABLED,
  scaleWithViewportWidth,
} from "./fullscreenPreviewMetrics.ts";

export { useFullscreenPreview, type FullscreenPreviewHandle } from "./useFullscreenPreview.ts";

/**
 * The fullscreen overlay itself: a fixed, full-viewport backdrop portaled onto
 * `document.body` (so it sits above the navbar and everything else regardless
 * of where this component lives in the tree), scrollable so the enlarged board
 * up top and the `settings` sections below it (laid out one-per-row, reflowing
 * into two side-by-side columns once the viewport is wide enough — see the
 * `lg:grid-cols-2` below) both fit regardless of viewport height. The close
 * button is `fixed` rather than `absolute` so it stays put while the page
 * scrolls. Renders nothing while collapsed.
 */
export function FullscreenPreviewOverlay({
  keyboard,
  layer,
  handle,
  settings,
  boardRef,
  heroArriving,
  onBack,
}: {
  keyboard: Keyboard;
  layer: number;
  handle: FullscreenPreviewHandle;
  /** The 个性化 appearance settings sections, moved here from the compact page — each a `<section>` that becomes one grid cell. */
  settings?: ReactNode;
  /**
   * Same ref the compact page attaches to its own board wrapper, so the
   * "Save current layer" screenshot button — now living in `settings`, i.e.
   * only rendered while this overlay is open — captures whichever board
   * instance is actually mounted and visible at that moment. The compact
   * page's copy is `hidden` while this overlay is open, so only one of the
   * two ever holds the ref at a time.
   */
  boardRef?: Ref<HTMLDivElement>;
  /**
   * Mirrors `KeyboardColorPanel`'s own `heroArriving`: true for the brief
   * window this overlay is the direct landing target of the App-level hero
   * transition from NewHomePage (i.e. `handle`'s own `initialFullscreen` was
   * true, so `handle.heroName` never fires — there was no in-page ripple to
   * animate). Tags this board with the shared hero name instead so the
   * NewHomePage box still morphs into *this* board rather than cross-fading.
   */
  heroArriving?: boolean;
  /**
   * Overrides what the top-right corner button (and Escape) do: called with
   * that button's element instead of `handle.close`. Used by
   * `KeyboardColorPanel` to route "back" all the way to `NewHomePage` (an
   * App-level navigation, not just collapsing this overlay back to the
   * compact 个性化 page) — see `App.tsx`'s `handleBackToHome`. Omit to keep
   * the plain collapse-to-compact behavior.
   */
  onBack?: (origin: Element) => void;
}) {
  const { t } = useI18n();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const { zoom, viewportWidth } = useFullscreenFitZoom(keyboard, handle.fullscreen);
  // Padding around the board — side padding feeds the fit-zoom calc above;
  // top/bottom are applied directly below in place of a fixed `pt-28`/`pb-6`.
  // All three scale with viewport width, see VIEWPORT_PADDING_MIN/MAX etc.
  const boardTopPadding = scaleWithViewportWidth(viewportWidth, BOARD_TOP_PADDING_MIN, BOARD_TOP_PADDING_MAX);
  const boardBottomPadding = scaleWithViewportWidth(
    viewportWidth,
    BOARD_BOTTOM_PADDING_MIN,
    BOARD_BOTTOM_PADDING_MAX,
  );
  const boardParallaxMaxShift = boardTopPadding - BOARD_SCROLLED_TOP;
  const handleClose = useCallback(() => {
    const origin = closeBtnRef.current;
    if (!origin) return;
    if (onBack) onBack(origin);
    else handle.close(origin);
  }, [onBack, handle]);
  // Scroll-linked parallax: nudges the sticky board further up than plain
  // `sticky top-0` pinning would, so it visibly slides as the settings below
  // scroll past it.
  const [scrollTop, setScrollTop] = useState(0);
  const handleScroll = (e: ReactUIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop);
  const scrollProgress = Math.min(scrollTop / BOARD_PARALLAX_SCROLL_RANGE, 1);
  const boardParallaxShift = scrollProgress * boardParallaxMaxShift;
  const boardScale = 1 - scrollProgress * BOARD_SHRINK_MAX;

  // Pull-to-exit curtain — see usePullToExitCurtain.ts. `handle.close` is
  // passed straight through; the hook mirrors it into its own ref since
  // `handle` is a fresh object every render.
  const { lenisRef, exitAnchorRef, curtainHeight, handleVirtualScroll } = usePullToExitCurtain(
    handle.fullscreen,
    (anchor) => handle.close(anchor),
  );

  useEffect(() => {
    if (!handle.fullscreen) return;
    setScrollTop(0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle.fullscreen]);

  if (!handle.fullscreen) {
    return null;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return createPortal(
    // Self-scrolling fixed overlay, given its own scoped Lenis instance (rather
    // than reusing the root one from main.tsx) so wheel-scrolling here gets the
    // same smooth easing as the rest of the page. `data-lenis-prevent` makes
    // the *root* Lenis ignore wheel events over this element (see its
    // `data-lenis-prevent` check) so they fall through to this nested instance
    // instead of the window-level listener trying to scroll the now-hidden
    // page behind it. `scrollbar-hide` keeps the native scrollbar chrome off
    // since the parallax/shrink effect below already reads scroll position.
    <ReactLenis
      ref={lenisRef}
      data-lenis-prevent
      onScroll={handleScroll}
      options={{ smoothWheel: !reduceMotion, virtualScroll: handleVirtualScroll }}
      className="scrollbar-hide fixed inset-0 z-[999] overflow-y-auto bg-brand-background"
    >
      <CornerCloseButton
        ref={closeBtnRef}
        onClick={handleClose}
        label={t("fullscreenPreviewExit")}
        active={handle.fullscreen}
      />
      <div className="mx-auto flex min-h-full max-w-5xl flex-col items-center gap-[30px] px-4 pb-16 sm:px-8">
        {/* 吸顶: sticky (not `fixed`, which would pull it out of flow and stop
            the settings below from actually pushing/scrolling past it) so the
            board scrolls normally until it reaches the top, then pins there
            while the settings underneath keep scrolling — the top padding
            clears the close button and the matching background keeps
            scrolled-under settings from showing through. Top/bottom padding
            is inline (not Tailwind) since it scales with viewport width, see
            BOARD_TOP_PADDING_MIN/MAX etc. The extra `translateY`/`scale`
            nudge it up and shrink it further than plain pinning would once
            the user scrolls, for the parallax feel. */}
        <div
          className="sticky top-0 z-10 flex w-full justify-center bg-brand-background"
          style={{
            paddingTop: boardTopPadding,
            paddingBottom: boardBottomPadding,
            transform: `translateY(-${boardParallaxShift}px)`,
          }}
        >
          {/* The shrink lives on this inner wrapper, not the outer sticky container
              above: that container's `w-full bg-brand-background` is what hides the
              settings grid scrolling up behind it, and `scale()` shrinks a box's
              full visual footprint including its background — put on the outer
              div, it would pull the opaque background in from both edges too,
              uncovering strips down either side for whatever's underneath to show
              through (confirmed: the settings text "beside the keyboard" bug). */}
          <div
            ref={boardRef}
            style={{
              width: "fit-content",
              viewTransitionName: handle.heroName ?? (heroArriving ? KEYBOARD_HERO_NAME : undefined),
              transform: `scale(${boardScale})`,
              transformOrigin: "top",
            }}
          >
            <KeyboardLayoutPreview keyboard={keyboard} layer={layer} zoomOverride={zoom} />
          </div>
          {/* Hangs off the container's own bottom edge (unaffected by the board's
              scale/translate above, which are purely visual) so it stays put at
              the seam between the pinned board and the settings grid scrolling
              up from underneath — fading that content out as it nears the board
              instead of letting it pop into view at a hard edge. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-full bg-gradient-to-b from-brand-background to-transparent"
            style={{ height: BOARD_FADE_ZONE_HEIGHT }}
          />
        </div>
        {settings && (
          // CSS multi-column rather than `grid-cols-2`: a grid pairs sections into
          // rows (row height = the taller of the two cells), leaving gaps below
          // shorter ones once section heights diverge. Columns instead fill
          // top-to-bottom independently, i.e. an actual 瀑布流/masonry flow.
          // `break-inside-avoid` keeps a single section from being split across
          // the column break; the bottom margin substitutes for `gap-y` (columns
          // has no row-gap concept).
          <div className="w-full columns-1 gap-x-6 pt-[50px] lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
            {settings}
          </div>
        )}
        {/* Extra breathing room before the pull-to-exit curtain can engage — see CONTENT_BOTTOM_SPACER. */}
        <div style={{ height: CONTENT_BOTTOM_SPACER }} aria-hidden="true" />
      </div>
      {/* Zero-size, fixed at the viewport's bottom-center — used only as the
          `origin` element for `handle.close()` when exiting via the pull
          gesture below, so `setRevealGeometry`'s rect-center math lands the
          circular reveal's origin at the bottom-center of the screen instead
          of wherever the close button sits. */}
      {PULL_TO_EXIT_ENABLED && (
        <div ref={exitAnchorRef} aria-hidden="true" className="pointer-events-none fixed bottom-0 left-1/2 h-0 w-0" />
      )}
      {PULL_TO_EXIT_ENABLED && curtainHeight > 0 && (
        <div
          aria-hidden="true"
          // `items-end`: the dome below has a *fixed* height (PULL_CURTAIN_MAX_HEIGHT)
          // and is bottom-aligned in this variable-height, overflow-hidden window —
          // so as curtainHeight grows from 0, the window uncovers the dome from its
          // flat base (anchored at the viewport's bottom edge, same as this window's
          // own bottom) upward toward its rounded peak, like a curtain rising off the
          // floor rather than a shape sliding down from the top.
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-center overflow-hidden"
          style={{ height: curtainHeight }}
        >
          <div
            className="w-full max-w-xl bg-brand-surface-container-highest shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
            style={{ height: PULL_CURTAIN_MAX_HEIGHT, borderRadius: "50% 50% 0 0 / 100% 100% 0 0" }}
          />
          {/* Positioned within the (variable-height) clip window rather than the
              fixed-height dome itself, so it tracks the curtain's current top edge
              as it rises instead of staying pinned near the dome's peak and only
              popping into view once the pull is nearly complete. Opacity is left to
              the breathing keyframe itself (an inline fade-in would just fight the
              animation's own opacity keyframes once mounted). */}
          {curtainHeight > 28 && (
            <span className="absolute inset-x-0 top-2 animate-pull-exit-breathe text-center text-sm font-medium text-brand-on-surface-variant">
              {t("fullscreenPreviewPullExit")}
            </span>
          )}
        </div>
      )}
    </ReactLenis>,
    document.body,
  );
}
