import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLenis } from "lenis/react";
import { startViewTransition, type ConfigSwapSide } from "../components/common/viewTransition.ts";
import type { MessageKey } from "../contexts/i18n.tsx";
import { track } from "../lib/analytics.ts";

export type PageMode =
  | "keymap"
  | "matrix"
  | "macro"
  | "tapdance"
  | "combo"
  | "rgb"
  | "color"
  | "advanced"
  | "preview3d"
  | "newHome"
  | "siteConfig";

/**
 * Whether a navigation attempt away from Advanced Settings should be intercepted by the
 * "unsaved changes" dialog instead of switching immediately. Extracted from `navigate()`
 * below purely so this one branchy decision can be unit-tested without rendering anything.
 */
export function shouldInterceptNavigation(
  mode: PageMode,
  next: PageMode,
  qmkPendingCount: number,
): boolean {
  return mode === "advanced" && next !== "advanced" && qmkPendingCount > 0;
}

interface UsePageNavigationOptions {
  /** Called right after `mode` actually changes (not when a navigation gets intercepted). */
  onNavigated?: () => void;
}

/**
 * Page mode + every animated-transition concern layered on top of it: hero-morph View
 * Transitions into 个性化/键盘配置, the plain push/push-back slide for every other page, the
 * QMK Settings "unsaved changes" navigation gate, and the "详细设置" deep-link scroll.
 * Split out of App.tsx so this state machine can be reasoned about (and its one real branch,
 * {@link shouldInterceptNavigation}, tested) independently of the rest of the app.
 */
