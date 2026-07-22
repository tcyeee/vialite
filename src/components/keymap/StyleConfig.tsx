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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type UIEvent as ReactUIEvent,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { ReactLenis, type LenisRef } from "lenis/react";
import type { VirtualScrollData } from "lenis";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { startViewTransition } from "../common/viewTransition.ts";
import { KeyboardLayoutPreview } from "./KeyboardLayoutPreview.tsx";
import { boardNaturalHeight, boardNaturalWidth, MAX_AUTO_FIT_ZOOM } from "./autoFitSize.ts";

const HERO_NAME = "keyboard-hero";

/** Scale applied to the close button while hovered — it grows from its corner-anchored resting size back into full view. */
const CLOSE_HOVER_SCALE = 2;

/** Matches the close button's own `h-20 w-20` Tailwind size (5rem) — used below to locate its resting center without reading back a `getBoundingClientRect` that the magnet effect's own translate would otherwise feed back into. */
const CLOSE_BTN_SIZE = 80;
/** Matches the close button's `-right-5 -top-5` Tailwind offset (-1.25rem) — how far outside the viewport corner it rests before any magnet pull is applied. */
const CLOSE_BTN_REST_OFFSET = -20;
/** Distance (px, from the close button's resting center) within which the cursor starts pulling it closer — see {@link CLOSE_MAGNET_MAX_SHIFT}. Falls off linearly to 0 at this radius so the pull eases in instead of snapping on. */
const CLOSE_MAGNET_RADIUS = 220;
/** Cap (px) on how far the cursor can pull the close button down/left from its corner — it only ever moves toward the page content, never further up/right off-screen. */
const CLOSE_MAGNET_MAX_SHIFT = 50;

/** The close button's resting center (before any magnet translate), derived from its own fixed Tailwind offset/size rather than measuring the live (possibly already-translated) DOM rect. */
function closeButtonRestCenter() {
  return {
    x: window.innerWidth - CLOSE_BTN_REST_OFFSET - CLOSE_BTN_SIZE / 2,
    y: CLOSE_BTN_REST_OFFSET + CLOSE_BTN_SIZE / 2,
  };
}

/** Scroll distance (px) over which the board's parallax shift and shrink both ramp from 0 to their max — one shared progress value drives both. */
const BOARD_PARALLAX_SCROLL_RANGE = 200;
/** Where the board's top edge should end up once fully scrolled/parallaxed, in px from the viewport top. */
const BOARD_SCROLLED_TOP = 50;
/** Cap on how much the board shrinks (as a fraction of its size) by the end of the parallax scroll range. */
const BOARD_SHRINK_MAX = 0.1;
/** Height (px) of the gradient scrim hung off the bottom of the sticky board container — softens the seam where the settings grid, scrolling up from underneath, would otherwise pop into view right at the board's edge. */
const BOARD_FADE_ZONE_HEIGHT = 64;

/**
 * All the breathing room around the fullscreen board — side padding (feeds the
 * fit-zoom calc below), the sticky container's top padding (clears the close
 * button and sets the parallax travel, see {@link BOARD_SCROLLED_TOP}), and its
 * bottom padding — scales with viewport width between these min/max pairs
 * instead of a fixed value: a phone shouldn't burn a third of its width on
 * padding, and a 4K monitor shouldn't leave the board looking stranded in a
 * sliver at its center. See {@link scaleWithViewportWidth}.
 */
const VIEWPORT_PADDING_MIN = 96;
const VIEWPORT_PADDING_MAX = 220;
const BOARD_TOP_PADDING_MIN = 112;
const BOARD_TOP_PADDING_MAX = 176;
const BOARD_BOTTOM_PADDING_MIN = 24;
const BOARD_BOTTOM_PADDING_MAX = 48;
/** Viewport width range the paddings above interpolate across — clamped to MIN/MAX outside it. */
const VIEWPORT_SCALE_MIN_WIDTH = 480;
const VIEWPORT_SCALE_MAX_WIDTH = 1920;
/** Cap the board's height to a share of the viewport rather than fitting it in full, since the settings grid sits below and the page scrolls — the board shouldn't claim the whole screen before a user even sees there's more below. */
const BOARD_HEIGHT_VH_SHARE = 0.62;

