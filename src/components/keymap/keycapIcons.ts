// Single source of truth for every keycap-face icon substitution: which Material
// Design Icon (mdi, via Iconify) replaces a keycode's text on the cap, and how big
// that glyph renders. Everything that swaps text for an icon reads from here —
// KeycapFace (letters/modifiers/nav keys, macro caps, L/R side badges) and the
// preview's layer-switch face — so no icon name or size is hardcoded in a component.
//
// The `mdi:…` names are served from the app-wide offline subset registered in
// ../../mdiIcons.ts, so they render without a network request. After adding a name
// below, re-run `node scripts/genIcons.mjs` to fold it into that subset.

import type { KeyDisplay } from "../../contexts/keyDisplay.tsx";

/** One keycap-face glyph: its mdi name and its own size. */
export interface CapIcon {
  /** mdi icon name (from the offline subset). */
  icon: string;
  /**
   * Per-icon size multiplier, applied on top of the base cap-icon size via the
   * `--cap-icon-scale` CSS var (1 = same size as the base `.key-icon`). This is the
   * one place a glyph's size lives — tune any single icon here without touching CSS.
   */
  scale?: number;
}

/**
 * Default size for the oversized symbol glyphs. The modifier/nav/whitespace symbols
 * (⌘ ⇧ ⌥ ⌃ ↵ ⌫ ⎵ arrows…) read ~20% larger than the text labels and letter caps,
 * so they shrink to 0.8. Override per-entry when a specific glyph needs its own size.
 */
const SYMBOL = 0.8;

/**
 * Macro cap glyph (M0…M15): the script icon shown before the slot number. Shrunk a
 * notch below a normal cap icon (and, in CSS, pulled tight against the number).
 */
export const MACRO_ICON: CapIcon = { icon: "mdi:script-text-outline", scale: 0.72 };

/**
 * Layer-switch cap glyph (MO/TG/TT/OSL/TO/DF/PDF): the stacked-layers icon that
 * carries the target layer number badge, in place of the raw "MO(2)" text.
 */
export const LAYER_ICON: CapIcon = { icon: "mdi:layers-outline" };

/** Boxed L/R side badge (Ⓛ / Ⓡ) prepended to left/right modifier caps. */
export function sideBadgeIcon(side: "L" | "R"): CapIcon {
  return { icon: side === "L" ? "mdi:alpha-l-box-outline" : "mdi:alpha-r-box-outline" };
}

/**
 * The keycode → glyph table. A value is either a fixed {@link CapIcon} or, for keys
 * whose glyph depends on the 系统修饰键 (keyDisplay) OS style, a function of `mac`
 * that returns the CapIcon — or `null` when that OS engraves text instead of a glyph:
 * - GUI → ⌘ (macOS) / ⊞ Windows logo (windows).
 * - Ctrl/Alt → ⌃ / ⌥ only in macOS mode; windows mode keeps the text ("Ctrl"/"Alt"),
 *   matching how those caps are actually engraved on a PC board.
 * - Shift (⇧) and Caps (⇪) use their glyph in both modes — the symbols are cross-platform.
 */
const CAP_ICONS: Record<string, CapIcon | ((mac: boolean) => CapIcon | null)> = {
  // ⌘ reads heavier than the other symbols, so the macOS command glyph shrinks a
  // bit more than the shared SYMBOL default; the Windows logo keeps SYMBOL.
  KC_LGUI: (mac) =>
    mac ? { icon: "mdi:apple-keyboard-command", scale: 0.68 } : { icon: "mdi:microsoft-windows", scale: SYMBOL },
  KC_RGUI: (mac) =>
    mac ? { icon: "mdi:apple-keyboard-command", scale: 0.68 } : { icon: "mdi:microsoft-windows", scale: SYMBOL },
  KC_LSHIFT: { icon: "mdi:apple-keyboard-shift", scale: SYMBOL },
  KC_RSHIFT: { icon: "mdi:apple-keyboard-shift", scale: SYMBOL },
  KC_CAPSLOCK: { icon: "mdi:apple-keyboard-caps", scale: SYMBOL },
  KC_LCTRL: (mac) => (mac ? { icon: "mdi:apple-keyboard-control", scale: SYMBOL } : null),
  KC_RCTRL: (mac) => (mac ? { icon: "mdi:apple-keyboard-control", scale: SYMBOL } : null),
  KC_LALT: (mac) => (mac ? { icon: "mdi:apple-keyboard-option", scale: SYMBOL } : null),
  KC_RALT: (mac) => (mac ? { icon: "mdi:apple-keyboard-option", scale: SYMBOL } : null),
  KC_ENTER: { icon: "mdi:keyboard-return", scale: SYMBOL },
  KC_BSPACE: { icon: "mdi:keyboard-backspace", scale: SYMBOL },
  KC_ESCAPE: { icon: "mdi:keyboard-esc", scale: SYMBOL },
  KC_SPACE: { icon: "mdi:keyboard-space", scale: SYMBOL },
  KC_TAB: { icon: "mdi:keyboard-tab", scale: SYMBOL },
  KC_UP: { icon: "mdi:arrow-up-thin", scale: SYMBOL },
  KC_DOWN: { icon: "mdi:arrow-down-thin", scale: SYMBOL },
  KC_LEFT: { icon: "mdi:arrow-left-thin", scale: SYMBOL },
  KC_RIGHT: { icon: "mdi:arrow-right-thin", scale: SYMBOL },
};

/**
 * {@link CapIcon} for a keycap, or `null` when the key has no icon and should fall
 * back to its text label. `keyDisplay` selects the OS modifier style (see CAP_ICONS).
 */
export function capIcon(qmkId: string, keyDisplay: KeyDisplay): CapIcon | null {
  const entry = CAP_ICONS[qmkId];
  if (!entry) return null;
  return typeof entry === "function" ? entry(keyDisplay === "macos") : entry;
}
