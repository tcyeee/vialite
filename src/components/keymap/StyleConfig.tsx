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
import { ReactLenis } from "lenis/react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { startViewTransition } from "../common/viewTransition.ts";
import { KeyboardLayoutPreview } from "./KeyboardLayoutPreview.tsx";
import { boardNaturalHeight, boardNaturalWidth } from "./autoFitSize.ts";

const HERO_NAME = "keyboard-hero";

/** Scale applied to the close button while hovered — it grows from its corner-anchored resting size back into full view. */
const CLOSE_HOVER_SCALE = 2;

/** Scroll distance (px) over which the board's parallax shift and shrink both ramp from 0 to their max — one shared progress value drives both. */
const BOARD_PARALLAX_SCROLL_RANGE = 200;
/** Cap (px) on how far the parallax nudge can push the board up. */
const BOARD_PARALLAX_MAX_SHIFT = 40;
/** Cap on how much the board shrinks (as a fraction of its size) by the end of the parallax scroll range. */
const BOARD_SHRINK_MAX = 0.2;

/** Breathing room (px) reserved on either side of the board inside the fullscreen viewport. */
const VIEWPORT_PADDING = 96;
/** Fullscreen may enlarge past the board's natural 1× size (unlike auto-fit, which only ever shrinks) — capped so a tiny layout (e.g. a numpad) doesn't blow up to blurry proportions on a huge monitor. */
const MAX_FULLSCREEN_ZOOM = 3.5;
/** Cap the board's height to a share of the viewport rather than fitting it in full, since the settings grid sits below and the page scrolls — the board shouldn't claim the whole screen before a user even sees there's more below. */
const BOARD_HEIGHT_VH_SHARE = 0.62;

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
 * Continuous zoom that fits the board into the viewport (both axes), growing
 * past 1× if there's room — but only while 自适应大小 (`autoFit`) is on. With it
 * off, returns `null` instead of a computed number so {@link
 * KeyboardLayoutPreview} falls back to its own `size`-based zoom exactly like
 * the compact page's `useAutoFitZoom` does — which matters for two reasons:
 * it's how the manual `size` slider actually takes effect in fullscreen at
 * all, and `null` is also what flips {@link KeyboardZoom}'s `live` flag off,
 * re-enabling the `.keyboard-zoom` CSS transition so toggling the switch
 * animates the resize instead of snapping (a non-null override, live 自适应
 * tracking every resize frame, deliberately suppresses that transition so it
 * doesn't restart every frame and lag behind the window edge).
 */
function useFullscreenFitZoom(keyboard: Keyboard, active: boolean): number | null {
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
    return null;
  }
  const naturalW = boardNaturalWidth(keyboard, spacing, keycapWidth, caseThickness);
  const naturalH = boardNaturalHeight(keyboard, spacing, keycapWidth, caseThickness);
  const availW = Math.max(viewport.w - VIEWPORT_PADDING * 2, 100);
  const availH = Math.max(viewport.h * BOARD_HEIGHT_VH_SHARE, 240);
  return Math.min(availW / naturalW, availH / naturalH, MAX_FULLSCREEN_ZOOM);
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
  const zoom = useFullscreenFitZoom(keyboard, handle.fullscreen);
  // Corner-tucked close button: it rests partly outside the viewport (see its
  // `-top`/`-right` offsets below) and scales up from its top-right corner —
  // `transformOrigin: "top right"` — so hovering grows it back into full view
  // instead of growing further off-screen.
  const [closeHover, setCloseHover] = useState(false);
  // Scroll-linked parallax: nudges the sticky board further up than plain
  // `sticky top-0` pinning would, so it visibly slides as the settings below
  // scroll past it.
  const [scrollTop, setScrollTop] = useState(0);
  const handleScroll = (e: ReactUIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop);
  const scrollProgress = Math.min(scrollTop / BOARD_PARALLAX_SCROLL_RANGE, 1);
  const boardParallaxShift = scrollProgress * BOARD_PARALLAX_MAX_SHIFT;
  const boardScale = 1 - scrollProgress * BOARD_SHRINK_MAX;

  useEffect(() => {
    if (!handle.fullscreen) return;
    setScrollTop(0);
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
      data-lenis-prevent
      onScroll={handleScroll}
      options={{ smoothWheel: !reduceMotion }}
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
          transform: `scale(${closeHover ? CLOSE_HOVER_SCALE : 1})`,
        }}
      >
        <Icon icon="mdi:close" className="h-10 w-10" />
      </button>
      <div className="mx-auto flex min-h-full max-w-5xl flex-col items-center gap-[30px] px-4 pb-16 sm:px-8">
        {/* 吸顶: sticky (not `fixed`, which would pull it out of flow and stop
            the settings below from actually pushing/scrolling past it) so the
            board scrolls normally until it reaches the top, then pins there
            while the settings underneath keep scrolling — `pt-28` clears the
            close button and the matching background keeps scrolled-under
            settings from showing through. The extra `translateY`/`scale`
            nudge it up and shrink it further than plain pinning would once
            the user scrolls, for the parallax feel. */}
        <div
          className="sticky top-0 z-10 flex w-full justify-center bg-brand-background pb-6 pt-28"
          style={{ transform: `translateY(-${boardParallaxShift}px) scale(${boardScale})` }}
        >
          <div ref={boardRef} style={{ width: "fit-content", viewTransitionName: handle.heroName }}>
            <KeyboardLayoutPreview keyboard={keyboard} layer={layer} zoomOverride={zoom} />
          </div>
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
      </div>
    </ReactLenis>,
    document.body,
  );
}
