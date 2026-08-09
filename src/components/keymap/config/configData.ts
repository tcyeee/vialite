// Static category data and pure derivations for the 配置区域 (ConfigPanel) — no
// component state, no JSX. Kept apart so the panel's render logic isn't buried
// under catalogue bookkeeping.

import { KEYCODE_CATEGORIES, type KeycodeDef } from "../../../protocol/keycodes.ts";
import type { MessageKey } from "../../../contexts/i18n.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { LAYER_GROUPS, QUANTUM_GROUPS } from "../picker/keycodeMeta.ts";

export const entriesOf = (name: string): KeycodeDef[] =>
  KEYCODE_CATEGORIES.find((c) => c.name === name)?.entries ?? [];

/** Editor pages the 宏 / Tap Dance / 组合 页 can jump to via their "编辑" action. */
export type ComboEditTarget = "macro" | "tapdance" | "combo";

/**
 * Used/total slot counts and the "编辑" jump target for one slot-based page,
 * keyed off its heading (Macros vs Tap Dance).
 */
export function comboMeta(
  keyboard: Keyboard,
  titleKey: MessageKey,
  onNavigate: (target: ComboEditTarget) => void,
): { used: number; total: number; onEdit: () => void; configured: boolean[] } {
  if (titleKey === "groupTapDance") {
    const configured = keyboard.tapDanceEntries.map(
      (e) =>
        e.onTap !== "KC_NO" ||
        e.onHold !== "KC_NO" ||
        e.onDoubleTap !== "KC_NO" ||
        e.onTapHold !== "KC_NO",
    );
    return {
      used: configured.filter(Boolean).length,
      total: keyboard.tapDanceCount,
      onEdit: () => onNavigate("tapdance"),
      configured,
    };
  }
  const configured = keyboard.macros.map((m) => m.length > 0);
  return {
    used: configured.filter(Boolean).length,
    total: keyboard.macroCount,
    onEdit: () => onNavigate("macro"),
    configured,
  };
}

/**
 * 「其他」页的键码:One-Shot Mods、没归进任何 Quantum 分组的杂项 Quantum 键码,以及
 * 两个不属于任何层分组的层功能键(FN_MO13/FN_MO23)。Quantum 这个大类本身不出页面,
 * 靠这张扁平表把这些键码留在可达范围内。
 */
export const OTHER_CARD_ENTRIES: KeycodeDef[] = (() => {
  const quantum = entriesOf("Quantum");
  const osm = QUANTUM_GROUPS.find((g) => g.key === "osm")!;
  const osmEntries = quantum.filter((e) => osm.match(e.qmkId));
  const misc = quantum.filter((e) => !QUANTUM_GROUPS.some((g) => g.match(e.qmkId)));
  const layerOther = entriesOf("Layers").filter((e) => !LAYER_GROUPS.some((g) => g.match(e.qmkId)));
  return [...osmEntries, ...misc, ...layerOther];
})();

/**
 * The three 按键叠加 categories, one card each — they differ in *when* the extra
 * role fires and *what* that role is:
 *  - "tapMod": 单击就连修饰键一起发出(fire-together / masked modifier)。
 *  - "holdMod": 轻触发基础键、长按当修饰键(Mod-Tap)。
 *  - "holdLayer": 轻触发基础键、长按切层(Layer-Tap)。
 */
export type MultiFuncMode = "tapMod" | "holdMod" | "holdLayer";

/** 三张卡片的排列顺序(= ConfigPanel 里从左到右)。 */
export const MULTI_FUNC_MODES: MultiFuncMode[] = ["tapMod", "holdMod", "holdLayer"];

/**
 * The "framework" template written to the selected key the moment a 按键叠加
 * card is clicked, base slot left as `KC_NO`. The actual write (see
 * `MultiFunctionBody`'s onClick) fills that base with the selected cap's
 * *current* keycode when it's a basic (8-bit) keycode — i.e. it overlays the
 * modifier/layer role onto what's already there — and falls back to this empty
 * `KC_NO` base (clear-then-overlay) whenever the current keycode isn't basic
 * (already composite, or nothing selected):
 *  - tapMod: 左Ctrl+左Alt masked onto the base (`LCA(kc)`).
 *  - holdMod: Mod-Tap holding 左Ctrl+左Alt with the base as tap (`LCA_T(kc)`).
 *  - holdLayer: Layer-Tap holding layer 0 with the base as tap (`LT(0,kc)`).
 *
 * 修饰键组合 / 目标层都是先落一个默认值(LCA / 层 0),写进去之后再由键盘上那颗键的
 * 「长按」半区打开 `DualRoleEditor` 细调 —— 这里只负责把框架搭起来。
 */
export const MULTI_FUNC_FRAMEWORK: Record<MultiFuncMode, string> = {
  tapMod: "LCA(KC_NO)",
  holdMod: "LCA_T(KC_NO)",
  holdLayer: "LT(0,KC_NO)",
};

/**
 * 每张叠加卡片的标题、标题图标和卡面底色。两张修饰键卡用同一族紫色,层那张沿用
 * 「层按键」页的蓝色,颜色本身就把「叠加的是修饰键还是层」说清楚。
 */
export const MULTI_FUNC_CARD: Record<
  MultiFuncMode,
  { titleKey: MessageKey; icon: string; bg: string }
> = {
  tapMod: { titleKey: "multiFuncTapMod", icon: "mdi:apple-keyboard-command", bg: "#5C5470" },
  holdMod: { titleKey: "multiFuncHoldMod", icon: "mdi:gesture-tap-hold", bg: "#6B5578" },
  holdLayer: { titleKey: "multiFuncHoldLayer", icon: "mdi:layers-outline", bg: "#3E5C6E" },
};
