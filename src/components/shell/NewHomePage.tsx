import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useTheme } from "../../contexts/theme.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { KeyboardLayout } from "../keymap/KeyboardLayout.tsx";
import { PREVIEW_ZOOM } from "../keymap/KeyboardLayoutPreview.tsx";
import { boardNaturalHeight, boardNaturalWidth } from "../keymap/autoFitSize.ts";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { NAV_ITEMS } from "./Sidebar.tsx";

interface Props {
  keyboard: Keyboard;
  layer: number;
  onNavigate: (mode: "keymap") => void;
}

/* 复刻旧版首页(重置前的原型,见 git ce62e25..f1ed67e)右侧竖排菜单的条目来源——
   直接取 Sidebar 的 NAV_ITEMS,排除"新版首页"自身。暂未接入点击,仅做视觉展示,
   悬浮时变色并左移,为后续接入真实导航预留交互形态。 */
const MENU_ITEMS = NAV_ITEMS.filter((item) => item.kind !== "newHome");

/** 米白色线稿颜色,强制盖过用户的键盘配色,让预览在红方块背景上保持可读对比度。 */
const HERO_LINE_COLOR = "#f2ead8";

/** 红方块内边距(px),预览键盘的可用尺寸要在此基础上收缩,避免贴边。 */
const HERO_PADDING_PX = 24;

export function NewHomePage({ keyboard, layer, onNavigate }: Props) {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { spacing, keycapWidth, caseThickness } = usePreviewAppearance();
  const [boxNode, setBoxNode] = useState<HTMLDivElement | null>(null);
  const [heroZoom, setHeroZoom] = useState(PREVIEW_ZOOM.l);

  // 红方块的长宽比要和键盘实际长宽比一致(不是固定的 1.38),否则右侧裁切窗口
  // 会漏出跟键盘形状不匹配的留白/溢出。
  const naturalWidth = boardNaturalWidth(keyboard, spacing, keycapWidth, caseThickness);
  const naturalHeight = boardNaturalHeight(keyboard, spacing, keycapWidth, caseThickness);
  const heroAspectRatio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1.38;

  // 红方块尺寸由 CSS(aspect-ratio + clamp 高度)决定,不是由键盘反推,所以缩放要
  // 反过来:用 ResizeObserver 量方块可用宽高,算出让整块键盘(含外壳)完整落入
  // 方块、且不超过原始 1× 尺寸的 zoom——与 useAutoFitZoom 只按宽度收缩不同,这里
  // 宽高都要收缩,否则窄而矮的红方块会让键盘纵向溢出。
  useEffect(() => {
    if (!boxNode) return;
    const measure = () => {
      const w = boxNode.clientWidth - HERO_PADDING_PX * 2;
      const h = boxNode.clientHeight - HERO_PADDING_PX * 2;
      if (w <= 0 || h <= 0 || !(naturalWidth > 0) || !(naturalHeight > 0)) return;
      setHeroZoom(Math.min(w / naturalWidth, h / naturalHeight, PREVIEW_ZOOM.l));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(boxNode);
    return () => observer.disconnect();
  }, [boxNode, naturalWidth, naturalHeight]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-white text-black dark:bg-black dark:text-white">
      <nav className="flex items-center justify-between px-10 py-8 md:px-14">
        <span className="text-[1.95rem] font-extrabold tracking-tight">Vialite</span>
        <div className="flex items-center gap-3 text-[15px] font-medium text-black/90 dark:text-white/90">
          <span className="inline-block text-center" style={{ width: 78 }}>
            网站配置
          </span>
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
              onChange={(e) => setTheme(e.target.checked ? "dark" : "light", e.currentTarget.closest("label"))}
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

      <main className="relative flex-1 px-10 md:px-14">
        <div className="mt-[max(20vh,100px)] flex items-center gap-[7.5rem]">
          {/* 裁切窗口:固定露出 500px 宽,内部红方块(长宽比随键盘变化,通常比
              500px 宽得多)靠右对齐,超出左边界的部分被这层 overflow-hidden 裁掉,
              效果类似图片向左侧溢出屏幕、只在页面上留出右侧 500px。 */}
          <div className="relative flex h-[clamp(188px,24.638vw,304px)] w-[500px] shrink-0 items-center justify-end overflow-hidden rounded-md">
            <div
              ref={setBoxNode}
              className="relative flex h-full shrink-0 items-center justify-center bg-[#e2231b]"
              style={{ aspectRatio: heroAspectRatio }}
            >
              <div className="pointer-events-none">
                <KeyboardLayout
                  keyboard={keyboard}
                  layer={layer}
                  onKeySelect={() => {}}
                  onEncoderSelect={() => {}}
                  zoomOverride={heroZoom}
                  styleOverride="wireframe"
                  colorOverride={HERO_LINE_COLOR}
                />
              </div>
            </div>
          </div>

          <nav className="z-10 flex flex-col items-start gap-5">
            {MENU_ITEMS.map(({ kind, labelKey, beta }) => (
              <div
                key={kind}
                className="group flex cursor-default items-center gap-2 whitespace-nowrap text-4xl font-semibold text-black/50 transition-all duration-300 ease-out hover:translate-x-2 hover:text-[#e2231b] dark:text-white/50"
              >
                {t(labelKey)}
                {beta && (
                  <span className="badge badge-xs badge-outline shrink-0 border-black/30 text-[0.625rem] font-semibold uppercase text-black/40 transition-colors duration-300 ease-out group-hover:border-[#e2231b]/50 group-hover:text-[#e2231b] dark:border-white/30 dark:text-white/40">
                    Beta
                  </span>
                )}
              </div>
            ))}
          </nav>
        </div>
      </main>

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
