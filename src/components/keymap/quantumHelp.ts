// Per-keycode help text for the "Quantum" cards. The modifier families
// (One-Shot Mods, held modifiers, Mod-Tap) are large and regular, so their
// descriptions are generated from the modifier(s) each keycode carries; the
// handful of concrete/opaque keycodes (Esc~, Caps Word, Bootloader, …) have
// hand-written text. Kept out of keycodes.ts so the protocol layer stays
// framework- and locale-agnostic.

type Lang = "zh" | "en";

/** Display name for a single modifier token, per language. */
const MOD_NAMES: Record<Lang, Record<string, string>> = {
  zh: {
    LSFT: "左 Shift",
    LCTL: "左 Ctrl",
    LALT: "左 Alt",
    LGUI: "左 GUI",
    RSFT: "右 Shift",
    RCTL: "右 Ctrl",
    RALT: "右 Alt",
    RGUI: "右 GUI",
    MEH: "Meh（Ctrl+Shift+Alt）",
    HYPR: "Hyper（Ctrl+Shift+Alt+GUI）",
  },
  en: {
    LSFT: "Left Shift",
    LCTL: "Left Ctrl",
    LALT: "Left Alt",
    LGUI: "Left GUI",
    RSFT: "Right Shift",
    RCTL: "Right Ctrl",
    RALT: "Right Alt",
    RGUI: "Right GUI",
    MEH: "Meh (Ctrl+Shift+Alt)",
    HYPR: "Hyper (Ctrl+Shift+Alt+GUI)",
  },
};

/** Modifier tokens each alias base (the part before `(kc)`/`_T(kc)`) stands for. */
const ALIAS_MODS: Record<string, string[]> = {
  LSFT: ["LSFT"],
  LCTL: ["LCTL"],
  LALT: ["LALT"],
  LGUI: ["LGUI"],
  RSFT: ["RSFT"],
  RCTL: ["RCTL"],
  RALT: ["RALT"],
  RGUI: ["RGUI"],
  C_S: ["LCTL", "LSFT"],
  LCA: ["LCTL", "LALT"],
  LSA: ["LSFT", "LALT"],
  LAG: ["LALT", "LGUI"],
  LCAG: ["LCTL", "LALT", "LGUI"],
  RCAG: ["RCTL", "RALT", "RGUI"],
  LCG: ["LCTL", "LGUI"],
  RCG: ["RCTL", "RGUI"],
  SGUI: ["LSFT", "LGUI"],
  MEH: ["MEH"],
  HYPR: ["HYPR"],
  ALL: ["HYPR"],
};

/** Join modifier tokens into a human phrase, e.g. "左 Ctrl + 左 Shift". */
const joinMods = (tokens: string[], lang: Lang): string =>
  tokens.map((m) => MOD_NAMES[lang][m] ?? m).join(lang === "zh" ? " + " : " + ");

/** Hand-written help for concrete quantum keycodes that carry no modifier. */
const MISC_HELP: Record<string, Record<Lang, string>> = {
  KC_GESC: {
    zh: "点按发送 Esc；配合 Shift 或 GUI 时发送 ` 或 ~。",
    en: "Sends Esc; with Shift or GUI held, sends ` or ~.",
  },
  KC_LSPO: {
    zh: "按住为左 Shift，单独点按发送 (。",
    en: "Left Shift when held, sends ( when tapped.",
  },
  KC_RSPC: {
    zh: "按住为右 Shift，单独点按发送 )。",
    en: "Right Shift when held, sends ) when tapped.",
  },
  KC_LCPO: {
    zh: "按住为左 Ctrl，单独点按发送 (。",
    en: "Left Ctrl when held, sends ( when tapped.",
  },
  KC_RCPC: {
    zh: "按住为右 Ctrl，单独点按发送 )。",
    en: "Right Ctrl when held, sends ) when tapped.",
  },
  KC_LAPO: {
    zh: "按住为左 Alt，单独点按发送 (。",
    en: "Left Alt when held, sends ( when tapped.",
  },
  KC_RAPC: {
    zh: "按住为右 Alt，单独点按发送 )。",
    en: "Right Alt when held, sends ) when tapped.",
  },
  KC_SFTENT: {
    zh: "按住为右 Shift，单独点按发送 Enter。",
    en: "Right Shift when held, sends Enter when tapped.",
  },
  QK_CAPS_WORD_TOGGLE: {
    zh: "Caps Word：临时大写当前单词，遇空格或标点自动关闭。",
    en: "Caps Word: capitalizes the current word, auto-off at space or punctuation.",
  },
  QK_LAYER_LOCK: {
    zh: "锁定当前激活的层，再次按下解除锁定。",
    en: "Locks the currently active layer on; press again to release.",
  },
  QK_REPEAT_KEY: {
    zh: "重复上一次按下的按键。",
    en: "Repeats the last key you pressed.",
  },
  QK_ALT_REPEAT_KEY: {
    zh: "发送上一次按键的替代/反向动作（如反方向移动）。",
    en: "Sends the alternate of the last key (e.g. the reverse direction).",
  },
  QK_BOOT: {
    zh: "进入 Bootloader（DFU）刷写模式。",
    en: "Enters the bootloader (DFU) for flashing firmware.",
  },
  QK_CLEAR_EEPROM: {
    zh: "清除 EEPROM，将保存的设置恢复为默认。",
    en: "Clears EEPROM, resetting stored settings to defaults.",
  },
};

/**
 * Help text describing a single "Quantum" keycode, or null when none applies.
 * Handles One-Shot Mods (`OSM(...)`), held modifiers (`X(kc)`), Mod-Tap
 * (`X_T(kc)`), Layer-Tap (`LTn(kc)`), and the hand-written misc keycodes.
 */
export function quantumHelp(qmkId: string, lang: Lang): string | null {
  if (MISC_HELP[qmkId]) return MISC_HELP[qmkId][lang];

  // One-Shot Mods: OSM(MOD_LCTL|MOD_LSFT)
  const osm = /^OSM\((.+)\)$/.exec(qmkId);
  if (osm) {
    const mods = osm[1].split("|").map((m) => m.replace(/^MOD_/, ""));
    const phrase = joinMods(mods, lang);
    return lang === "zh"
      ? `单次修饰键：点按后仅下一次按键附加 ${phrase}，无需一直按住。`
      : `One-shot: the next key press alone gets ${phrase}; no need to hold.`;
  }

  // Layer-Tap: LT0(kc), LT1(kc), …
  const lt = /^LT(\d+)\(kc\)$/.exec(qmkId);
  if (lt) {
    return lang === "zh"
      ? `按住时激活第 ${lt[1]} 层，点按时发送内部的基础键码。`
      : `Activates layer ${lt[1]} when held, sends the inner basic key when tapped.`;
  }

  // Mod-Tap: X_T(kc)
  const modTap = /^(.+)_T\(kc\)$/.exec(qmkId);
  if (modTap && ALIAS_MODS[modTap[1]]) {
    const phrase = joinMods(ALIAS_MODS[modTap[1]], lang);
    return lang === "zh"
      ? `按住时作为 ${phrase}，点按时发送内部的基础键码。`
      : `Acts as ${phrase} when held, sends the inner basic key when tapped.`;
  }

  // Held modifier: X(kc)
  const held = /^(.+)\(kc\)$/.exec(qmkId);
  if (held && ALIAS_MODS[held[1]]) {
    const phrase = joinMods(ALIAS_MODS[held[1]], lang);
    return lang === "zh"
      ? `按住此键时为所包裹的基础键码附加 ${phrase}。`
      : `Applies ${phrase} to the basic key it wraps.`;
  }

  return null;
}
