import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { KeyboardLayout } from "../keymap/KeyboardLayout.tsx";
import { appearanceMetrics } from "../keymap/KeyboardLayoutPreview.tsx";
import { boardNaturalHeight } from "../keymap/autoFitSize.ts";
import { Keyboard } from "../../protocol/keyboard.ts";
import { NAV_ITEMS } from "./Sidebar.tsx";
import { HomeSitePage } from "./HomeSitePage.tsx";
import type { MessageKey } from "../../contexts/i18n.tsx";

type NavMode = (typeof NAV_ITEMS)[number]["mode"];

/**
 * Nav item `mode`s that already have a real new-home page (rendered in-place, below) instead of
 * falling through to `onNavigate` and jumping into the old Navbar/Sidebar layout. Grows one entry
 * at a time as more of `HOME_NAV_ITEMS` gets converted — see `HomePage` below.
 */
type HomePageMode = "site";

function isHomePageMode(mode: NavMode): mode is HomePageMode {
  return mode === "site";
}

interface Props {
  keyboard: Keyboard;
  layer: number;
  onNavigate: (mode: NavMode) => void;
  onDisconnect: () => void;
}

/** Height budget for the hero keyboard strip, as a fraction of the window height. */
const HERO_MAX_HEIGHT_RATIO = 0.35;

/** 米白色线稿颜色, forced via `colorOverride` regardless of the user's 键盘配色. */
const HERO_LINE_COLOR = "#f2ead8";

/** Element shape shared by every rendered menu item, real `NAV_ITEMS` entries and the synthetic
 * exit item below alike — only the fields the menu strip actually reads. */
type HomeNavItem = { kind: string; mode: NavMode; labelKey: MessageKey; beta?: boolean };

/**
 * NAV_ITEMS reversed, with the "新版首页" (this page itself) entry dropped — this strip is a
 * static showcase of the other nav destinations, not a full nav replica — plus one synthetic
 * "退出新版首页" item appended at the end that always falls through to the old Navbar/Sidebar
 * layout (mode "keymap"), regardless of `isHomePageMode`.
 */
const HOME_NAV_ITEMS: HomeNavItem[] = [
  ...NAV_ITEMS.filter((item) => item.kind !== "newHome").reverse(),
  { kind: "exitNewHome", mode: "keymap", labelKey: "navExitNewHome" },
];

/**
 * Timings for the exit sequence (see `ExitPhase` below). Kept as named constants because the
 * `nav-item-exit`/`hero-exit` keyframe durations in index.css must match these — the JS side
 * uses them to time the phase handoff, so the two are not allowed to drift apart silently.
 */
const ITEM_EXIT_DURATION_MS = 620;
const ITEM_EXIT_BASE_STAGGER_MS = 35;
const HERO_EXIT_DURATION_MS = 520;

/** Per-item stagger/landing jitter so the exit reads as "不规则" rather than a uniform sweep. */
const ITEM_EXIT_JITTER_MS = [0, 55, 15, 85, 25, 65, 5, 95, 35, 75, 20, 60];
const ITEM_EXIT_DX_PX = [-14, 18, -22, 10, -6, 24, -18, 8, -12, 20, -8, 16];

function itemExitDelayMs(index: number): number {
  return index * ITEM_EXIT_BASE_STAGGER_MS + ITEM_EXIT_JITTER_MS[index % ITEM_EXIT_JITTER_MS.length];
}

const itemsExitTotalMs = itemExitDelayMs(HOME_NAV_ITEMS.length - 1) + ITEM_EXIT_DURATION_MS;

/**
 * The staged page-exit sequence fired by clicking a nav item:
 * "idle" (normal) → "items" (every menu item flies up along its own 30° tilt into the hero
 * keyboard strip, staggered/jittered so they don't move in lockstep) → "hero" (once every item
 * has cleared, the hero strip itself slides up and fades) → `onNavigate` actually fires.
 */