/** Linear interpolation from `min` at {@link VIEWPORT_SCALE_MIN_WIDTH} to `max` at {@link VIEWPORT_SCALE_MAX_WIDTH}, clamped outside that range. */
function scaleWithViewportWidth(viewportWidth: number, min: number, max: number): number {
  if (viewportWidth <= VIEWPORT_SCALE_MIN_WIDTH) return min;
  if (viewportWidth >= VIEWPORT_SCALE_MAX_WIDTH) return max;
  const t = (viewportWidth - VIEWPORT_SCALE_MIN_WIDTH) / (VIEWPORT_SCALE_MAX_WIDTH - VIEWPORT_SCALE_MIN_WIDTH);
  return min + t * (max - min);
}

/** Extra breathing room appended after the settings grid, before the pull-to-exit curtain zone below can engage. */
const CONTENT_BOTTOM_SPACER = 50;

/** Temporarily off — flip back to `true` to re-enable the pull-to-exit curtain below. While `false`, `handleVirtualScroll` bails out immediately so scrolling at the bottom behaves exactly like it did before that feature existed. */
const PULL_TO_EXIT_ENABLED = false;

/** Pull-to-exit "curtain": once the page is scrolled all the way down, further downward wheel/touch input no longer scrolls (there's nothing left to scroll) and instead grows a dome-shaped curtain from the bottom edge, rubber-banded so it gets progressively harder to pull — see {@link rubberBand}. Sustained pulling past {@link PULL_EXIT_RAW_THRESHOLD} exits the page. */
const PULL_CURTAIN_MAX_HEIGHT = 220;
/** Rubber-band stiffness for the curtain, in the same `(x*d*c)/(d+c*x)` form iOS uses for overscroll — smaller resists harder. */
const PULL_RUBBER_BAND_CONSTANT = 0.5;
/** Raw accumulated pull distance (px, pre-rubber-band) needed to trigger the exit. Deliberately well past where the curtain's visual height saturates, so reaching it takes sustained pulling rather than a single flick. */
const PULL_EXIT_RAW_THRESHOLD = 1400;
/** If no further forward (downward) wheel input arrives within this window, the curtain is treated as released and springs back — there's no discrete "wheel end" event to key off like there is for touch (`touchend`). */
const PULL_WHEEL_IDLE_RELEASE_MS = 150;
/** Multiplier applied to the pull amount each spring-back animation frame — smaller snaps back faster. */
const PULL_RELEASE_DECAY = 0.72;

/** iOS-style diminishing-returns resistance curve: approaches `max` as `raw` grows, but each additional unit of input yields a smaller visual gain the further in you already are. */
function rubberBand(raw: number, max: number, constant: number) {
  if (raw <= 0) return 0;
  return (raw * max * constant) / (max + constant * raw);
}

function setRevealGeometry(origin: Element) {
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const style = document.documentElement.style;
  style.setProperty("--fsp-reveal-x", `${x}px`);
  style.setProperty("--fsp-reveal-y", `${y}px`);
  style.setProperty("--fsp-reveal-r", `${radius}px`);
}

export interface FullscreenPreviewHandle {
  fullscreen: boolean;
  /** `keyboard-hero` while a transition is in flight, else undefined — see file header. */
  heroName: string | undefined;
  open: (origin: Element) => void;
  close: (origin: Element) => void;
}

/**
 * Drives the open/close state and the shared View Transition. `open`/`close`
 * take the element that was clicked (the "全屏预览" button, or the overlay's own
 * close button) so the ripple can grow from that point, mirroring `setTheme`'s
 * `origin` parameter in theme.tsx.
 */
