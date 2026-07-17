import {
  customKeycodeDefs,
  tapDanceKeycodeDefs,
  type KeycodeDef,
} from "../../protocol/keycodes.ts";
import type { MessageKey } from "../../contexts/i18n.tsx";

/**
 * The single, framework-adjacent source of truth for keycode **UI metadata**:
 * how keycodes are organised into categories and sub-groups, and the
 * translation keys for every category / group / per-key description. Every view
 * that shows a key, its label, its description, or a category/sub-category
 * heading reads from here (or from `protocol/keycodes.ts` for the raw keycode
 * tables + `label()`), never from a table inlined in a component — so the
 * advanced picker ({@link ../common/KeycodePicker}), the quick-config tabs
 * ({@link ./KeycodeTabs}) and the cascade selector
 * ({@link ./KeycodeCascadeSelector}) all classify + describe identically.
 *
 * Descriptions stay as i18n `MessageKey`s (a UI concern) rather than living in
 * the framework-agnostic `protocol/keycodes.ts`.
 */

/** 
 * Metadata for a keycode sub-group within a top-level category: its
 * classification (`match`), heading (`titleKey`) and optional description
 * (`helpKey`). Groups within one category are mutually exclusive by
 * construction; a group whose `match` returns `true` for everything acts as a
 * catch-all and must come last (or be applied only to the leftovers).
 */
export interface KeycodeGroupMeta {
  /** Stable identity for the group (used as a column key / lookup handle). */
  key: string;
  /** Translation key for the group heading (e.g. "MO · Momentary"). */
  titleKey: MessageKey;
  /** Translation key for the group's description shown as help / info copy;
   *  omitted for self-explanatory groups (e.g. Basic's Letters/Numbers). */
  helpKey?: MessageKey;
  /** Whether a keycode belongs to this group. */
  match: (qmkId: string) => boolean;
}

// --- Top-level categories --------------------------------------------------

/**
 * Category name → its heading translation key. Keys mirror `KEYCODE_CATEGORIES`
 * names in `protocol/keycodes.ts`, plus the virtual/merged tab names the
 * quick-config view introduces (Fn/Media/Mouse, Keyboard Function, …).
 */
export const CATEGORY_KEYS: Record<string, MessageKey> = {
  Basic: "categoryBasic",
  Numpad: "categoryNumpad",
  Navigation: "categoryNavigation",
  Shifted: "categoryShifted",
  "ISO/International": "categoryIso",
  "Fn keys": "categoryFn",
  Layers: "categoryLayers",
  Quantum: "categoryQuantum",
  Macros: "categoryMacros",
  Media: "categoryMedia",
  Mouse: "categoryMouse",
  Lighting: "categoryLighting",
  "Fn/Media/Mouse": "categoryFnMediaMouse",
  Custom: "categoryCustom",
  "Keyboard Function": "categoryKeyboardFunction",
  "Tap Dance": "categoryTapDance",
  "Macros/Tap Dance": "categoryMacrosTapDance",
};

/**
 * Category name → a category-level description key, for the categories that have
 * one (shown in the cascade selector's info panel as supplementary context).
 * Basic's clear keys and Custom keycodes carry their own per-key copy instead.
 */
export const CATEGORY_DESC: Record<string, MessageKey> = {
  "ISO/International": "cascadeDescIso",
  Layers: "cascadeDescLayers",
  Quantum: "cascadeDescQuantum",
  Media: "cascadeDescMedia",
  Mouse: "cascadeDescMouse",
  Lighting: "cascadeDescLighting",
  Custom: "cascadeDescCustom",
};

/**
 * The two "clear" keycodes in Basic, shown as plain labelled buttons rather than
 * their raw id / "▽" glyph: KC_NO wipes the key, KC_TRNS is transparent (falls
 * through to the layer below). `title` doubles as the per-key description shown
 * in the cascade info panel.
 */
export const CLEAR_LABELS: Record<string, { label: MessageKey; title: MessageKey }> = {
  KC_NO: { label: "clearNoLabel", title: "clearNoTitle" },
  KC_TRNS: { label: "clearTransLabel", title: "clearTransTitle" },
};

/**
 * Categories that only exist once a keyboard is connected: its custom keycodes
 * (Bluetooth switches, etc.) and tap-dance slots. Read live from the keycode
 * registry so they reflect whichever device is attached, and omitted entirely
 * when the device defines none.
 */
export function deviceCategories(): { name: string; entries: KeycodeDef[] }[] {
  const out: { name: string; entries: KeycodeDef[] }[] = [];
  const custom = customKeycodeDefs();
  if (custom.length > 0) out.push({ name: "Custom", entries: [...custom] });
  const tapDance = tapDanceKeycodeDefs();
  if (tapDance.length > 0) out.push({ name: "Tap Dance", entries: [...tapDance] });
  return out;
}

// --- Basic -----------------------------------------------------------------

const BASIC_SYMBOL_IDS = new Set([
  "KC_MINUS", "KC_EQUAL", "KC_LBRACKET", "KC_RBRACKET", "KC_BSLASH",
  "KC_SCOLON", "KC_QUOTE", "KC_GRAVE", "KC_COMMA", "KC_DOT", "KC_SLASH",
]);
const BASIC_EDIT_IDS = new Set([
  "KC_ENTER", "KC_ESCAPE", "KC_BSPACE", "KC_TAB", "KC_SPACE",
  "KC_CAPSLOCK", "KC_APPLICATION",
]);
const BASIC_MOD_IDS = new Set([
  "KC_LCTRL", "KC_LSHIFT", "KC_LALT", "KC_LGUI",
  "KC_RCTRL", "KC_RSHIFT", "KC_RALT", "KC_RGUI",
]);

