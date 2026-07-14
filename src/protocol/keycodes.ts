// Ported (MVP subset) from vial-gui's keycodes/keycodes.py + keycodes_v6.py.
//
// Only "basic" keycodes are covered here (letters, numbers, punctuation,
// modifiers, function/navigation/numpad keys, and shifted symbols) — the
// integer values below are the standard USB HID keyboard/keypad usage IDs,
// which are identical across the VIA/Vial protocol versions for these keys
// (unlike mod-tap/layer-tap/macro keycodes, which are out of scope for now).

export interface KeycodeDef {
  qmkId: string;
  label: string;
  code: number;
}

function table(rows: [string, string, number][]): KeycodeDef[] {
  return rows.map(([qmkId, label, code]) => ({ qmkId, label, code }));
}

export const KEYCODES_SPECIAL: KeycodeDef[] = table([
  ["KC_NO", "", 0x00],
  ["KC_TRNS", "▽", 0x01],
]);

export const KEYCODES_BASIC: KeycodeDef[] = table([
  ["KC_A", "A", 0x04],
  ["KC_B", "B", 0x05],
  ["KC_C", "C", 0x06],
  ["KC_D", "D", 0x07],
  ["KC_E", "E", 0x08],
  ["KC_F", "F", 0x09],
  ["KC_G", "G", 0x0a],
  ["KC_H", "H", 0x0b],
  ["KC_I", "I", 0x0c],
  ["KC_J", "J", 0x0d],
  ["KC_K", "K", 0x0e],
  ["KC_L", "L", 0x0f],
  ["KC_M", "M", 0x10],
  ["KC_N", "N", 0x11],
  ["KC_O", "O", 0x12],
  ["KC_P", "P", 0x13],
  ["KC_Q", "Q", 0x14],
  ["KC_R", "R", 0x15],
  ["KC_S", "S", 0x16],
  ["KC_T", "T", 0x17],
  ["KC_U", "U", 0x18],
  ["KC_V", "V", 0x19],
  ["KC_W", "W", 0x1a],
  ["KC_X", "X", 0x1b],
  ["KC_Y", "Y", 0x1c],
  ["KC_Z", "Z", 0x1d],
  ["KC_1", "!\n1", 0x1e],
  ["KC_2", "@\n2", 0x1f],
  ["KC_3", "#\n3", 0x20],
  ["KC_4", "$\n4", 0x21],
  ["KC_5", "%\n5", 0x22],
  ["KC_6", "^\n6", 0x23],
  ["KC_7", "&\n7", 0x24],
  ["KC_8", "*\n8", 0x25],
  ["KC_9", "(\n9", 0x26],
  ["KC_0", ")\n0", 0x27],
  ["KC_ENTER", "Enter", 0x28],
  ["KC_ESCAPE", "Esc", 0x29],
  ["KC_BSPACE", "Bksp", 0x2a],
  ["KC_TAB", "Tab", 0x2b],
  ["KC_SPACE", "Space", 0x2c],
  ["KC_MINUS", "_\n-", 0x2d],
  ["KC_EQUAL", "+\n=", 0x2e],
  ["KC_LBRACKET", "{\n[", 0x2f],
  ["KC_RBRACKET", "}\n]", 0x30],
  ["KC_BSLASH", "|\n\\", 0x31],
  ["KC_SCOLON", ":\n;", 0x33],
  ["KC_QUOTE", "\"\n'", 0x34],
  ["KC_GRAVE", "~\n`", 0x35],
  ["KC_COMMA", "<\n,", 0x36],
  ["KC_DOT", ">\n.", 0x37],
  ["KC_SLASH", "?\n/", 0x38],
  ["KC_CAPSLOCK", "Caps\nLock", 0x39],
  ["KC_F1", "F1", 0x3a],
  ["KC_F2", "F2", 0x3b],
  ["KC_F3", "F3", 0x3c],
  ["KC_F4", "F4", 0x3d],
  ["KC_F5", "F5", 0x3e],
  ["KC_F6", "F6", 0x3f],
  ["KC_F7", "F7", 0x40],
  ["KC_F8", "F8", 0x41],
  ["KC_F9", "F9", 0x42],
  ["KC_F10", "F10", 0x43],
  ["KC_F11", "F11", 0x44],
  ["KC_F12", "F12", 0x45],
  ["KC_APPLICATION", "Menu", 0x65],
  ["KC_LCTRL", "LCtrl", 0xe0],
  ["KC_LSHIFT", "LShift", 0xe1],
  ["KC_LALT", "LAlt", 0xe2],
  ["KC_LGUI", "LGui", 0xe3],
  ["KC_RCTRL", "RCtrl", 0xe4],
  ["KC_RSHIFT", "RShift", 0xe5],
  ["KC_RALT", "RAlt", 0xe6],
  ["KC_RGUI", "RGui", 0xe7],
]);