type ExitPhase = "idle" | "items" | "hero";

/**
 * 半成品的「新版首页」原型:完全空白的页面(无 Navbar / Sidebar),顶部只读展示键盘
 * 预览,下方竖排列出全部菜单项作为静态展示。点击菜单项会先播放退出动画(菜单项
 * 依次收回键盘区域,随后键盘区域本身上移淡出),动画结束后才真正调用 onNavigate
 * 切换页面。
 *
 * 顶部键盘条按正常尺寸显示(不做任何自适应缩放,与其它页面用的 `useAutoFitZoom`
 * /自定义宽度反推 zoom 都不同——就是当前 预览区域缩放 级别下的原样大小,宽度不够
 * 时靠 `overflow-x-auto` 横向滚动)。唯一的限制是高度:若按当前 zoom 渲染出的高度
 * 超过窗口高度的 35vh,则把 hero 条本身裁到 35vh,内部键盘整体上移(translateY 负
 * 值),让超出的部分移出屏幕上方,只露出底部那部分——而不是从顶部随意裁切。
 */
export function NewHomePage({ keyboard, layer, onNavigate, onDisconnect }: Props) {
  const { t } = useI18n();
  const { size, spacing, keycapWidth, caseRadius, caseThickness } = usePreviewAppearance();
  const [windowHeight, setWindowHeight] = useState(() => window.innerHeight);
  const [exitPhase, setExitPhase] = useState<ExitPhase>("idle");
  const [exitTarget, setExitTarget] = useState<NavMode | null>(null);
  // Which in-place new-home page (if any) is currently showing instead of the hero+nav strip.
  const [homePage, setHomePage] = useState<HomePageMode | null>(null);

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Real new-home pages (see `isHomePageMode`) render in place; everything else still falls
  // through to the old Navbar/Sidebar layout via `onNavigate` until it gets its own page.
  const navigateOrShowHomePage = (target: NavMode) => {
    if (isHomePageMode(target)) {
      setHomePage(target);
    } else {
      onNavigate(target);
    }
  };

  // Drives the "items" → "hero" → navigate/show-page handoff on a plain timer rather than
  // per-element animationend listeners — simpler to keep in sync with the staggered/jittered
  // per-item delays, at the cost of the JS constants above having to match index.css by hand.
  useEffect(() => {
    if (exitPhase === "items") {
      const timer = window.setTimeout(() => setExitPhase("hero"), itemsExitTotalMs);
      return () => window.clearTimeout(timer);
    }
    if (exitPhase === "hero") {
      const timer = window.setTimeout(() => {
        if (exitTarget) {
          navigateOrShowHomePage(exitTarget);
        }
        setExitPhase("idle");
        setExitTarget(null);
      }, HERO_EXIT_DURATION_MS);
      return () => window.clearTimeout(timer);
    }
    // navigateOrShowHomePage is intentionally omitted: it closes over onNavigate/setHomePage,
    // neither of which change identity in a way that should re-trigger this timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitPhase, exitTarget]);

  const handleNavClick = (itemMode: NavMode) => {
    if (exitPhase !== "idle") {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigateOrShowHomePage(itemMode);
      return;
    }
    setExitTarget(itemMode);
    setExitPhase("items");
  };

  // The board's actual rendered height at the normal (non-overridden) zoom —
  // same zoom KeyboardLayout computes internally from the 预览区域缩放 level —
  // so the height budget check matches what's really on screen.
  const renderedHeight = useMemo(() => {
    const naturalHeight = boardNaturalHeight(keyboard, spacing, keycapWidth, caseThickness);
    const { zoom } = appearanceMetrics(size, spacing, keycapWidth, caseRadius, caseThickness);
    return naturalHeight * zoom;
  }, [keyboard, size, spacing, keycapWidth, caseRadius, caseThickness]);

  const maxHeight = windowHeight * HERO_MAX_HEIGHT_RATIO;
  const clipped = renderedHeight > maxHeight;
  const shiftUp = clipped ? renderedHeight - maxHeight : 0;

  const exiting = exitPhase !== "idle";

  if (homePage === "site") {
    return <HomeSitePage onBack={() => setHomePage(null)} />;
  }

  return (
    <div className="flex h-screen flex-col items-center gap-10 overflow-hidden pb-16">
      <div
        className={"relative z-10 w-full overflow-x-auto overflow-y-hidden bg-black pb-[50px] " + (exitPhase === "hero" ? "hero-exit" : "")}
        style={clipped ? { height: maxHeight } : undefined}
      >
        <button
          type="button"
          onClick={onDisconnect}
          disabled={exiting}
          aria-label={t("disconnect")}
          className={
            "absolute right-6 top-6 z-20 flex items-center gap-2 rounded-full border-none bg-transparent px-4 py-2 text-brand-on-surface-variant transition hover:bg-white/10 hover:text-white " +
            (exiting ? "pointer-events-none opacity-0" : "")
          }
        >
          <Icon icon="mdi:power" className="h-5 w-5" />
          {t("disconnect")}
        </button>
        <div
          className="flex w-full justify-center"
          style={shiftUp ? { transform: `translateY(-${shiftUp}px)` } : undefined}
        >
          <KeyboardLayout
            keyboard={keyboard}
            layer={layer}
            onKeySelect={() => {}}
            onEncoderSelect={() => {}}
            styleOverride="wireframe"
            colorOverride={HERO_LINE_COLOR}
          />
        </div>
      </div>
      <nav className={"relative z-20 flex w-full max-w-md items-start justify-center px-6 " + (exiting ? "pointer-events-none" : "")}>
        {HOME_NAV_ITEMS.map(({ kind, mode: itemMode, labelKey, beta }, index) => (
          <div
            key={kind}
            role="button"
            tabIndex={0}
            onClick={() => handleNavClick(itemMode)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleNavClick(itemMode);
              }
            }}
            className={
              "group relative flex h-[500px] w-14 cursor-pointer rotate-[-30deg] items-start justify-start " +
              (exitPhase === "items" ? "nav-item-exit" : "")
            }
            style={
              exitPhase === "items"
                ? ({
                    "--exit-delay": `${itemExitDelayMs(index)}ms`,
                    "--exit-dx": `${ITEM_EXIT_DX_PX[index % ITEM_EXIT_DX_PX.length]}px`,
                  } as CSSProperties)
                : undefined
            }
          >
            {/* Sized to the text/badge content (not the oversized 500px hover-room box above),
                so the reveal window below matches it exactly at rest. */}
            <div className="relative">
              {/* Reveal window: a fixed box reaching from 120px above the text (up toward the
                  hero keyboard strip) down to the text's own bottom edge — it never resizes
                  itself, it only clips. */}
              <div className="absolute inset-x-0 -top-[120px] bottom-0 overflow-hidden">
                {/* The actual black surface. Parked fully above the window at rest (hidden) and
                    slides straight down to fill it on hover, so the reveal reads as the
                    keyboard's own black sliding down over the item, rather than the item's
                    background growing outward from within itself. */}
                <div className="h-full w-full -translate-y-full bg-black transition-transform duration-300 ease-out group-hover:translate-y-0" />
              </div>
              <div className="relative z-10 flex flex-col items-start justify-start gap-2 px-2 py-4 text-brand-on-surface transition-colors duration-300 ease-out group-hover:text-white">
                <span className="text-5xl font-bold transition-transform duration-300 ease-out group-hover:scale-110 [writing-mode:vertical-rl] [text-orientation:sideways]">
                  {t(labelKey)}
                </span>
                <span
                  className={
                    "badge badge-xs badge-outline shrink-0 border-brand-primary/50 text-[0.625rem] font-semibold uppercase text-brand-primary " +
                    (beta ? "" : "invisible")
                  }
                >
                  Beta
                </span>
              </div>
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
