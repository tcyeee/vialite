import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useTheme } from "../../contexts/theme.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { KeyboardLayoutEditor } from "../keymap/KeyboardLayoutEditor.tsx";
import { PREVIEW_ZOOM } from "../keymap/KeyboardLayoutPreview.tsx";
import { boardNaturalHeight, boardNaturalWidth } from "../keymap/autoFitSize.ts";
import { KEYBOARD_HERO_NAME } from "../common/viewTransition.ts";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { NAV_ITEMS } from "./navItems.ts";

interface Props {
  keyboard: Keyboard;
  layer: number;
  productName?: string;
  onDisconnect: () => void;
  onNavigate: (
    mode:
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
      | "siteConfig",
  ) => void;
  /** Opens the 个性化 page via a hero View Transition; takes the clicked button so the morph has a concrete "from" element (mirrors `useFullscreenPreview`'s `origin` param). */
  onPersonalize: (origin: Element) => void;
}

/* 右侧竖排菜单的条目来源——直接取 navItems.ts 的 NAV_ITEMS,排除"个性化"
   (keyboardColor),它已有自己的入口(左侧的个性化按钮),不需要在这里重复一份。
   "网站信息"从 NAV_ITEMS 里直接去掉了,顶部导航栏的"网站配置"是它现在唯一的
   入口(见下方 SiteConfigPage)。点击条目跳转到共享页面壳层(只有右上角的
   CornerCloseButton,不再有 Navbar 或左侧边栏),用于返回本页,见 App.tsx。 */
const MENU_ITEMS = NAV_ITEMS.filter(({ kind }) => kind !== "keyboardColor");

/** 米白色线稿颜色,强制盖过用户的键盘配色,在线稿(默认)状态下保持统一的品牌观感。 */
const HERO_LINE_COLOR = "#f2ead8";

/** 3D 跟随倾斜的感应半径(px)——鼠标离卡片中心超过这个距离就恢复水平。 */
const TILT_RADIUS_PX = 260;
/** 倾斜角度上限(deg),感应半径内侧按距离线性插值到这个最大值。 */
const TILT_MAX_DEG = 6;

/**
 * 卡片四边的真实 CSS padding(px)。键盘卡片就是"键盘 + 这圈 padding + 背景",
 * 四边天然相等,不需要靠长宽比匹配或按比例收缩来凑。
 */
const HERO_PADDING_PX = 32;

/** 可视窗口宽度下限(px)——窄屏下至少露出这么多,即便算出来的卡片本身更窄。 */
const HERO_WINDOW_MIN_PX = 400;