export const KEYCODES_NUMPAD: KeycodeDef[] = table([
  ["KC_NUMLOCK", "Num\nLock", 0x53],
  ["KC_KP_SLASH", "/", 0x54],
  ["KC_KP_ASTERISK", "*", 0x55],
  ["KC_KP_MINUS", "-", 0x56],
  ["KC_KP_PLUS", "+", 0x57],
  ["KC_KP_ENTER", "Num\nEnter", 0x58],
  ["KC_KP_1", "1", 0x59],
  ["KC_KP_2", "2", 0x5a],
  ["KC_KP_3", "3", 0x5b],
  ["KC_KP_4", "4", 0x5c],
  ["KC_KP_5", "5", 0x5d],
  ["KC_KP_6", "6", 0x5e],
  ["KC_KP_7", "7", 0x5f],
  ["KC_KP_8", "8", 0x60],
  ["KC_KP_9", "9", 0x61],
  ["KC_KP_0", "0", 0x62],
  ["KC_KP_DOT", ".", 0x63],
  ["KC_KP_EQUAL", "=", 0x67],
  ["KC_KP_COMMA", ",", 0x85],
]);

export const KEYCODES_NAV: KeycodeDef[] = table([
  ["KC_PSCREEN", "Print\nScreen", 0x46],
  ["KC_SCROLLLOCK", "Scroll\nLock", 0x47],
  ["KC_PAUSE", "Pause", 0x48],
  ["KC_INSERT", "Insert", 0x49],
  ["KC_HOME", "Home", 0x4a],
  ["KC_PGUP", "Page\nUp", 0x4b],
  ["KC_DELETE", "Del", 0x4c],
  ["KC_END", "End", 0x4d],
  ["KC_PGDOWN", "Page\nDown", 0x4e],
  ["KC_RIGHT", "Right", 0x4f],
  ["KC_LEFT", "Left", 0x50],
  ["KC_DOWN", "Down", 0x51],
  ["KC_UP", "Up", 0x52],
]);

export const KEYCODES_SHIFTED: KeycodeDef[] = table([
  ["KC_TILD", "~", 0x235],
  ["KC_EXLM", "!", 0x21e],
  ["KC_AT", "@", 0x21f],
  ["KC_HASH", "#", 0x220],
  ["KC_DLR", "$", 0x221],
  ["KC_PERC", "%", 0x222],
  ["KC_CIRC", "^", 0x223],
  ["KC_AMPR", "&", 0x224],
  ["KC_ASTR", "*", 0x225],
  ["KC_LPRN", "(", 0x226],
  ["KC_RPRN", ")", 0x227],
  ["KC_UNDS", "_", 0x22d],
  ["KC_PLUS", "+", 0x22e],
  ["KC_LCBR", "{", 0x22f],
  ["KC_RCBR", "}", 0x230],
  ["KC_LT", "<", 0x236],
  ["KC_GT", ">", 0x237],
  ["KC_COLN", ":", 0x233],
  ["KC_PIPE", "|", 0x231],
  ["KC_QUES", "?", 0x238],
  ["KC_DQUO", '"', 0x234],
]);

export const KEYCODE_CATEGORIES: { name: string; entries: KeycodeDef[] }[] = [
  { name: "Basic", entries: KEYCODES_BASIC },
  { name: "Numpad", entries: KEYCODES_NUMPAD },
  { name: "Navigation", entries: KEYCODES_NAV },
  { name: "Shifted", entries: KEYCODES_SHIFTED },
  { name: "Special", entries: KEYCODES_SPECIAL },
];

const ALL_ENTRIES: KeycodeDef[] = [
  ...KEYCODES_SPECIAL,
  ...KEYCODES_BASIC,
  ...KEYCODES_NUMPAD,
  ...KEYCODES_NAV,
  ...KEYCODES_SHIFTED,
];

const byQmkId = new Map(ALL_ENTRIES.map((e) => [e.qmkId, e]));
const byCode = new Map(ALL_ENTRIES.map((e) => [e.code, e]));

/** Converts an integer keycode (as read from the device) to its qmk_id string. */
export function serialize(code: number): string {
  const entry = byCode.get(code);
  if (entry) {
    return entry.qmkId;
  }
  // Unknown to this MVP's table (e.g. macros, layer-tap, mod-tap already
  // programmed on the keyboard) — fall back to a raw hex identifier, mirroring
  // vial-gui's Keycode.serialize() behavior for unrecognized codes.
  return "0x" + code.toString(16);
}

/** Converts a qmk_id string (or a "0x.." fallback identifier) to its integer keycode. */
export function deserialize(qmkId: string): number {
  const entry = byQmkId.get(qmkId);
  if (entry) {
    return entry.code;
  }
  if (qmkId.startsWith("0x")) {
    const parsed = Number.parseInt(qmkId, 16);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

/** Human-readable label for a qmk_id (or raw hex fallback identifier). */
export function label(qmkId: string): string {
  return byQmkId.get(qmkId)?.label ?? qmkId;
}
