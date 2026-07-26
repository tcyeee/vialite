import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { usePreviewAppearance } from "../../../contexts/previewAppearance.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { KEYBOARD_HERO_NAME, startViewTransition } from "../../common/viewTransition.ts";
import { boardNaturalHeight, boardNaturalWidth, MAX_AUTO_FIT_ZOOM } from "../layout/autoFitSize.ts";
import { scaleWithViewportWidth, VIEWPORT_PADDING_MAX, VIEWPORT_PADDING_MIN, BOARD_HEIGHT_VH_SHARE } from "./fullscreenPreviewMetrics.ts";

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
  /** `keyboard-hero` while a transition is in flight, else undefined — see StyleConfig.tsx's file header. */
  heroName: string | undefined;
  open: (origin: Element) => void;
  close: (origin: Element) => void;
}

/**
 * Drives the open/close state and the shared View Transition. `open`/`close`
 * take the element that was clicked (the "全屏预览" button, or the overlay's own
 * close button) so the ripple can grow from that point, mirroring `setTheme`'s
 * `origin` parameter in theme.tsx.
 *
 * `initialFullscreen` lets a caller land straight on the fullscreen page
 * without an origin-anchored ripple — used by `KeyboardColorPanel` when
 * arriving via NewHomePage's hero "个性化" button, which already runs its own
 * App-level View Transition (`heroArriving`) that this hook's own `animating`
 * ripple would otherwise fight over the shared `KEYBOARD_HERO_NAME`.
 */
export function useFullscreenPreview(initialFullscreen = false): FullscreenPreviewHandle {
  const [fullscreen, setFullscreen] = useState(initialFullscreen);
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
    heroName: animating ? KEYBOARD_HERO_NAME : undefined,
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
 * With `autoFit` off, returns `null` instead of a computed number so
 * `KeyboardLayoutPreview` falls back to its own `size`-based zoom exactly like
 * the compact page does — which matters for two reasons: it's how the manual
 * `size` slider actually takes effect in fullscreen at all, and `null` is
 * also what flips `KeyboardZoom`'s `live` flag off, re-enabling the
 * `.keyboard-zoom` CSS transition so toggling the switch animates the resize
 * instead of snapping (a non-null override, live 自适应 tracking every resize
 * frame, deliberately suppresses that transition so it doesn't restart every
 * frame and lag behind the window edge).
 */
export function useFullscreenFitZoom(
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