export function useFullscreenPreview(): FullscreenPreviewHandle {
  const [fullscreen, setFullscreen] = useState(false);
  const [animating, setAnimating] = useState(false);

  const run = useCallback((origin: Element | null | undefined, next: boolean) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!origin || reduceMotion) {
      setFullscreen(next);
      return;
    }
    setRevealGeometry(origin);
    document.documentElement.dataset.fspAnim = "reveal";
    // Tag whichever board is currently mounted *before* the transition starts,
    // so the old snapshot captures the name; the other board picks it up once
    // `fullscreen` flips inside the transition callback below.
    flushSync(() => setAnimating(true));
    const transition = startViewTransition(() => flushSync(() => setFullscreen(next)));
    void transition.finished.finally(() => {
      delete document.documentElement.dataset.fspAnim;
      setAnimating(false);
    });
  }, []);

  return {
    fullscreen,
    heroName: animating ? HERO_NAME : undefined,
    open: (origin) => run(origin, true),
    close: (origin) => run(origin, false),
  };
}

/**
 * Continuous zoom that fits the board into the viewport (both axes) while
 * 自适应大小 (`autoFit`) is on, capped at {@link MAX_AUTO_FIT_ZOOM} (the "l"
 * level, i.e. the board's natural 1× size) — same ceiling the compact page's
 * `useAutoFitZoom` applies, so fullscreen never blows a tiny layout (e.g. a
 * numpad) up past its designed size just because a huge monitor has the room.
 * With `autoFit` off, returns `null` instead of a computed number so {@link
 * KeyboardLayoutPreview} falls back to its own `size`-based zoom exactly like
 * the compact page does — which matters for two reasons: it's how the manual
 * `size` slider actually takes effect in fullscreen at all, and `null` is
 * also what flips {@link KeyboardZoom}'s `live` flag off, re-enabling the
 * `.keyboard-zoom` CSS transition so toggling the switch animates the resize
 * instead of snapping (a non-null override, live 自适应 tracking every resize
 * frame, deliberately suppresses that transition so it doesn't restart every
 * frame and lag behind the window edge).
 */
