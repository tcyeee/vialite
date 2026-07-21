// Fullscreen keyboard preview (全屏预览): a portal overlay that hides everything
// but the board and grows it, centered, to fill the viewport. Reuses two
// patterns already established elsewhere in the codebase rather than inventing
// new ones:
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

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { startViewTransition } from "../common/viewTransition.ts";
import { KeyboardLayoutPreview } from "./KeyboardLayoutPreview.tsx";
import { boardNaturalHeight, boardNaturalWidth } from "./autoFitSize.ts";

const HERO_NAME = "keyboard-hero";

/** Breathing room (px) reserved around the board inside the fullscreen viewport. */
const VIEWPORT_PADDING = 96;
/** Fullscreen may enlarge past the board's natural 1× size (unlike auto-fit, which only ever shrinks) — capped so a tiny layout (e.g. a numpad) doesn't blow up to blurry proportions on a huge monitor. */
const MAX_FULLSCREEN_ZOOM = 3.5;

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

/** Continuous zoom that fits the board into the viewport (both axes), growing past 1× if there's room. */
function useFullscreenFitZoom(keyboard: Keyboard, active: boolean): number {
  const { spacing, keycapWidth, caseThickness } = usePreviewAppearance();
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

  if (!active) {
    return 1;
  }
  const naturalW = boardNaturalWidth(keyboard, spacing, keycapWidth, caseThickness);
  const naturalH = boardNaturalHeight(keyboard, spacing, keycapWidth, caseThickness);
  const availW = Math.max(viewport.w - VIEWPORT_PADDING * 2, 100);
  const availH = Math.max(viewport.h - VIEWPORT_PADDING * 2, 100);
  return Math.min(availW / naturalW, availH / naturalH, MAX_FULLSCREEN_ZOOM);
}

/**
 * The fullscreen overlay itself: a fixed, full-viewport backdrop portaled onto
 * `document.body` (so it sits above the navbar and everything else regardless
 * of where this component lives in the tree) with the enlarged board centered
 * and a close button top-right. Renders nothing while collapsed.
 */
export function FullscreenPreviewOverlay({
  keyboard,
  layer,
  handle,
}: {
  keyboard: Keyboard;
  layer: number;
  handle: FullscreenPreviewHandle;
}) {
  const { t } = useI18n();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const zoom = useFullscreenFitZoom(keyboard, handle.fullscreen);

  useEffect(() => {
    if (!handle.fullscreen) return;
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

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-brand-background">
      <button
        ref={closeBtnRef}
        type="button"
        onClick={() => closeBtnRef.current && handle.close(closeBtnRef.current)}
        aria-label={t("fullscreenPreviewExit")}
        className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-brand-on-surface-variant transition-colors hover:bg-red-500/15 hover:text-red-500 dark:bg-white/10 dark:hover:bg-red-500/20"
      >
        <Icon icon="mdi:close" className="h-5 w-5" />
      </button>
      <div style={{ viewTransitionName: handle.heroName }}>
        <KeyboardLayoutPreview keyboard={keyboard} layer={layer} zoomOverride={zoom} />
      </div>
    </div>,
    document.body,
  );
}
