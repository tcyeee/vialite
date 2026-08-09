/**
 * Run a DOM-mutating `update` inside a browser View Transition so layout changes (e.g. reordering
 * cards) animate automatically. Falls back to running `update` directly where the API is missing.
 *
 * `update` must apply its changes synchronously — pass `() => flushSync(() => setState(...))` when
 * driving it from React state, so the DOM is committed before the transition snapshots the result.
 */

/**
 * Shared `view-transition-name` for the keyboard hero morph — used both by
 * `StyleConfig.tsx`'s compact↔fullscreen preview toggle and by the
 * NewHomePage→个性化-page navigation animation (see `App.tsx`'s
 * `handlePersonalize`). Only one element in the document may carry this name
 * at any given moment; the two use sites never animate at the same time, so
 * sharing the constant (rather than each defining its own) is what keeps
 * them from silently drifting out of sync if one is renamed.
 */
export const KEYBOARD_HERO_NAME = "keyboard-hero";

/**
 * 键盘配置 ↔ 个性化 互切时,键盘预览*下方*那块配置区各自的
 * `view-transition-name`。刻意用两个不同的名字而不是共用一个:共用会让浏览器
 * 把两块区域配成同一个 image-pair 去插值形变,而这两块的高度差很大(配置区域
 * 一大片 vs 个性化的瀑布流设置),形变出来是拉伸变形的。分成「只在离场那侧存在
 * old」和「只在入场那侧存在 new」两个组之后,每组只有一张快照,各自跑各自的
 * 位移动画(见 index.css 里的 config-area-slide-out/in)。
 */
export const CONFIG_AREA_OUT_NAME = "config-area-out";
export const CONFIG_AREA_IN_NAME = "config-area-in";

/** 参与上面这段互切动画的两个页面。 */
export type ConfigSwapSide = "keymap" | "color";

/**
 * 某个页面此刻该给自己的配置区挂哪个名字。`from` 是本次导航*离开*的那个页面
 * (`usePageNavigation` 的 `configSwapFrom`),只在 键盘配置 ↔ 个性化 互切期间
 * 非 null——其余时间返回 undefined,两块区域照常留在 root 快照里,不影响主题
 * 涟漪、全屏预览等其它 View Transition。
 */
export function configSwapName(
  from: ConfigSwapSide | null,
  self: ConfigSwapSide,
): string | undefined {
  if (from === null) return undefined;
  return from === self ? CONFIG_AREA_OUT_NAME : CONFIG_AREA_IN_NAME;
}
/** A minimal handle over the browser transition; `finished` resolves once the animation ends. */
export interface ViewTransitionHandle {
  finished: Promise<void>;
}

export function startViewTransition(update: () => void): ViewTransitionHandle {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition === "function") {
    const transition = doc.startViewTransition(update);
    // Skipped/interrupted transitions reject `finished`; normalise to a resolve
    // so callers can always rely on it firing after the animation settles.
    return { finished: transition.finished.catch(() => undefined) };
  }
  update();
  return { finished: Promise.resolve() };
}