/**
 * Basic split into 6 areas (cascade selector middle column). Keycodes matching
 * no group (KC_NO / KC_TRNS) fall through and render as leaves. No `helpKey` —
 * the headings are self-explanatory.
 */
export const BASIC_GROUPS: KeycodeGroupMeta[] = [
  { key: "letters", titleKey: "groupBasicLetters", match: (id) => /^KC_[A-Z]$/.test(id) },
  { key: "numbers", titleKey: "groupBasicNumbers", match: (id) => /^KC_[0-9]$/.test(id) },
  { key: "symbols", titleKey: "groupBasicSymbols", match: (id) => BASIC_SYMBOL_IDS.has(id) },
  { key: "fkeys", titleKey: "groupBasicFKeys", match: (id) => /^KC_F([1-9]|1[0-2])$/.test(id) },
  { key: "editing", titleKey: "groupBasicEditing", match: (id) => BASIC_EDIT_IDS.has(id) },
  { key: "mods", titleKey: "groupBasicMods", match: (id) => BASIC_MOD_IDS.has(id) },
];

// --- Layers ----------------------------------------------------------------

/** Layer-switch groups, one per function; a `FN(n)` keycode belongs to the
 *  group whose `fn` prefixes it. */
export const LAYER_GROUPS: KeycodeGroupMeta[] = (
  [
    ["MO", "groupLayerMO", "groupLayerMOHelp"],
    ["TG", "groupLayerTG", "groupLayerTGHelp"],
    ["TT", "groupLayerTT", "groupLayerTTHelp"],
    ["OSL", "groupLayerOSL", "groupLayerOSLHelp"],
    ["TO", "groupLayerTO", "groupLayerTOHelp"],
    ["DF", "groupLayerDF", "groupLayerDFHelp"],
  ] satisfies [string, MessageKey, MessageKey][]
).map(([fn, titleKey, helpKey]) => ({
  key: fn,
  titleKey,
  helpKey,
  match: (id: string) => id.startsWith(`${fn}(`),
}));

/** Catch-all for layer keycodes matching no {@link LAYER_GROUPS} fn (e.g.
 *  FN_MO13 / FN_MO23). */
export const LAYER_GROUP_OTHER: KeycodeGroupMeta = {
  key: "layerOther",
  titleKey: "groupLayerOther",
  helpKey: "groupLayerOtherHelp",
  match: () => true,
};

// --- Quantum ---------------------------------------------------------------

const isOSM = (id: string) => id.startsWith("OSM(");
const isModTap = (id: string) => /_T\(kc\)$/.test(id);
const isLayerTap = (id: string) => /^LT\d+\(/.test(id);
const isMod = (id: string) =>
  !isOSM(id) && !isModTap(id) && !isLayerTap(id) && id.endsWith("(kc)");

/**
 * Quantum groups partitioned by qmk_id shape. Mutually exclusive; anything none
 * of these match is a "misc" leftover (see {@link QUANTUM_GROUP_MISC}). Order is
 * the cascade selector's display order.
 */
export const QUANTUM_GROUPS: KeycodeGroupMeta[] = [
  { key: "mods", titleKey: "groupQuantumMods", helpKey: "groupQuantumModsHelp", match: isMod },
  { key: "modtap", titleKey: "groupQuantumModTap", helpKey: "groupQuantumModTapHelp", match: isModTap },
  { key: "layertap", titleKey: "groupQuantumLayerTap", helpKey: "groupQuantumLayerTapHelp", match: isLayerTap },
  { key: "osm", titleKey: "groupQuantumOSM", helpKey: "groupQuantumOSMHelp", match: isOSM },
];

/** Catch-all for Quantum keycodes matching none of {@link QUANTUM_GROUPS}. */
export const QUANTUM_GROUP_MISC: KeycodeGroupMeta = {
  key: "quantumMisc",
  titleKey: "groupQuantumMisc",
  helpKey: "groupQuantumOtherHelp",
  match: () => true,
};

// --- Per-key descriptions --------------------------------------------------

/**
 * Per-keycode description copy for individual keys not covered by a group
 * description — currently the Lighting keys shown in the "Keyboard Function"
 * tab. Custom (device) keycodes carry their own `title` instead and aren't
 * listed here. Shared by the quick-config tabs ({@link ../KeycodeTabs}) and the
 * cascade selector ({@link ./KeycodeCascadeSelector}) so both describe a key
 * identically.
 */
export const KEYCODE_HELP: Record<string, MessageKey> = {
  BL_TOGG: "lightBlTogg",
  BL_STEP: "lightBlStep",
  BL_BRTG: "lightBlBrtg",
  BL_ON: "lightBlOn",
  BL_OFF: "lightBlOff",
  BL_INC: "lightBlInc",
  BL_DEC: "lightBlDec",
  RGB_TOG: "lightRgbTog",
  RGB_MOD: "lightRgbMod",
  RGB_RMOD: "lightRgbRmod",
  RGB_HUI: "lightRgbHui",
  RGB_HUD: "lightRgbHud",
  RGB_SAI: "lightRgbSai",
  RGB_SAD: "lightRgbSad",
  RGB_VAI: "lightRgbVai",
  RGB_VAD: "lightRgbVad",
  RGB_SPI: "lightRgbSpi",
  RGB_SPD: "lightRgbSpd",
  RGB_M_P: "lightRgbMP",
  RGB_M_B: "lightRgbMB",
  RGB_M_R: "lightRgbMR",
  RGB_M_SW: "lightRgbMSw",
  RGB_M_SN: "lightRgbMSn",
  RGB_M_K: "lightRgbMK",
  RGB_M_X: "lightRgbMX",
  RGB_M_G: "lightRgbMG",
  RGB_M_T: "lightRgbMT",
};
