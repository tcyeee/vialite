import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useI18n, type Lang } from "../../contexts/i18n.tsx";

// Cycled by the translate button below — fixed en → zh → ja → fr order.
const LANGS: Lang[] = ["en", "zh", "ja", "fr"];
const LANG_NATIVE_NAME: Record<Lang, string> = { en: "English", zh: "中文", ja: "日本語", fr: "Français" };
import { useTheme } from "../../contexts/theme.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { KeyboardLayoutEditor } from "../keymap/layout/KeyboardLayoutEditor.tsx";
import { PREVIEW_ZOOM } from "../keymap/layout/KeyboardLayoutPreview.tsx";
import { boardNaturalHeight, boardNaturalWidth } from "../keymap/layout/autoFitSize.ts";
import { KEYBOARD_HERO_NAME } from "../common/viewTransition.ts";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { NAV_ITEMS } from "./navItems.ts";

type PushablePageMode =
  | "matrix"
  | "macro"
  | "tapdance"
  | "combo"
  | "rgb"
  | "advanced"
  | "preview3d"
  | "siteConfig";

interface Props {
  keyboard: Keyboard;
  layer: number;
  productName?: string;
  onDisconnect: () => void;
  /** Navigates to a page with no shared hero element — the whole page slides up/out as one unit (see `data-page-anim` in index.css). Used by every menu entry except 键盘配置/个性化, which morph the hero keyboard instead. */
  onNavigatePush: (mode: PushablePageMode) => void;
  /** Opens the 键盘配置 page via a hero View Transition, same mechanism as `onPersonalize` below. */
  onGoToKeymap: (origin: Element) => void;
  /** Opens the 个性化 page via a hero View Transition; takes the clicked button so the morph has a concrete "from" element (mirrors `useFullscreenPreview`'s `origin` param). */
  onPersonalize: (origin: Element) => void;
  /** True for the brief window a "push" page transition (see `onNavigatePush`) is in flight — the hero card drops its `keyboard-hero` view-transition-name for that window so it isn't pulled into its own separately-animated group and instead slides along with the rest of the page. */
  suppressHeroName?: boolean;
}

/* 右侧竖排菜单的条目来源——直接取 navItems.ts 的 NAV_ITEMS,排除"个性化"
   (keyboardColor),它已有自己的入口(左侧的个性化按钮),不需要在这里重复一份;
   也排除"键盘测试"(matrixTest),测试入口已从右侧菜单里去掉。
   "网站信息"从 NAV_ITEMS 里直接去掉了,顶部导航栏的"网站配置"是它现在唯一的
   入口(见下方 SiteConfigPage)。点击条目跳转到共享页面壳层(只有右上角的
   CornerCloseButton,不再有 Navbar 或左侧边栏),用于返回本页,见 App.tsx。 */
const MENU_ITEMS = NAV_ITEMS.filter(({ kind }) => kind !== "keyboardColor" && kind !== "matrixTest");

/**
 * 线稿颜色,强制盖过用户的键盘配色,在线稿(默认)状态下保持统一的品牌观感,与
 * 应用的浅/深色主题无关。浅色卡片底(`#EAE6E6`)用深色线稿;深色底(`dark:bg-black`)
 * 换一个浅米白,否则深色线条在黑底上会看不见。
 */
const HERO_LINE_COLOR_LIGHT = "#1b1515";
const HERO_LINE_COLOR_DARK = "#f0e9e0";

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

/** 左侧键盘预览整体放大系数,叠加在按窗口高度算出的 heroZoom 之上。 */
const HERO_ZOOM_BOOST = 1.1;

