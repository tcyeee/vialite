import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { KeyboardLayout } from "../keymap/KeyboardLayout.tsx";
import { appearanceMetrics } from "../keymap/KeyboardLayoutPreview.tsx";
import { boardNaturalHeight } from "../keymap/autoFitSize.ts";
import { Keyboard } from "../../protocol/keyboard.ts";
import { NAV_ITEMS } from "./Sidebar.tsx";

type NavMode = (typeof NAV_ITEMS)[number]["mode"];

interface Props {
  keyboard: Keyboard;
  layer: number;
  onNavigate: (mode: NavMode) => void;
}

/** Height budget for the hero keyboard strip, as a fraction of the window height. */
const HERO_MAX_HEIGHT_RATIO = 0.35;

/** 米白色线稿颜色, forced via `colorOverride` regardless of the user's 键盘配色. */
const HERO_LINE_COLOR = "#f2ead8";

/** Hover background for every nav item — black, matching the hero strip's own `bg-black`, so the
 * reveal reads as the same surface rather than a colored highlight. Items are transparent at rest. */
const NAV_HOVER_BG = "group-hover:bg-black";

/**
 * NAV_ITEMS reversed, with the "新版首页" (this page itself) entry dropped — this strip is a
 * static showcase of the other nav destinations, not a full nav replica.
 */
const HOME_NAV_ITEMS = NAV_ITEMS.filter((item) => item.kind !== "newHome").reverse();

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
export function NewHomePage({ keyboard, layer, onNavigate }: Props) {
  const { t } = useI18n();
  const { size, spacing, keycapWidth, caseRadius, caseThickness } = usePreviewAppearance();
  const [windowHeight, setWindowHeight] = useState(() => window.innerHeight);
  const [exitPhase, setExitPhase] = useState<ExitPhase>("idle");
  const [exitTarget, setExitTarget] = useState<NavMode | null>(null);

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Drives the "items" → "hero" → onNavigate handoff on a plain timer rather than
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
          onNavigate(exitTarget);
        }
      }, HERO_EXIT_DURATION_MS);
      return () => window.clearTimeout(timer);
    }
  }, [exitPhase, exitTarget, onNavigate]);

  const handleNavClick = (itemMode: NavMode) => {
    if (exitPhase !== "idle") {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onNavigate(itemMode);
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

  return (
    <div className="flex h-screen flex-col items-center gap-10 overflow-hidden pb-16">
      <div
        className={"relative z-10 w-full overflow-x-auto overflow-y-hidden bg-black pb-[50px] " + (exitPhase === "hero" ? "hero-exit" : "")}
        style={clipped ? { height: maxHeight } : undefined}
      >
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
      <nav className={"flex w-full max-w-md items-start justify-center gap-8 px-6 " + (exiting ? "pointer-events-none" : "")}>
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
              "group relative flex h-[500px] w-14 cursor-pointer rotate-[-30deg] items-start justify-start transition-[width] duration-300 ease-out hover:w-[4.55rem] " +
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
                so the background layer below matches it exactly at rest. */}
            <div className="relative">
              {/* Background layer, pinned to the content's bottom edge (bottom-0 stays fixed via
                  inset-0). On hover only `top` moves negative, so the extra 100px grows upward —
                  back toward the keyboard preview above — rather than down into empty space,
                  reading as the menu item extending out from the keyboard. */}
              <div
                className={
                  "absolute inset-0 bg-transparent transition-all duration-300 ease-out group-hover:-top-[100px] " +
                  NAV_HOVER_BG
                }
              />
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