function useFullscreenFitZoom(
  keyboard: Keyboard,
  active: boolean,
): { zoom: number | null; viewportWidth: number } {
  const { autoFit, spacing, keycapWidth, caseThickness } = usePreviewAppearance();
  const [viewport, setViewport] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));

  useEffect(() => {
    if (!active) return;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active]);

  if (!active || !autoFit) {
    return { zoom: null, viewportWidth: viewport.w };
  }
  const naturalW = boardNaturalWidth(keyboard, spacing, keycapWidth, caseThickness);
  const naturalH = boardNaturalHeight(keyboard, spacing, keycapWidth, caseThickness);
  const sidePadding = scaleWithViewportWidth(viewport.w, VIEWPORT_PADDING_MIN, VIEWPORT_PADDING_MAX);
  const availW = Math.max(viewport.w - sidePadding * 2, 100);
  const availH = Math.max(viewport.h * BOARD_HEIGHT_VH_SHARE, 240);
  return {
    zoom: Math.min(availW / naturalW, availH / naturalH, MAX_AUTO_FIT_ZOOM),
    viewportWidth: viewport.w,
  };
}

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
  // Corner-tucked close button: it rests partly outside the viewport (see its
  // `-top`/`-right` offsets below) and scales up from its top-right corner —
  // `transformOrigin: "top right"` — so hovering grows it back into full view
  // instead of growing further off-screen.
  const [closeHover, setCloseHover] = useState(false);
  // Magnetic pull: as the cursor nears the tucked-away close button, it
  // slides down/left to meet it (see CLOSE_MAGNET_* above) instead of making
  // the user hunt for a target that starts mostly off-screen. `x`/`y` are
  // each 0..CLOSE_MAGNET_MAX_SHIFT, applied as translate(-x, y) below.
  const [closeMagnet, setCloseMagnet] = useState({ x: 0, y: 0 });
  // Scroll-linked parallax: nudges the sticky board further up than plain
  // `sticky top-0` pinning would, so it visibly slides as the settings below
  // scroll past it.
  const [scrollTop, setScrollTop] = useState(0);
  const handleScroll = (e: ReactUIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop);
  const scrollProgress = Math.min(scrollTop / BOARD_PARALLAX_SCROLL_RANGE, 1);
  const boardParallaxShift = scrollProgress * boardParallaxMaxShift;
  const boardScale = 1 - scrollProgress * BOARD_SHRINK_MAX;

  // Pull-to-exit curtain (see PULL_* constants above). `handle` is a fresh
  // object every render (its `close`/`open` are plain closures over the
  // memoized `run`, not themselves memoized), so it's mirrored into a ref —
  // `handleVirtualScroll` below is intentionally created once (`useCallback`
  // with `[]`) and must only ever read *current* values through refs, since
  // ReactLenis's own effect that wires up `options.virtualScroll` keys off
  // `JSON.stringify(options)`, which silently drops function values, so a
  // fresh closure passed on a later render would never actually get rewired.
  const handleRef = useRef(handle);
  handleRef.current = handle;
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
  /** Reached the threshold — exit via the same view-transition `handle.close` the close button/Escape use, but anchored at the bottom-center anchor below so the reveal expands upward from the bottom instead of from wherever the button sits. */
  const triggerPullExit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    stopWheelIdleTimer();
    stopReleaseAnimation();
    pullRawRef.current = 0;
    setPullRaw(0);
    const anchor = exitAnchorRef.current;
    if (anchor) handleRef.current.close(anchor);
  }, [stopReleaseAnimation, stopWheelIdleTimer]);
  // The interception point: Lenis calls this for every wheel/touch tick
  // before consuming it (see the `virtualScroll` option below), letting us
  // read deltas past the scroll limit that would otherwise just be clamped
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
    if (!handle.fullscreen) return;
    setCloseMagnet({ x: 0, y: 0 });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf: number | null = null;
    const onMouseMove = (e: MouseEvent) => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const rest = closeButtonRestCenter();
        const dx = rest.x - e.clientX; // positive: cursor is left of the resting corner
        const dy = e.clientY - rest.y; // positive: cursor is below the resting corner
        const distance = Math.hypot(dx, dy);
        if (distance >= CLOSE_MAGNET_RADIUS) {
          setCloseMagnet({ x: 0, y: 0 });
          return;
        }
        const pull = 1 - distance / CLOSE_MAGNET_RADIUS;
        setCloseMagnet({
          x: Math.max(0, Math.min(dx, CLOSE_MAGNET_MAX_SHIFT)) * pull,
          y: Math.max(0, Math.min(dy, CLOSE_MAGNET_MAX_SHIFT)) * pull,
        });
      });
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [handle.fullscreen]);

  useEffect(() => {
    if (!handle.fullscreen) return;
    setScrollTop(0);
    exitingRef.current = false;
    pullRawRef.current = 0;
    setPullRaw(0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeBtnRef.current) {
        handle.close(closeBtnRef.current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      stopWheelIdleTimer();
      stopReleaseAnimation();
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
      <button
        ref={closeBtnRef}
        type="button"
        onClick={() => closeBtnRef.current && handle.close(closeBtnRef.current)}
        onMouseEnter={() => setCloseHover(true)}
        onMouseLeave={() => setCloseHover(false)}
        aria-label={t("fullscreenPreviewExit")}
        className="fixed -right-5 -top-5 z-20 flex h-20 w-20 items-center justify-center rounded-full bg-black/5 text-brand-on-surface-variant backdrop-blur transition-transform duration-200 ease-out hover:bg-red-500/15 hover:text-red-500 dark:bg-white/10 dark:hover:bg-red-500/20"
        style={{
          transformOrigin: "top right",
          transform: `translate(${-closeMagnet.x}px, ${closeMagnet.y}px) scale(${closeHover ? CLOSE_HOVER_SCALE : 1})`,
        }}
      >
        <Icon icon="mdi:close" className="h-10 w-10" />
      </button>
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
              viewTransitionName: handle.heroName,
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