export function NewHomePage({
  keyboard,
  layer,
  productName,
  onDisconnect,
  onNavigatePush,
  onGoToKeymap,
  onPersonalize,
  suppressHeroName,
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

  // 只按可视窗口的高度收缩键盘,宽度故意不参与——键盘可能非常宽,右侧对齐到
  // 固定位置就够了,左侧能露出多少不重要,但绝不能被硬裁切:超出窗口的部分
  // 单纯地探出到视口外面(靠下面 `windowNode` 不设 overflow-hidden,只由页面
  // 最外层容器 [162行] 的 overflow-hidden 在真实视口边缘兜底),而不是被这个
  // 内部窗口在版心中间裁出一道假边界。这样浏览器窗口放大到超过键盘自然宽度
  // 两倍时(windowNode 的 clamp 上限就是 cardWidth),键盘会完整落入窗口,一整
  // 块都能看到,不会有任何裁切。
  useEffect(() => {
    if (!windowNode) return;
    const measure = () => {
      const available = windowNode.clientHeight - HERO_PADDING_PX * 2;
      if (available <= 0 || !(naturalHeight > 0)) return;
      setHeroZoom(Math.min(available / naturalHeight, PREVIEW_ZOOM.l) * HERO_ZOOM_BOOST);
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
  // 窗口最多长到刚好露出整张卡片(不多不少,不会露出卡片右边的空白背景),也
  // 正是这个上限保证了"窗口够宽时键盘完整可见"。
  const cardWidth = naturalWidth * heroZoom + HERO_PADDING_PX * 2;
  const windowMinWidth = Math.min(HERO_WINDOW_MIN_PX, cardWidth);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#EAE6E6] text-black dark:bg-black dark:text-white">
      <nav className="flex items-center justify-between px-10 py-4 md:px-14">
        <span className="text-[1.95rem] font-extrabold tracking-tight">Vialite</span>
        <div className="flex items-center gap-3 text-[15px] font-medium text-black/90 dark:text-white/90">
          <button
            type="button"
            className="inline-block text-center transition-colors hover:text-brand-secondary"
            style={{ width: 78 }}
            onClick={() => onNavigatePush("siteConfig")}
          >
            {t("navSiteInfo")}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline min-w-[7.25rem] rounded-full border-black/40 text-black hover:border-black hover:bg-black hover:text-white dark:border-white/40 dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
            onClick={() => setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length])}
            title={t("toggleLanguage")}
          >
            <Icon icon="mdi:translate" className="h-4 w-4" />
            {LANG_NATIVE_NAME[lang]}
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
              onChange={(e) =>
                // The raw checkbox sits at the swap grid cell's top-left corner
                // (daisyUI's .swap doesn't stretch it to match the visible
                // pill), so its own rect is off-center from what the user
                // actually sees as "the button" — use the enclosing <label>
                // (the real pill) as the ripple's origin instead.
                setTheme(e.target.checked ? "dark" : "light", e.currentTarget.closest("label"))
              }
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

      <main className=" ">
        {/* 左侧键盘 : 右侧菜单 = 2:3 的宽度比,靠 grid-cols-[2fr_3fr] 分配轨道宽度,
            两栏各自 justify-self 贴向中间的 gap,视觉上还是紧挨着的一对。宽度不够
            (< lg)时退化成单列纵向堆叠,菜单顺着 DOM 顺序自然掉到键盘下方。 */}
        <div className="grid w-full grid-cols-1 items-center justify-items-center gap-10 lg:grid-cols-[2fr_3fr] lg:gap-[6rem]">
          {/* -translate-y-20 moved here (off the box itself) so it shifts the
              box together with the name/disconnect row and the personalize
              button below it, keeping them visually attached to the box
              regardless of the transform. */}
          <div className="flex -translate-y-2 flex-col items-start gap-3 lg:justify-self-end">
            {/* 可视窗口:固定/响应式尺寸,只负责右对齐卡片,自身没有背景、也不
                裁切(没有 overflow-hidden)——卡片比窗口宽时单纯地向左探出窗口
                之外,真正的裁切边界是页面最外层容器(162 行)的 overflow-hidden,
                也就是浏览器视口的实际边缘,不是这里画出来的一道假边界。宽度用
                clamp 随视口变宽,上限是 cardWidth,所以宽屏下窗口最多刚好长到
                完整包住整张卡片——这也是"窗口够宽时键盘完整可见"的来源。 */}
            <div
              ref={(node) => {
                setWindowNode(node);
                windowElRef.current = node;
              }}
              className="relative flex h-[clamp(188px,40vw,300px)] shrink-0 items-center justify-end"
              style={{ width: `clamp(${windowMinWidth}px, 32vw, ${cardWidth}px)` }}
            >
              {/* 卡片:键盘 + 四边等距 padding + 背景,尺寸完全由内容撑开(不强
                  制和窗口同长宽比),多出窗口的部分自然探出左边,靠外层容器的
                  overflow-hidden 在视口边缘兜底,而不是被这个窗口本身裁掉。 */}
              {/* Named by default (not just while morphing into 个性化/键盘配置) so
                  the browser pulls this subtree out of the root snapshot on
                  *every* view transition, including the theme-reveal ripple —
                  snapshotting the full interactive KeyboardLayoutEditor as part
                  of the whole-page capture was what made the ripple stutter
                  partway through. Harmless when no transition is running, since
                  view-transition-name only matters at capture time. See the
                  `::view-transition-old/new(keyboard-hero)` override in
                  index.css that makes this box swap instantly under
                  `data-theme-anim="reveal"` instead of doing the default fade.
                  The one exception is `suppressHeroName`: while a "push" page
                  transition (网站信息 and the rest of the menu) is in flight
                  this card has no counterpart to morph into, so it drops the
                  name and rides along with the rest of the page instead of
                  getting extracted into its own separately-animated group —
                  see App.tsx's `heroNameSuppressed`. */}
              <div
                ref={cardRef}
                className="flex shrink-0 items-center justify-center transition-transform duration-150 ease-out"
                style={{
                  padding: HERO_PADDING_PX,
                  viewTransitionName: suppressHeroName ? undefined : KEYBOARD_HERO_NAME,
                }}
                onMouseEnter={() => setHeroHovered(true)}
                onMouseLeave={() => setHeroHovered(false)}
              >
                {/* 线稿 <-> 浮雕不是同一份 DOM 换一个 class(底色/边框/box-shadow
                    的图层数量两边对不上,CSS 没法逐属性插值),索性叠两份互斥
                    渲染的键盘各自淡入淡出,用透明度过渡冒充"渐变动画"——对齐
                    靠两者共享同一个 zoomOverride/layer,几何完全一致。 */}
                <div className="pointer-events-none relative">
                  <div
                    className="transition-opacity duration-300 ease-out"
                    style={{ opacity: heroHovered ? 0 : 1 }}
                  >
                    <KeyboardLayoutEditor
                      keyboard={keyboard}
                      layer={layer}
                      onKeySelect={() => {}}
                      onEncoderSelect={() => {}}
                      zoomOverride={heroZoom}
                      styleOverride="wireframe"
                      colorOverride={theme === "dark" ? HERO_LINE_COLOR_DARK : HERO_LINE_COLOR_LIGHT}
                    />
                  </div>
                  <div
                    className="absolute inset-0 transition-opacity duration-300 ease-out"
                    style={{ opacity: heroHovered ? 1 : 0 }}
                  >
                    <KeyboardLayoutEditor
                      keyboard={keyboard}
                      layer={layer}
                      onKeySelect={() => {}}
                      onEncoderSelect={() => {}}
                      zoomOverride={heroZoom}
                      styleOverride="relief"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Keyboard name + hover-reveal red disconnect button: breathing
                status dot, slide-in-from-the-right red circle button on
                group-hover. */}
            <div className="group flex h-9 items-center gap-2 pl-10">
              <span className="h-2 w-2 shrink-0 rounded-full bg-status-online animate-status-breathe" />
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

            <div className="mt-6 flex items-center gap-2 pl-10">
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
              {/* 键盘测试入口 — push transition (no hero morph, MatrixTester has
                  no board of its own to morph from). Only shown when the
                  connected board actually exposes the matrix tester. */}
              {keyboard.supportsMatrixTester && (
                <button
                  type="button"
                  onClick={() => onNavigatePush("matrix")}
                  className="btn btn-sm btn-outline gap-2 rounded-full border-black/40 text-black hover:border-black hover:bg-black hover:text-white dark:border-white/40 dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
                >
                  <Icon icon="mdi:view-grid-outline" className="h-4 w-4" />
                  {t("navMatrixTest")}
                </button>
              )}
            </div>
          </div>

          <nav className="z-10 flex flex-col items-start gap-5 lg:justify-self-start">
            {MENU_ITEMS.map(({ kind, mode: itemMode, labelKey, beta }) => (
              // 悬浮"右移"效果不能靠改变 button 自身的 box(不管是 translate-x
              // 还是 padding-left):只要触发 hover 的那个 box 在任何一条边上
              // 发生位移或改变大小,鼠标停在那条边上就会撞见"进入→box 让开→
              // 退出 hover→box 复位→又盖住鼠标→再次进入"的死循环,抖动闪烁——
              // 之前只处理了左边缘(padding 只让右边变宽),但上下边缘一样会踩坑
              // (line-height 留出的空白区域仍属于同一个 box)。这里把 button
              // 本身的 box 固定成 hover 前后完全不变的大小(pl-8 是常量,不参与
              // 过渡),真正做位移动画的是内层这个 span——transform 不影响父级
              // 用来判定 hover 的 box 尺寸,所以不管鼠标停在这个固定 box 的哪条
              // 边上,都不会再被自己的悬浮效果顶出去。
              <button
                key={kind}
                type="button"
                onClick={(e) =>
                  // "键盘配置" (kind "home") morphs the hero keyboard like
                  // 个性化 does; every other entry gets the push-slide instead.
                  kind === "home"
                    ? onGoToKeymap(e.currentTarget)
                    : onNavigatePush(itemMode as PushablePageMode)
                }
                className="group whitespace-nowrap border-none bg-transparent pl-8 text-5xl font-bold text-black/50 transition-colors duration-300 ease-out hover:text-brand-secondary dark:text-white/50"
              >
                <span className="flex -translate-x-8 items-center gap-2 transition-transform duration-300 ease-out group-hover:translate-x-0">
                  {t(labelKey)}
                  {beta && (
                    <span className="badge badge-xs badge-outline shrink-0 border-black/30 text-[0.625rem] font-semibold uppercase text-black/40 transition-colors duration-300 ease-out group-hover:border-brand-secondary/50 group-hover:text-brand-secondary dark:border-white/30 dark:text-white/40">
                      Beta
                    </span>
                  )}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}
