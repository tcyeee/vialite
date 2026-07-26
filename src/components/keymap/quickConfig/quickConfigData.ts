// Static tab/category data and pure derivations for QuickConfigPanel — no
// component state, no JSX. Extracted so the panel's render logic isn't buried
// under catalogue bookkeeping.

import { KEYCODE_CATEGORIES, type KeycodeDef } from "../../../protocol/keycodes.ts";
import type { MessageKey } from "../../../contexts/i18n.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { LAYER_GROUPS, QUANTUM_GROUPS } from "../picker/keycodeMeta.ts";

/** Categories hidden from the inline homepage picker. Quantum is not a tab of its
 *  own: it's folded into the Combo Keys tab as a labelled section (below). */
const HIDDEN_CATEGORIES: ReadonlySet<string> = new Set([
  "ISO/International",
  "Navigation",
  "Shifted",
  "Numpad",
  "Quantum",
]);

/** Source categories folded into the Basic tab as the vertical Fn/Media/Mouse cards. */
const MERGE_SOURCES: ReadonlySet<string> = new Set(["Fn keys", "Media", "Mouse"]);

/** Name of the tab that folds Lighting and the device's Custom keycodes into one. */
export const KEYBOARD_FN_NAME = "Keyboard Function";

/**
 * Marks a subtree that stays interactive while the panel is disabled (no key
 * selected). App.tsx's activation-event trap skips anything inside it. Used by the
 * 配置设置 block: 自动选取下一个 / 预览样式 are panel-level settings, unrelated to
 * whether a key is currently selected.
 */
export const ALWAYS_ENABLED_ATTR = "data-quickconfig-always-enabled";

/** A labelled block of keycodes rendered within a tab. */
export interface KeycodeGroup {
  /** Translation key for the group heading; omit for an unlabelled block. */
  titleKey?: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
  /** Render the entries in a fixed 4-column grid rather than a flowing wrap. */
  grid?: boolean;
}

export interface VisibleCategory {
  name: string;
  /** Flat entry list (unlabelled tabs). */
  entries: KeycodeDef[];
  /** When present, the tab renders these labelled sub-groups instead of {@link entries}. */
  groups?: KeycodeGroup[];
}

export const entriesOf = (name: string): KeycodeDef[] =>
  KEYCODE_CATEGORIES.find((c) => c.name === name)?.entries ?? [];

/** Editor pages the Combo Keys cards can jump to via their hover "编辑" action. */
export type ComboEditTarget = "macro" | "tapdance" | "combo";

/**
 * Used/total slot counts and the "编辑" jump target for one Combo Keys card,
 * keyed off the sub-group's heading (Macros vs Tap Dance).
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
 * The three Fn/Media/Mouse groups, shown as vertically-stacked expandable cards
 * inside the Basic tab (they used to live in a dedicated "Function" tab). Ordered
 * F13–F24, Mouse, then Media; the F-keys render in a 2×6 grid once expanded.
 */
export const FN_MEDIA_MOUSE_GROUPS: KeycodeGroup[] = [
  { titleKey: "groupFnKeys", entries: entriesOf("Fn keys"), grid: true },
  { titleKey: "groupMouse", entries: entriesOf("Mouse") },
  { titleKey: "groupMedia", entries: entriesOf("Media") },
];

/**
 * The keycodes for the "其他" (Other) card at the end of the 其他 column: One-Shot
 * Mods, plus any Quantum keycodes matching none of the typed Quantum groups, plus
 * the two leftover Layer fn keys (FN_MO13/FN_MO23) that fit no per-type layer
 * group. The Quantum category is otherwise hidden; this flat list keeps those
 * keycodes reachable, rendered as an ordinary expandable card (not the removed
 * QuantumCards) via `KeyboardFunctionCards`.
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
 * Visible tabs for the inline picker: hidden categories dropped, and the three
 * small Fn/Media/Mouse groups pulled out entirely — they're rendered inside the
 * Basic tab (see {@link FN_MEDIA_MOUSE_GROUPS}) rather than as a tab of their own.
 */
export const VISIBLE_CATEGORIES = (() => {
  const out: VisibleCategory[] = [];
  for (const c of KEYCODE_CATEGORIES) {
    if (HIDDEN_CATEGORIES.has(c.name)) continue;
    // Folded into the Basic tab as vertical cards, not a standalone tab.
    if (MERGE_SOURCES.has(c.name)) continue;
    // The Macros/Tap Dance/Combo + Quantum cards also live inside the Basic tab
    // (its far-right columns), so Macros is no longer a tab of its own.
    if (c.name === "Macros") continue;
    // Layers (层切换) and Lighting → Keyboard Function (键盘功能) are likewise
    // folded into the Basic tab's far-right columns, not standalone tabs.
    if (c.name === "Layers" || c.name === "Lighting") continue;
    out.push({ name: c.name, entries: c.entries });
  }
  return out;
})();

/**
 * The two Multi-Function categories the 多功能 card offers:
 *  - "modified" (red): layer modifiers onto a base keycode.
 *  - "taphold" (blue): tap sends the base keycode, hold activates a layer/mod.
 */
export type MultiFuncMode = "modified" | "taphold";

/**
 * The dual-role "framework" template written to the selected key the moment a
 * Multi-Function category is chosen, base slot left as `KC_NO`. The actual write
 * (see `MultiFunctionCardBody`'s onClick) fills that base with the selected cap's
 * *current* keycode when it's a basic (8-bit) keycode — i.e. it overlays the
 * modifier/layer role onto what's already there — and falls back to this empty
 * `KC_NO` base (clear-then-overlay) whenever the current keycode isn't basic
 * (already composite, or nothing selected):
 *  - modified: 左Ctrl+左Alt on the base (`LCA(kc)`).
 *  - taphold: Layer-Tap holding layer 0 with the base as tap (`LT(0,kc)`).
 */
export const MULTI_FUNC_FRAMEWORK: Record<MultiFuncMode, string> = {
  modified: "LCA(KC_NO)",
  taphold: "LT(0,KC_NO)",
};