export function usePageNavigation({ onNavigated }: UsePageNavigationOptions = {}) {
  const [mode, setMode] = useState<PageMode>("newHome");
  // True for the brief window a browser View Transition is morphing the hero
  // keyboard from NewHomePage's preview box into the 个性化 or 键盘配置 page's
  // board (see handlePersonalize/handleGoToKeymap below) — passed to both ends
  // so each tags its board wrapper with the same KEYBOARD_HERO_NAME at the
  // right moment.
  const [heroNavAnimating, setHeroNavAnimating] = useState(false);
  // True for the duration of a "push" page transition (see navigateSlide)
  // that doesn't involve the hero morph at all (网站信息 and every other menu
  // page). NewHomePage's hero keyboard normally tags itself with
  // KEYBOARD_HERO_NAME at all times so it survives the theme-reveal ripple —
  // but during a push transition that would pull it into its own separately
  // animated view-transition group instead of sliding along with the rest of
  // the page, so it's suppressed for that window instead.
  const [heroNameSuppressed, setHeroNameSuppressed] = useState(false);
  // 只在 键盘配置 ↔ 个性化 这一对页面互相切换时非 null,值是本次导航*离开*的
  // 那一侧。两个页面都据此决定自己下方配置区该挂 out 还是 in 的
  // view-transition-name(见 configSwapName),从而在头部键盘做 hero 形变的
  // 同时,下方配置区跑一段「旧的下滑淡出、新的上滑淡入」的接力动画,而不是跟
  // 着 root 一起硬交叉淡化。从首页进来时保持 null,行为不变。
  const [configSwapFrom, setConfigSwapFrom] = useState<ConfigSwapSide | null>(null);
  const [qmkSections, setQmkSections] = useState<MessageKey[]>([]);
  const [qmkPendingCount, setQmkPendingCount] = useState(0);
  const [qmkLeaveRequested, setQmkLeaveRequested] = useState(false);
  // Target mode of a navigation attempt that got intercepted by qmkLeaveRequested; applied once
  // QmkSettingsPanel reports how the user resolved the "unsaved changes" dialog.
  const qmkPendingNavigationRef = useRef<PageMode | null>(null);
  // The shared shell's CornerCloseButton: read as the View Transition's origin element when
  // leaving the keymap page, same pattern as StyleConfig.tsx's own closeBtnRef.
  const cornerCloseRef = useRef<HTMLButtonElement>(null);
  // Page-level smooth-scroller, shared with the sidebar TOC so a "详细设置" jump into
  // the Advanced page lands with the same inertia easing.
  const lenis = useLenis();

  // Bails out (returns the same array reference) when the section list is unchanged, so this
  // doesn't cause QmkSettingsPanel's per-render effect to re-trigger a parent re-render forever.
  const handleQmkSectionsChange = useCallback((sections: MessageKey[]) => {
    setQmkSections((prev) =>
      prev.length === sections.length && prev.every((id, i) => id === sections[i]) ? prev : sections,
    );
  }, []);

  // Remembers whatever `mode` was immediately before the current one, through
  // every navigation path (not just navigateSlide's "push") — see
  // `navigateBack` below, used by the shared page shell's CornerCloseButton so
  // a pushed page (e.g. 3D 预览, now reachable from 个性化 instead of only
  // NewHomePage) closes back to wherever it was actually opened from.
  const previousModeRef = useRef<PageMode>("newHome");

  // Tries to switch page mode, but detours through QmkSettingsPanel's "unsaved changes" dialog
  // first when leaving Advanced Settings with edits still pending.
  const navigate = useCallback(
    (next: PageMode) => {
      if (shouldInterceptNavigation(mode, next, qmkPendingCount)) {
        qmkPendingNavigationRef.current = next;
        setQmkLeaveRequested(true);
        return;
      }
      track(`view/${next}`);
      if (next !== mode) previousModeRef.current = mode;
      setMode(next);
      onNavigated?.();
    },
    [mode, qmkPendingCount, onNavigated],
  );

  // NewHomePage's "个性化" button: like useFullscreenPreview's open/close, runs
  // the mode switch inside a browser View Transition so the hero keyboard box
  // visibly morphs into the 个性化 page's board instead of hard-cutting between
  // the two unrelated component trees. `origin` is the clicked button, used
  // only as the reduced-motion guard's existence check here (unlike
  // useFullscreenPreview's ripple, this transition has no radial-reveal
  // geometry to anchor).
  const handlePersonalize = useCallback(
    (origin: Element | null) => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!origin || reduceMotion) {
        navigate("color");
        return;
      }
      // 从 键盘配置 页点过来才算「互切」,要在快照*之前*把离场侧的名字挂上。
      const swapping = mode === "keymap";
      flushSync(() => {
        setHeroNavAnimating(true);
        if (swapping) setConfigSwapFrom("keymap");
      });
      const transition = startViewTransition(() => flushSync(() => navigate("color")));
      void transition.finished.finally(() => {
        setHeroNavAnimating(false);
        setConfigSwapFrom(null);
      });
    },
    [mode, navigate],
  );

  // NewHomePage's "键盘配置" menu entry: same hero-morph treatment as
  // handlePersonalize, just landing on "keymap" instead of "color".
  const handleGoToKeymap = useCallback(
    (origin: Element | null) => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!origin || reduceMotion) {
        navigate("keymap");
        return;
      }
      // 从 个性化 页(即 KeyboardColorPanel 板下方的「键盘按键配置」按钮)点回来
      // 是互切的另一个方向,离场侧变成 color。
      const swapping = mode === "color";
      flushSync(() => {
        setHeroNavAnimating(true);
        if (swapping) setConfigSwapFrom("color");
      });
      const transition = startViewTransition(() => flushSync(() => navigate("keymap")));
      void transition.finished.finally(() => {
        setHeroNavAnimating(false);
        setConfigSwapFrom(null);
      });
    },
    [mode, navigate],
  );

  // The 个性化/键盘配置 fullscreen page's corner "back" button (see
  // StyleConfig.tsx's `onBack`, and the shared shell's CornerCloseButton):
  // reverses handlePersonalize's/handleGoToKeymap's hero transition,
  // landing back on NewHomePage instead of collapsing in place.
  // `heroNavAnimating` is direction-agnostic — whichever of {NewHomePage,
  // KeyboardColorPanel, the keymap board} is mounted when it flips true gets
  // tagged with KEYBOARD_HERO_NAME, so reusing it here for the reverse trip
  // just works.
  const handleBackToHome = useCallback(
    (origin: Element | null) => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!origin || reduceMotion) {
        navigate("newHome");
        return;
      }
      flushSync(() => setHeroNavAnimating(true));
      const transition = startViewTransition(() => flushSync(() => navigate("newHome")));
      void transition.finished.finally(() => setHeroNavAnimating(false));
    },
    [navigate],
  );

  // Every other page reachable via a push transition (网站信息, matrix, macro,
  // tapdance, combo, rgb, advanced) plus 3D 预览 (now pushed from 个性化's
  // bottom button instead of NewHomePage's menu): no shared hero element to
  // morph, so instead the whole page slides as one unit — see the
  // `data-page-anim` rules in index.css. `direction` picks which way: "push"
  // when navigating away from the current page, "push-back" when returning
  // (the exact mirror).
  const navigateSlide = useCallback(
    (next: PageMode, direction: "push" | "push-back") => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        navigate(next);
        return;
      }
      flushSync(() => setHeroNameSuppressed(true));
      document.documentElement.dataset.pageAnim = direction;
      const transition = startViewTransition(() => flushSync(() => navigate(next)));
      void transition.finished.finally(() => {
        delete document.documentElement.dataset.pageAnim;
        setHeroNameSuppressed(false);
      });
    },
    [navigate],
  );

  // Returns to whatever `mode` was immediately before the current one (see
  // `previousModeRef` above) — used by the shared page shell's
  // CornerCloseButton (App.tsx) instead of a hardcoded "newHome", so a pushed
  // page (e.g. 3D 预览, now reachable from 个性化 instead of only NewHomePage)
  // closes back to its actual origin instead of always dropping the user at
  // the home page.
  const navigateBack = useCallback(() => {
    navigateSlide(previousModeRef.current, "push-back");
  }, [navigateSlide]);

  const handleQmkLeaveResolved = useCallback(
    (shouldLeave: boolean) => {
      setQmkLeaveRequested(false);
      const next = qmkPendingNavigationRef.current;
      qmkPendingNavigationRef.current = null;
      if (shouldLeave && next !== null) {
        track(`view/${next}`);
        // Only ever reached while leaving "advanced" — see shouldInterceptNavigation.
        previousModeRef.current = "advanced";
        setMode(next);
        onNavigated?.();
      }
    },
    [onNavigated],
  );

  // A QMK Settings section a quick-config card asked to jump to ("详细设置"): remembered
  // across the navigation to the Advanced page, then consumed by the effect below once
  // that section has actually rendered (its `<section id={titleKey}>` exists in the DOM).
  const pendingQmkScrollRef = useRef<MessageKey | null>(null);
  const openQmkSection = useCallback(
    (section: MessageKey) => {
      pendingQmkScrollRef.current = section;
      navigate("advanced");
    },
    [navigate],
  );

  // Scroll to the pending QMK section once the Advanced page has mounted and reported
  // its sections (qmkSections). Mirrors the sidebar TOC's Lenis-or-native jump, but the
  // page has *just* switched to Advanced, so its full height isn't laid out yet: Lenis
  // still holds the previous (shorter) page's scroll range and would clamp the jump
  // short. Wait two animation frames for layout to settle, force Lenis to re-measure
  // (`resize`), then scroll — and keep the target pending (don't clear the ref) until
  // that actually runs, so a re-render mid-wait retries instead of dropping the jump.
  useEffect(() => {
    const section = pendingQmkScrollRef.current;
    if (mode !== "advanced" || section === null) return;
    const target = document.getElementById(section);
    if (!target) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        pendingQmkScrollRef.current = null;
        if (lenis) {
          lenis.resize();
          lenis.scrollTo(target, { offset: -80, force: true, immediate: reduceMotion });
        } else {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [mode, qmkSections, lenis]);

  // Reverts navigation-owned state to what a freshly connected keyboard should see —
  // called from useConnectionTransition's onAttached, at the exact point attachTransport used
  // to run these resets inline.
  const resetForConnect = useCallback(() => {
    setMode("newHome");
    previousModeRef.current = "newHome";
    setQmkPendingCount(0);
    setQmkLeaveRequested(false);
    qmkPendingNavigationRef.current = null;
  }, []);

  // Called from useConnectionTransition's onDetached, at the point finishDisconnect used to
  // run these resets inline.
  const resetForDisconnect = useCallback(() => {
    setQmkSections([]);
    setQmkPendingCount(0);
    setQmkLeaveRequested(false);
    qmkPendingNavigationRef.current = null;
  }, []);

  return {
    mode,
    heroNavAnimating,
    heroNameSuppressed,
    configSwapFrom,
    qmkSections,
    qmkPendingCount,
    qmkLeaveRequested,
    setQmkPendingCount,
    navigate,
    navigateSlide,
    navigateBack,
    handlePersonalize,
    handleGoToKeymap,
    handleBackToHome,
    handleQmkSectionsChange,
    handleQmkLeaveResolved,
    openQmkSection,
    cornerCloseRef,
    resetForConnect,
    resetForDisconnect,
  };
}