export function NewHomePage({
  keyboard,
  layer,
  productName,
  onDisconnect,
  onNavigate,
  onPersonalize,
}: Props) {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { spacing, keycapWidth, caseThickness } = usePreviewAppearance();
  const [windowNode, setWindowNode] = useState<HTMLDivElement | null>(null);
  const [heroZoom, setHeroZoom] = useState(PREVIEW_ZOOM.l);
  // 悬浮键盘预览:线稿(默认) <-> 浮雕(hover),直接复用 PreviewStyle 枚举,
  // 交给 KeyboardLayoutEditor 自己处理外观切换,这里只负责触发。
  const [heroHovered, setHeroHovered] = useState(false);
  // 卡片跟随鼠标做 3D 倾斜,走 ref 直接改 style,避免 mousemove 高频触发 React
  // 重渲染(卡片下面挂着整块可交互的 KeyboardLayoutEditor,重渲染成本不低)。
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Mirrors `windowNode` as a ref (imperative reads inside the mousemove
  // handler shouldn't depend on React state) — the *window*'s box, not the
  // card's, is what "distance to the preview" should be measured against:
  // the card itself intentionally bleeds off-screen to the left (only its
  // right slice shows through the clipped window), so its own DOM center sits
  // well outside what's visually perceived as "the card".
  const windowElRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const tiltFrameRef = useRef<number | null>(null);

  const naturalWidth = boardNaturalWidth(keyboard, spacing, keycapWidth, caseThickness);
  const naturalHeight = boardNaturalHeight(keyboard, spacing, keycapWidth, caseThickness);

  // 只按可视窗口的高度收缩键盘,宽度故意不参与——卡片本来就设计成比窗口宽,
  // 多出来的部分本该探到窗口外面去(左侧裁切出"半张卡片"的效果),不是需要
  // 塞进窗口的溢出。窗口宽度反而是由下面的 cardWidth 反过来决定的。
  useEffect(() => {
    if (!windowNode) return;
    const measure = () => {
      const available = windowNode.clientHeight - HERO_PADDING_PX * 2;
      if (available <= 0 || !(naturalHeight > 0)) return;
      setHeroZoom(Math.min(available / naturalHeight, PREVIEW_ZOOM.l));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(windowNode);
    return () => observer.disconnect();
  }, [windowNode, naturalHeight]);

  // 鼠标距卡片够近时,卡片朝鼠标方向做轻微 3D 倾斜(漂浮跟随感);超出感应半径
  // 恢复水平。全局监听 mousemove(而不是只在卡片自身),这样"靠近"本身就能
  // 触发效果,不需要先移到卡片上方。
  useEffect(() => {
    const applyTilt = () => {
      tiltFrameRef.current = null;
      const card = cardRef.current;
      const referenceEl = windowElRef.current;
      const pointer = pointerRef.current;
      if (!card || !referenceEl || !pointer) return;
      const rect = referenceEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = pointer.x - centerX;
      const dy = pointer.y - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance > TILT_RADIUS_PX) {
        card.style.transform = "";
        return;
      }
      const influence = 1 - distance / TILT_RADIUS_PX;
      const rotateY = (dx / TILT_RADIUS_PX) * TILT_MAX_DEG * influence;
      const rotateX = (-dy / TILT_RADIUS_PX) * TILT_MAX_DEG * influence;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };
    const handleMouseMove = (e: MouseEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      if (tiltFrameRef.current == null) {
        tiltFrameRef.current = requestAnimationFrame(applyTilt);
      }
    };
    const resetTilt = () => {
      pointerRef.current = null;
      if (cardRef.current) cardRef.current.style.transform = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", resetTilt);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", resetTilt);
      if (tiltFrameRef.current != null) cancelAnimationFrame(tiltFrameRef.current);
    };
  }, []);

  // 卡片的真实总宽度(键盘 + 四边 padding)。窗口宽度用它当上限,这样宽屏下
  // 窗口最多长到刚好露出整张卡片,不会露出卡片右边的空白背景。
  const cardWidth = naturalWidth * heroZoom + HERO_PADDING_PX * 2;
  const windowMinWidth = Math.min(HERO_WINDOW_MIN_PX, cardWidth);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-white text-black dark:bg-black dark:text-white">
      <nav className="flex items-center justify-between px-10 py-8 md:px-14">
        <span className="text-[1.95rem] font-extrabold tracking-tight">Vialite</span>
        <div className="flex items-center gap-3 text-[15px] font-medium text-black/90 dark:text-white/90">
          <button
            type="button"
            className="inline-block text-center transition-colors hover:text-[#e2231b]"
            style={{ width: 78 }}
            onClick={() => onNavigate("siteConfig")}
          >
            网站配置
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline rounded-full border-black/40 text-black hover:border-black hover:bg-black hover:text-white dark:border-white/40 dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
            style={{ width: 116 }}
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            title={t("toggleLanguage")}
          >
            <Icon icon="mdi:translate" className="h-4 w-4" />
            {lang === "zh" ? "中文" : "English"}
          </button>
          <label
            className="btn btn-sm btn-outline swap swap-rotate rounded-full border-black/40 text-black hover:border-black hover:bg-black hover:text-white dark:border-white/40 dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
            style={{ width: 116 }}
            title={t("toggleTheme")}
          >
            <input
              type="checkbox"
              className="theme-controller"
              checked={theme === "dark"}
              onChange={(e) => setTheme(e.target.checked ? "dark" : "light", e.currentTarget)}
              aria-label={t("toggleTheme")}
            />
            <span className="swap-off inline-flex items-center gap-2">
              <Icon icon="mdi:white-balance-sunny" className="h-4 w-4" />
              {t("themeLight")}
            </span>
            <span className="swap-on inline-flex items-center gap-2">
              <Icon icon="mdi:weather-night" className="h-4 w-4" />
              {t("themeDark")}
            </span>
          </label>
        </div>
      </nav>

      <main className="relative flex-1">
        <div className="mt-[20px] flex items-start gap-[10rem]">
          {/* -translate-y-20 moved here (off the box itself) so it shifts the
              box together with the name/disconnect row and the personalize
              button below it, keeping them visually attached to the box
              regardless of the transform. */}
          <div className="flex -translate-y-2 flex-col items-start gap-3">
            {/* 可视窗口:固定/响应式尺寸,只负责裁切 + 右对齐卡片,自身没有背景。
                宽度用 clamp 随视口变宽,上限是 cardWidth,所以宽屏最多刚好露出
                整张卡片,不会露出卡片之外的空白。 */}
            <div
              ref={(node) => {
                setWindowNode(node);
                windowElRef.current = node;
              }}
              className="relative flex h-[clamp(188px,40vw,300px)] shrink-0 items-center justify-end overflow-hidden rounded-r-3xl"
              style={{ width: `clamp(${windowMinWidth}px, 32vw, ${cardWidth}px)` }}
            >
              {/* 卡片:键盘 + 四边等距 padding + 背景,尺寸完全由内容撑开(不强
                  制和窗口同长宽比),多出窗口的部分自然探出左边,被上面的
                  overflow-hidden 裁掉。 */}
              {/* Always named (not just while morphing into 个性化) so the browser
                  pulls this subtree out of the root snapshot on *every* view
                  transition, including the theme-reveal ripple — snapshotting the
                  full interactive KeyboardLayoutEditor as part of the whole-page capture
                  was what made the ripple stutter partway through. Harmless when no
                  transition is running, since view-transition-name only matters at
                  capture time. See the `::view-transition-old/new(keyboard-hero)`
                  override in index.css that makes this box swap instantly under
                  `data-theme-anim="reveal"` instead of doing the default fade. */}
              <div
                ref={cardRef}
                className="flex shrink-0 items-center justify-center transition-transform duration-150 ease-out"
                style={{
                  padding: HERO_PADDING_PX,
                  viewTransitionName: KEYBOARD_HERO_NAME,
                }}
                onMouseEnter={() => setHeroHovered(true)}
                onMouseLeave={() => setHeroHovered(false)}
              >
                <div className="pointer-events-none">
                  <KeyboardLayoutEditor
                    keyboard={keyboard}
                    layer={layer}
                    onKeySelect={() => {}}
                    onEncoderSelect={() => {}}
                    zoomOverride={heroZoom}
                    styleOverride={heroHovered ? "relief" : "wireframe"}
                    colorOverride={heroHovered ? undefined : HERO_LINE_COLOR}
                  />
                </div>
              </div>
            </div>

            {/* Keyboard name + hover-reveal red disconnect button: breathing
                status dot, slide-in-from-the-right red circle button on
                group-hover. */}
            <div className="group flex h-9 items-center gap-2 pl-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-brand-secondary animate-status-breathe" />
              <span className="min-w-0 truncate text-sm font-medium uppercase text-black/70 dark:text-white/70">
                {productName ?? t("disconnect")}
              </span>
              <button
                type="button"
                onClick={onDisconnect}
                aria-label={t("disconnect")}
                className="flex h-7 w-7 shrink-0 translate-x-2 items-center justify-center rounded-full border-none bg-red-600 text-white opacity-0 shadow-sm transition-all duration-200 hover:bg-red-700 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
              >
                <Icon icon="mdi:power" className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="ml-2 mt-6 flex items-center gap-2">
              {/* Personalize entry point — hands the browser View Transition its
                  "from" element via currentTarget, morphing this box into the
                  个性化 page's board (see App.tsx's handlePersonalize). */}
              <button
                type="button"
                onClick={(e) => onPersonalize(e.currentTarget)}
                className="btn btn-sm btn-outline gap-2 rounded-full border-black/40 text-black hover:border-black hover:bg-black hover:text-white dark:border-white/40 dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
              >
                <Icon icon="mdi:palette-outline" className="h-4 w-4" />
                {t("navKeyboardColor")}
              </button>
              {/* 键盘测试入口 — plain mode switch (no hero transition, MatrixTester
                  has no board of its own to morph from). Only shown when the
                  connected board actually exposes the matrix tester. */}
              {keyboard.supportsMatrixTester && (
                <button
                  type="button"
                  onClick={() => onNavigate("matrix")}
                  className="btn btn-sm btn-outline gap-2 rounded-full border-black/40 text-black hover:border-black hover:bg-black hover:text-white dark:border-white/40 dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
                >
                  <Icon icon="mdi:view-grid-outline" className="h-4 w-4" />
                  {t("navMatrixTest")}
                </button>
              )}
            </div>
          </div>

          <nav className="z-10 flex flex-col items-start gap-5">
            {/* matrixTest mirrors the dedicated 键盘测试入口 button above: only
                clickable when the connected board actually exposes it, instead
                of navigating into a blank page. */}
            {MENU_ITEMS.map(({ kind, mode: itemMode, labelKey, beta }) => {
              const supported = kind !== "matrixTest" || keyboard.supportsMatrixTester;
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={!supported}
                  onClick={() => onNavigate(itemMode)}
                  title={supported ? undefined : t("comingSoon")}
                  className={
                    "group flex items-center gap-2 whitespace-nowrap border-none bg-transparent text-4xl font-semibold transition-all duration-300 ease-out " +
                    (supported
                      ? "text-black/50 hover:translate-x-2 hover:text-[#e2231b] dark:text-white/50"
                      : "cursor-default text-black/25 dark:text-white/25")
                  }
                >
                  {t(labelKey)}
                  {beta && (
                    <span className="badge badge-xs badge-outline shrink-0 border-black/30 text-[0.625rem] font-semibold uppercase text-black/40 transition-colors duration-300 ease-out group-hover:border-[#e2231b]/50 group-hover:text-[#e2231b] dark:border-white/30 dark:text-white/40">
                      Beta
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </main>

      {/* Exits to the keymap-editing page (shared page shell in App.tsx: just
          CornerCloseButton, no left sidebar). */}
      <button
        type="button"
        onClick={() => onNavigate("keymap")}
        aria-label={t("navExitNewHome")}
        className="fixed bottom-6 left-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-black/10 text-brand-on-surface-variant backdrop-blur transition hover:bg-red-500/20 hover:text-red-500 dark:bg-white/10"
      >
        <Icon icon="mdi:close" className="h-6 w-6" />
      </button>
    </div>
  );
}
