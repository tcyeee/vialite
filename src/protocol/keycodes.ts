// Ported from vial-gui's keycodes/keycodes.py, keycodes_v5.py, keycodes_v6.py
// and any_keycode.py (SPDX-License-Identifier: GPL-2.0-or-later).
//
// Vial protocol < 6 uses the v5 keycode values, >= 6 uses v6 (the QMK 0.19+
// keycode refactor moved layer/mod-tap/quantum keycodes; basic USB HID usage
// IDs are identical in both). Call setKeycodeVersion() once the device's vial
// protocol is known; serialize/deserialize/label then use the right table.
// MIDI keycodes (MI_*) are not ported; they serialize to raw hex.

export interface KeycodeDef {
  qmkId: string;
  label: string;
  /** Template like "LCTL_T(kc)" that must be completed with an inner basic key. */
  masked?: boolean;
  /** Longer human description (e.g. a custom keycode's title) shown as a tooltip. */
  title?: string;
}

// ---------------------------------------------------------------------------
// Raw name -> value tables
// ---------------------------------------------------------------------------

/** Values identical in v5 and v6. */
const KC_COMMON: Record<string, number> = {
  MOD_LCTL: 0x01,
  MOD_LSFT: 0x02,
  MOD_LALT: 0x04,
  MOD_LGUI: 0x08,
  MOD_RCTL: 0x11,
  MOD_RSFT: 0x12,
  MOD_RALT: 0x14,
  MOD_RGUI: 0x18,
  MOD_HYPR: 0xf,
  MOD_MEH: 0x7,
  ON_PRESS: 1,
  QK_LAYER_TAP: 0x4000,
  QK_LCTL: 0x0100,
  QK_LSFT: 0x0200,
  QK_LALT: 0x0400,
  QK_LGUI: 0x0800,
  QK_RCTL: 0x1100,
  QK_RSFT: 0x1200,
  QK_RALT: 0x1400,
  QK_RGUI: 0x1800,

  "C_S(kc)": 0x300,
  "HYPR(kc)": 0xf00,
  "LALT(kc)": 0x400,
  "LCA(kc)": 0x500,
  "LAG(kc)": 0xc00,
  "LCAG(kc)": 0xd00,
  "LCG(kc)": 0x900,
  "LCTL(kc)": 0x100,
  "LGUI(kc)": 0x800,
  "LSA(kc)": 0x600,
  "LSFT(kc)": 0x200,
  "MEH(kc)": 0x700,
  "RALT(kc)": 0x1400,
  "RCG(kc)": 0x1900,
  "RCTL(kc)": 0x1100,
  "RGUI(kc)": 0x1800,
  "RSFT(kc)": 0x1200,
  "SGUI(kc)": 0xa00,

  KC_NO: 0x00,
  KC_TRNS: 0x01,
  KC_A: 0x04,
  KC_B: 0x05,
  KC_C: 0x06,
  KC_D: 0x07,
  KC_E: 0x08,
  KC_F: 0x09,
  KC_G: 0x0a,
  KC_H: 0x0b,
  KC_I: 0x0c,
  KC_J: 0x0d,
  KC_K: 0x0e,
  KC_L: 0x0f,
  KC_M: 0x10,
  KC_N: 0x11,
  KC_O: 0x12,
  KC_P: 0x13,
  KC_Q: 0x14,
  KC_R: 0x15,
  KC_S: 0x16,
  KC_T: 0x17,
  KC_U: 0x18,
  KC_V: 0x19,
  KC_W: 0x1a,
  KC_X: 0x1b,
  KC_Y: 0x1c,
  KC_Z: 0x1d,
  KC_1: 0x1e,
  KC_2: 0x1f,
  KC_3: 0x20,
  KC_4: 0x21,
  KC_5: 0x22,
  KC_6: 0x23,
  KC_7: 0x24,
  KC_8: 0x25,
  KC_9: 0x26,
  KC_0: 0x27,
  KC_ENTER: 0x28,
  KC_ESCAPE: 0x29,
  KC_BSPACE: 0x2a,
  KC_TAB: 0x2b,
  KC_SPACE: 0x2c,
  KC_MINUS: 0x2d,
  KC_EQUAL: 0x2e,
  KC_LBRACKET: 0x2f,
  KC_RBRACKET: 0x30,
  KC_BSLASH: 0x31,
  KC_SCOLON: 0x33,
  KC_QUOTE: 0x34,
  KC_GRAVE: 0x35,
  KC_COMMA: 0x36,
  KC_DOT: 0x37,
  KC_SLASH: 0x38,
  KC_CAPSLOCK: 0x39,
  KC_F1: 0x3a,
  KC_F2: 0x3b,
  KC_F3: 0x3c,
  KC_F4: 0x3d,
  KC_F5: 0x3e,
  KC_F6: 0x3f,
  KC_F7: 0x40,
  KC_F8: 0x41,
  KC_F9: 0x42,
  KC_F10: 0x43,
  KC_F11: 0x44,
  KC_F12: 0x45,
  KC_PSCREEN: 0x46,
  KC_SCROLLLOCK: 0x47,
  KC_PAUSE: 0x48,
  KC_INSERT: 0x49,
  KC_HOME: 0x4a,
  KC_PGUP: 0x4b,
  KC_DELETE: 0x4c,
  KC_END: 0x4d,
  KC_PGDOWN: 0x4e,
  KC_RIGHT: 0x4f,
  KC_LEFT: 0x50,
  KC_DOWN: 0x51,
  KC_UP: 0x52,
  KC_NUMLOCK: 0x53,
  KC_KP_SLASH: 0x54,
  KC_KP_ASTERISK: 0x55,
  KC_KP_MINUS: 0x56,
  KC_KP_PLUS: 0x57,
  KC_KP_ENTER: 0x58,
  KC_KP_1: 0x59,
  KC_KP_2: 0x5a,
  KC_KP_3: 0x5b,
  KC_KP_4: 0x5c,
  KC_KP_5: 0x5d,
  KC_KP_6: 0x5e,
  KC_KP_7: 0x5f,
  KC_KP_8: 0x60,
  KC_KP_9: 0x61,
  KC_KP_0: 0x62,
  KC_KP_DOT: 0x63,
  KC_KP_EQUAL: 0x67,
  KC_KP_COMMA: 0x85,
  KC_APPLICATION: 0x65,
  KC_LCTRL: 0xe0,
  KC_LSHIFT: 0xe1,
  KC_LALT: 0xe2,
  KC_LGUI: 0xe3,
  KC_RCTRL: 0xe4,
  KC_RSHIFT: 0xe5,
  KC_RALT: 0xe6,
  KC_RGUI: 0xe7,
  KC_TILD: 0x235,
  KC_EXLM: 0x21e,
  KC_AT: 0x21f,
  KC_HASH: 0x220,
  KC_DLR: 0x221,
  KC_PERC: 0x222,
  KC_CIRC: 0x223,
  KC_AMPR: 0x224,
  KC_ASTR: 0x225,
  KC_LPRN: 0x226,
  KC_RPRN: 0x227,
  KC_UNDS: 0x22d,
  KC_PLUS: 0x22e,
  KC_LCBR: 0x22f,
  KC_RCBR: 0x230,
  KC_LT: 0x236,
  KC_GT: 0x237,
  KC_COLN: 0x233,
  KC_PIPE: 0x231,
  KC_QUES: 0x238,
  KC_DQUO: 0x234,
  KC_NONUS_HASH: 0x32,
  KC_NONUS_BSLASH: 0x64,
  KC_RO: 0x87,
  KC_KANA: 0x88,
  KC_JYEN: 0x89,
  KC_HENK: 0x8a,
  KC_MHEN: 0x8b,
  KC_LANG1: 0x90,
  KC_LANG2: 0x91,
  KC_F13: 104,
  KC_F14: 105,
  KC_F15: 106,
  KC_F16: 107,
  KC_F17: 108,
  KC_F18: 109,
  KC_F19: 110,
  KC_F20: 111,
  KC_F21: 112,
  KC_F22: 113,
  KC_F23: 114,
  KC_F24: 115,
  KC_PWR: 165,
  KC_SLEP: 166,
  KC_WAKE: 167,
  KC_EXEC: 116,
  KC_HELP: 117,
  KC_SLCT: 119,
  KC_STOP: 120,
  KC_AGIN: 121,
  KC_UNDO: 122,
  KC_CUT: 123,
  KC_COPY: 124,
  KC_PSTE: 125,
  KC_FIND: 126,
  KC_CALC: 178,
  KC_MAIL: 177,
  KC_MSEL: 175,
  KC_MYCM: 179,
  KC_WSCH: 180,
  KC_WHOM: 181,
  KC_WBAK: 182,
  KC_WFWD: 183,
  KC_WSTP: 184,
  KC_WREF: 185,
  KC_WFAV: 186,
  KC_BRIU: 189,
  KC_BRID: 190,
  KC_MPRV: 172,
  KC_MNXT: 171,
  KC_MUTE: 168,
  KC_VOLD: 170,
  KC_VOLU: 169,
  KC__VOLDOWN: 129,
  KC__VOLUP: 128,
  KC_MSTP: 173,
  KC_MPLY: 174,
  KC_MRWD: 188,
  KC_MFFD: 187,
  KC_EJCT: 176,
  KC_LCAP: 130,
  KC_LNUM: 131,
  KC_LSCR: 132,
};

const KC_V5: Record<string, number> = {
  QK_TO: 0x5000,
  QK_MOMENTARY: 0x5100,
  QK_DEF_LAYER: 0x5200,
  QK_TOGGLE_LAYER: 0x5300,
  QK_ONE_SHOT_LAYER: 0x5400,
  QK_ONE_SHOT_MOD: 0x5500,
  QK_TAP_DANCE: 0x5700,
  QK_LAYER_TAP_TOGGLE: 0x5800,
  QK_LAYER_MOD: 0x5900,
  QK_MOD_TAP: 0x6000,
  QK_MACRO: 0x5f12,
  QK_KB: 0x5f80,
  QK_PERSISTENT_DEF_LAYER: 0x999a0,
  QMK_LM_SHIFT: 4,
  QMK_LM_MASK: 0xf,

  "ALL_T(kc)": 0x6f00,
  "C_S_T(kc)": 0x6300,
  "LALT_T(kc)": 0x6400,
  "LCA_T(kc)": 0x6500,
  "LAG_T(kc)": 0x6c00,
  "LCAG_T(kc)": 0x6d00,
  "LCG_T(kc)": 0x6900,
  "LCTL_T(kc)": 0x6100,
  "LGUI_T(kc)": 0x6800,
  "LSA_T(kc)": 0x6600,
  "LSFT_T(kc)": 0x6200,
  "MEH_T(kc)": 0x6700,
  "RALT_T(kc)": 0x7400,
  "RCAG_T(kc)": 0x7d00,
  "RCG_T(kc)": 0x7900,
  "RCTL_T(kc)": 0x7100,
  "RGUI_T(kc)": 0x7800,
  "RSFT_T(kc)": 0x7200,
  "SGUI_T(kc)": 0x6a00,

  "OSM(MOD_LSFT)": 0x5502,
  "OSM(MOD_LCTL)": 0x5501,
  "OSM(MOD_LALT)": 0x5504,
  "OSM(MOD_LGUI)": 0x5508,
  "OSM(MOD_RSFT)": 0x5512,
  "OSM(MOD_RCTL)": 0x5511,
  "OSM(MOD_RALT)": 0x5514,
  "OSM(MOD_RGUI)": 0x5518,
  "OSM(MOD_LCTL|MOD_LSFT)": 0x5503,
  "OSM(MOD_LCTL|MOD_LALT)": 0x5505,
  "OSM(MOD_LCTL|MOD_LGUI)": 0x5509,
  "OSM(MOD_LSFT|MOD_LALT)": 0x5506,
  "OSM(MOD_LSFT|MOD_LGUI)": 0x550a,
  "OSM(MOD_LALT|MOD_LGUI)": 0x550c,
  "OSM(MOD_LCTL|MOD_LSFT|MOD_LGUI)": 0x550b,
  "OSM(MOD_LCTL|MOD_LALT|MOD_LGUI)": 0x550d,
  "OSM(MOD_LSFT|MOD_LALT|MOD_LGUI)": 0x550e,
  "OSM(MOD_RCTL|MOD_RSFT)": 0x5513,
  "OSM(MOD_RCTL|MOD_RALT)": 0x5515,
  "OSM(MOD_RCTL|MOD_RGUI)": 0x5519,
  "OSM(MOD_RSFT|MOD_RALT)": 0x5516,
  "OSM(MOD_RSFT|MOD_RGUI)": 0x551a,
  "OSM(MOD_RALT|MOD_RGUI)": 0x551c,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RGUI)": 0x551b,
  "OSM(MOD_RCTL|MOD_RALT|MOD_RGUI)": 0x551d,
  "OSM(MOD_RSFT|MOD_RALT|MOD_RGUI)": 0x551e,
  "OSM(MOD_MEH)": 0x5507,
  "OSM(MOD_HYPR)": 0x550f,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT)": 0x5517,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT|MOD_RGUI)": 0x551f,

  KC_GESC: 0x5c16,
  KC_LSPO: 0x5cd7,
  KC_RSPC: 0x5cd8,
  KC_LCPO: 0x5cf3,
  KC_RCPC: 0x5cf4,
  KC_LAPO: 0x5cf5,
  KC_RAPC: 0x5cf6,
  KC_SFTENT: 0x5cd9,

  MAGIC_SWAP_CONTROL_CAPSLOCK: 23554,
  MAGIC_UNSWAP_CONTROL_CAPSLOCK: 23563,
  MAGIC_CAPSLOCK_TO_CONTROL: 23555,
  MAGIC_UNCAPSLOCK_TO_CONTROL: 23564,
  MAGIC_SWAP_LCTL_LGUI: 23802,
  MAGIC_UNSWAP_LCTL_LGUI: 23804,
  MAGIC_SWAP_RCTL_RGUI: 23803,
  MAGIC_UNSWAP_RCTL_RGUI: 23805,
  MAGIC_SWAP_CTL_GUI: 23806,
  MAGIC_UNSWAP_CTL_GUI: 23807,
  MAGIC_TOGGLE_CTL_GUI: 23808,
  MAGIC_SWAP_LALT_LGUI: 23556,
  MAGIC_UNSWAP_LALT_LGUI: 23565,
  MAGIC_SWAP_RALT_RGUI: 23557,
  MAGIC_UNSWAP_RALT_RGUI: 23566,
  MAGIC_SWAP_ALT_GUI: 23562,
  MAGIC_UNSWAP_ALT_GUI: 23571,
  MAGIC_TOGGLE_ALT_GUI: 23573,
  MAGIC_NO_GUI: 23558,
  MAGIC_UNNO_GUI: 23567,
  MAGIC_SWAP_GRAVE_ESC: 23559,
  MAGIC_UNSWAP_GRAVE_ESC: 23568,
  MAGIC_SWAP_BACKSLASH_BACKSPACE: 23560,
  MAGIC_UNSWAP_BACKSLASH_BACKSPACE: 23569,
  MAGIC_HOST_NKRO: 23561,
  MAGIC_UNHOST_NKRO: 23570,
  MAGIC_TOGGLE_NKRO: 23572,
  MAGIC_EE_HANDS_LEFT: 23809,
  MAGIC_EE_HANDS_RIGHT: 23810,
  MAGIC_TOGGLE_GUI: 0x999c2,

  AU_ON: 0x5c1d,
  AU_OFF: 0x5c1e,
  AU_TOG: 0x5c1f,
  CLICKY_TOGGLE: 0x5c20,
  CLICKY_UP: 0x5c23,
  CLICKY_DOWN: 0x5c24,
  CLICKY_RESET: 0x5c25,
  MU_ON: 0x5c26,
  MU_OFF: 0x5c27,
  MU_TOG: 0x5c28,
  MU_MOD: 0x5c29,
  HPT_ON: 0x5ce6,
  HPT_OFF: 0x5ce7,
  HPT_TOG: 0x5ce8,
  HPT_RST: 0x5ce9,
  HPT_FBK: 0x5cea,
  HPT_BUZ: 0x5ceb,
  HPT_MODI: 0x5cec,
  HPT_MODD: 0x5ced,
  HPT_CONT: 0x5cee,
  HPT_CONI: 0x5cef,
  HPT_COND: 0x5cf0,
  HPT_DWLI: 0x5cf1,
  HPT_DWLD: 0x5cf2,
  KC_ASDN: 0x5c18,
  KC_ASUP: 0x5c17,
  KC_ASRP: 0x5c19,
  KC_ASON: 0x5c1b,
  KC_ASOFF: 0x5c1c,
  KC_ASTG: 0x5c1a,
  CMB_ON: 0x5cf7,
  CMB_OFF: 0x5cf8,
  CMB_TOG: 0x5cf9,

  BL_TOGG: 23743,
  BL_STEP: 23744,
  BL_BRTG: 23745,
  BL_ON: 23739,
  BL_OFF: 23740,
  BL_INC: 23742,
  BL_DEC: 23741,
  RGB_TOG: 23746,
  RGB_MOD: 23747,
  RGB_RMOD: 23748,
  RGB_HUI: 23749,
  RGB_HUD: 23750,
  RGB_SAI: 23751,
  RGB_SAD: 23752,
  RGB_VAI: 23753,
  RGB_VAD: 23754,
  RGB_SPI: 23755,
  RGB_SPD: 23756,
  RGB_M_P: 23757,
  RGB_M_B: 23758,
  RGB_M_R: 23759,
  RGB_M_SW: 23760,
  RGB_M_SN: 23761,
  RGB_M_K: 23762,
  RGB_M_X: 23763,
  RGB_M_G: 23764,
  RGB_M_T: 23765,

  KC_MS_U: 240,
  KC_MS_D: 241,
  KC_MS_L: 242,
  KC_MS_R: 243,
  KC_BTN1: 244,
  KC_BTN2: 245,
  KC_BTN3: 246,
  KC_BTN4: 247,
  KC_BTN5: 248,
  KC_WH_U: 249,
  KC_WH_D: 250,
  KC_WH_L: 251,
  KC_WH_R: 252,
  KC_ACL0: 253,
  KC_ACL1: 254,
  KC_ACL2: 255,

  DYN_REC_START1: 0x5d03,
  DYN_REC_START2: 0x5d04,
  DYN_REC_STOP: 0x5d05,
  DYN_MACRO_PLAY1: 0x5d06,
  DYN_MACRO_PLAY2: 0x5d07,

  QK_BOOT: 0x5c00,
  QK_CLEAR_EEPROM: 0x5cdf,
  FN_MO13: 0x5f10,
  FN_MO23: 0x5f11,

  // Fake placeholder values upstream uses to unbreak v5 (these features don't
  // exist in v5 firmware); deserialize() rejects anything > 0xFFFF.
  RM_ON: 0x9990,
  RM_OFF: 0x9991,
  RM_TOGG: 0x9992,
  RM_NEXT: 0x9993,
  RM_PREV: 0x9994,
  RM_HUEU: 0x9995,
  RM_HUED: 0x9996,
  RM_SATU: 0x9997,
  RM_SATD: 0x9998,
  RM_VALU: 0x9999,
  RM_VALD: 0x999a,
  RM_SPDU: 0x999b,
  RM_SPDD: 0x999c,
  QK_REBOOT: 0x999d,
  QK_CAPS_WORD_TOGGLE: 0x999e,
  QK_LAYER_LOCK: 0x999f,
  QK_REPEAT_KEY: 0x999c0,
  QK_ALT_REPEAT_KEY: 0x999c1,
};

const KC_V6: Record<string, number> = {
  QK_TO: 0x5200,
  QK_MOMENTARY: 0x5220,
  QK_DEF_LAYER: 0x5240,
  QK_PERSISTENT_DEF_LAYER: 0x52e0,
  QK_TOGGLE_LAYER: 0x5260,
  QK_ONE_SHOT_LAYER: 0x5280,
  QK_ONE_SHOT_MOD: 0x52a0,
  QK_TAP_DANCE: 0x5700,
  QK_LAYER_TAP_TOGGLE: 0x52c0,
  QK_LAYER_MOD: 0x5000,
  QK_MOD_TAP: 0x2000,
  QK_MACRO: 0x7700,
  QK_KB: 0x7e00,
  QMK_LM_SHIFT: 5,
  QMK_LM_MASK: 0x1f,

  "ALL_T(kc)": 0x2f00,
  "C_S_T(kc)": 0x2300,
  "LALT_T(kc)": 0x2400,
  "LCA_T(kc)": 0x2500,
  "LAG_T(kc)": 0x2c00,
  "LCAG_T(kc)": 0x2d00,
  "LCG_T(kc)": 0x2900,
  "LCTL_T(kc)": 0x2100,
  "LGUI_T(kc)": 0x2800,
  "LSA_T(kc)": 0x2600,
  "LSFT_T(kc)": 0x2200,
  "MEH_T(kc)": 0x2700,
  "RALT_T(kc)": 0x3400,
  "RCAG_T(kc)": 0x3d00,
  "RCG_T(kc)": 0x3900,
  "RCTL_T(kc)": 0x3100,
  "RGUI_T(kc)": 0x3800,
  "RSFT_T(kc)": 0x3200,
  "SGUI_T(kc)": 0x2a00,

  "OSM(MOD_LSFT)": 0x52a2,
  "OSM(MOD_LCTL)": 0x52a1,
  "OSM(MOD_LALT)": 0x52a4,
  "OSM(MOD_LGUI)": 0x52a8,
  "OSM(MOD_RSFT)": 0x52b2,
  "OSM(MOD_RCTL)": 0x52b1,
  "OSM(MOD_RALT)": 0x52b4,
  "OSM(MOD_RGUI)": 0x52b8,
  "OSM(MOD_LCTL|MOD_LSFT)": 0x52a3,
  "OSM(MOD_LCTL|MOD_LALT)": 0x52a5,
  "OSM(MOD_LCTL|MOD_LGUI)": 0x52a9,
  "OSM(MOD_LSFT|MOD_LALT)": 0x52a6,
  "OSM(MOD_LSFT|MOD_LGUI)": 0x52aa,
  "OSM(MOD_LALT|MOD_LGUI)": 0x52ac,
  "OSM(MOD_LCTL|MOD_LSFT|MOD_LGUI)": 0x52ab,
  "OSM(MOD_LCTL|MOD_LALT|MOD_LGUI)": 0x52ad,
  "OSM(MOD_LSFT|MOD_LALT|MOD_LGUI)": 0x52ae,
  "OSM(MOD_RCTL|MOD_RSFT)": 0x52b3,
  "OSM(MOD_RCTL|MOD_RALT)": 0x52b5,
  "OSM(MOD_RCTL|MOD_RGUI)": 0x52b9,
  "OSM(MOD_RSFT|MOD_RALT)": 0x52b6,
  "OSM(MOD_RSFT|MOD_RGUI)": 0x52ba,
  "OSM(MOD_RALT|MOD_RGUI)": 0x52bc,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RGUI)": 0x52bb,
  "OSM(MOD_RCTL|MOD_RALT|MOD_RGUI)": 0x52bd,
  "OSM(MOD_RSFT|MOD_RALT|MOD_RGUI)": 0x52be,
  "OSM(MOD_MEH)": 0x52a7,
  "OSM(MOD_HYPR)": 0x52af,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT)": 0x52b7,
  "OSM(MOD_RCTL|MOD_RSFT|MOD_RALT|MOD_RGUI)": 0x52bf,

  KC_GESC: 0x7c16,
  KC_LSPO: 0x7c1a,
  KC_RSPC: 0x7c1b,
  KC_LCPO: 0x7c18,
  KC_RCPC: 0x7c19,
  KC_LAPO: 0x7c1c,
  KC_RAPC: 0x7c1d,
  KC_SFTENT: 0x7c1e,

  MAGIC_SWAP_CONTROL_CAPSLOCK: 0x7000,
  MAGIC_UNSWAP_CONTROL_CAPSLOCK: 0x7001,
  MAGIC_CAPSLOCK_TO_CONTROL: 0x7004,
  MAGIC_UNCAPSLOCK_TO_CONTROL: 0x7003,
  MAGIC_SWAP_LCTL_LGUI: 0x7017,
  MAGIC_UNSWAP_LCTL_LGUI: 0x7018,
  MAGIC_SWAP_RCTL_RGUI: 0x7019,
  MAGIC_UNSWAP_RCTL_RGUI: 0x701a,
  MAGIC_SWAP_CTL_GUI: 0x701b,
  MAGIC_UNSWAP_CTL_GUI: 0x701c,
  MAGIC_TOGGLE_CTL_GUI: 0x701d,
  MAGIC_SWAP_LALT_LGUI: 0x7005,
  MAGIC_UNSWAP_LALT_LGUI: 0x7006,
  MAGIC_SWAP_RALT_RGUI: 0x7007,
  MAGIC_UNSWAP_RALT_RGUI: 0x7008,
  MAGIC_SWAP_ALT_GUI: 0x7014,
  MAGIC_UNSWAP_ALT_GUI: 0x7015,
  MAGIC_TOGGLE_ALT_GUI: 0x7016,
  MAGIC_NO_GUI: 0x700a,
  MAGIC_UNNO_GUI: 0x7009,
  MAGIC_TOGGLE_GUI: 0x700b,
  MAGIC_SWAP_GRAVE_ESC: 0x700c,
  MAGIC_UNSWAP_GRAVE_ESC: 0x700d,
  MAGIC_SWAP_BACKSLASH_BACKSPACE: 0x700e,
  MAGIC_UNSWAP_BACKSLASH_BACKSPACE: 0x700f,
  MAGIC_HOST_NKRO: 0x7011,
  MAGIC_UNHOST_NKRO: 0x7012,
  MAGIC_TOGGLE_NKRO: 0x7013,
  MAGIC_EE_HANDS_LEFT: 0x701e,
  MAGIC_EE_HANDS_RIGHT: 0x701f,

  AU_ON: 0x7480,
  AU_OFF: 0x7481,
  AU_TOG: 0x7482,
  CLICKY_TOGGLE: 0x748a,
  CLICKY_UP: 0x748d,
  CLICKY_DOWN: 0x748e,
  CLICKY_RESET: 0x748f,
  MU_ON: 0x7490,
  MU_OFF: 0x7491,
  MU_TOG: 0x7492,
  MU_MOD: 0x7493,
  HPT_ON: 0x7c40,
  HPT_OFF: 0x7c41,
  HPT_TOG: 0x7c42,
  HPT_RST: 0x7c43,
  HPT_FBK: 0x7c44,
  HPT_BUZ: 0x7c45,
  HPT_MODI: 0x7c46,
  HPT_MODD: 0x7c47,
  HPT_CONT: 0x7c48,
  HPT_CONI: 0x7c49,
  HPT_COND: 0x7c4a,
  HPT_DWLI: 0x7c4b,
  HPT_DWLD: 0x7c4c,
  KC_ASDN: 0x7c10,
  KC_ASUP: 0x7c11,
  KC_ASRP: 0x7c12,
  KC_ASON: 0x7c13,
  KC_ASOFF: 0x7c14,
  KC_ASTG: 0x7c15,
  CMB_ON: 0x7c50,
  CMB_OFF: 0x7c51,
  CMB_TOG: 0x7c52,

  BL_TOGG: 0x7802,
  BL_STEP: 0x7805,
  BL_BRTG: 0x7806,
  BL_ON: 0x7800,
  BL_OFF: 0x7801,
  BL_INC: 0x7804,
  BL_DEC: 0x7803,
  RGB_TOG: 0x7820,
  RGB_MOD: 0x7821,
  RGB_RMOD: 0x7822,
  RGB_HUI: 0x7823,
  RGB_HUD: 0x7824,
  RGB_SAI: 0x7825,
  RGB_SAD: 0x7826,
  RGB_VAI: 0x7827,
  RGB_VAD: 0x7828,
  RGB_SPI: 0x7829,
  RGB_SPD: 0x782a,
  RGB_M_P: 0x782b,
  RGB_M_B: 0x782c,
  RGB_M_R: 0x782d,
  RGB_M_SW: 0x782e,
  RGB_M_SN: 0x782f,
  RGB_M_K: 0x7830,
  RGB_M_X: 0x7831,
  RGB_M_G: 0x7832,
  RGB_M_T: 0x7833,

  KC_MS_U: 0xcd,
  KC_MS_D: 0xce,
  KC_MS_L: 0xcf,
  KC_MS_R: 0xd0,
  KC_BTN1: 0xd1,
  KC_BTN2: 0xd2,
  KC_BTN3: 0xd3,
  KC_BTN4: 0xd4,
  KC_BTN5: 0xd5,
  KC_WH_U: 0xd9,
  KC_WH_D: 0xda,
  KC_WH_L: 0xdb,
  KC_WH_R: 0xdc,
  KC_ACL0: 0xdd,
  KC_ACL1: 0xde,
  KC_ACL2: 0xdf,

  DYN_REC_START1: 0x7c53,
  DYN_REC_START2: 0x7c54,
  DYN_REC_STOP: 0x7c55,
  DYN_MACRO_PLAY1: 0x7c56,
  DYN_MACRO_PLAY2: 0x7c57,

  QK_BOOT: 0x7c00,
  QK_REBOOT: 0x7c01,
  QK_CLEAR_EEPROM: 0x7c03,
  QK_CAPS_WORD_TOGGLE: 0x7c73,
  FN_MO13: 0x7c77,
  FN_MO23: 0x7c78,
  QK_REPEAT_KEY: 0x7c79,
  QK_ALT_REPEAT_KEY: 0x7c7a,
  QK_LAYER_LOCK: 0x7c7b,

  RM_ON: 0x7840,
  RM_OFF: 0x7841,
  RM_TOGG: 0x7842,
  RM_NEXT: 0x7843,
  RM_PREV: 0x7844,
  RM_HUEU: 0x7845,
  RM_HUED: 0x7846,
  RM_SATU: 0x7847,
  RM_SATD: 0x7848,
  RM_VALU: 0x7849,
  RM_VALD: 0x784a,
  RM_SPDU: 0x784b,
  RM_SPDD: 0x784c,
};

/** Names that are internal helpers, never valid standalone keycodes for display. */
const HELPER_NAMES = new Set([
  "MOD_LCTL", "MOD_LSFT", "MOD_LALT", "MOD_LGUI",
  "MOD_RCTL", "MOD_RSFT", "MOD_RALT", "MOD_RGUI",
  "MOD_HYPR", "MOD_MEH", "ON_PRESS",
  "QK_LAYER_TAP", "QK_LCTL", "QK_LSFT", "QK_LALT", "QK_LGUI",
  "QK_RCTL", "QK_RSFT", "QK_RALT", "QK_RGUI",
  "QK_TO", "QK_MOMENTARY", "QK_DEF_LAYER", "QK_PERSISTENT_DEF_LAYER",
  "QK_TOGGLE_LAYER", "QK_ONE_SHOT_LAYER", "QK_ONE_SHOT_MOD", "QK_TAP_DANCE",
  "QK_LAYER_TAP_TOGGLE", "QK_LAYER_MOD", "QK_MOD_TAP", "QK_MACRO", "QK_KB",
  "QMK_LM_SHIFT", "QMK_LM_MASK",
]);

function buildNameTable(version: 5 | 6): Map<string, number> {
  const table = new Map<string, number>(Object.entries(KC_COMMON));
  const specific = version === 5 ? KC_V5 : KC_V6;
  for (const [name, value] of Object.entries(specific)) {
    table.set(name, value);
  }
  const g = (name: string): number => table.get(name)!;

  for (let x = 0; x < 256; x++) {
    table.set(`M${x}`, g("QK_MACRO") + x);
    table.set(`TD(${x})`, g("QK_TAP_DANCE") + x);
  }
  for (let x = 0; x < 32; x++) {
    table.set(`MO(${x})`, g("QK_MOMENTARY") + x);
    table.set(`DF(${x})`, g("QK_DEF_LAYER") + x);
    table.set(`TG(${x})`, g("QK_TOGGLE_LAYER") + x);
    table.set(`TT(${x})`, g("QK_LAYER_TAP_TOGGLE") + x);
    table.set(`OSL(${x})`, g("QK_ONE_SHOT_LAYER") + x);
    table.set(`TO(${x})`, version === 5 ? g("QK_TO") | (1 << 4) | x : g("QK_TO") + x);
    table.set(`PDF(${x})`, g("QK_PERSISTENT_DEF_LAYER") + x);
  }
  for (let x = 0; x < 16; x++) {
    table.set(`LT${x}(kc)`, g("QK_LAYER_TAP") | (x << 8));
  }
  for (let x = 0; x < 64; x++) {
    table.set(`USER${String(x).padStart(2, "0")}`, g("QK_KB") + x);
  }
  return table;
}

// ---------------------------------------------------------------------------
// Display keycodes (what the picker shows and what serialize() prefers)
// ---------------------------------------------------------------------------

function table(rows: ([string, string] | [string, string, boolean])[]): KeycodeDef[] {
  return rows.map(([qmkId, label, masked]) => ({ qmkId, label, ...(masked ? { masked: true } : {}) }));
}

export const KEYCODES_SPECIAL: KeycodeDef[] = table([
  ["KC_NO", ""],
  ["KC_TRNS", "▽"],
]);

export const KEYCODES_BASIC: KeycodeDef[] = table([
  ["KC_A", "A"],
  ["KC_B", "B"],
  ["KC_C", "C"],
  ["KC_D", "D"],
  ["KC_E", "E"],
  ["KC_F", "F"],
  ["KC_G", "G"],
  ["KC_H", "H"],
  ["KC_I", "I"],
  ["KC_J", "J"],
  ["KC_K", "K"],
  ["KC_L", "L"],
  ["KC_M", "M"],
  ["KC_N", "N"],
  ["KC_O", "O"],
  ["KC_P", "P"],
  ["KC_Q", "Q"],
  ["KC_R", "R"],
  ["KC_S", "S"],
  ["KC_T", "T"],
  ["KC_U", "U"],
  ["KC_V", "V"],
  ["KC_W", "W"],
  ["KC_X", "X"],
  ["KC_Y", "Y"],
  ["KC_Z", "Z"],
  ["KC_1", "!\n1"],
  ["KC_2", "@\n2"],
  ["KC_3", "#\n3"],
  ["KC_4", "$\n4"],
  ["KC_5", "%\n5"],
  ["KC_6", "^\n6"],
  ["KC_7", "&\n7"],
  ["KC_8", "*\n8"],
  ["KC_9", "(\n9"],
  ["KC_0", ")\n0"],
  ["KC_ENTER", "Enter"],
  ["KC_ESCAPE", "Esc"],
  ["KC_BSPACE", "Bksp"],
  ["KC_TAB", "Tab"],
  ["KC_SPACE", "Space"],
  ["KC_MINUS", "_\n-"],
  ["KC_EQUAL", "+\n="],
  ["KC_LBRACKET", "{\n["],
  ["KC_RBRACKET", "}\n]"],
  ["KC_BSLASH", "|\n\\"],
  ["KC_SCOLON", ":\n;"],
  ["KC_QUOTE", "\"\n'"],
  ["KC_GRAVE", "~\n`"],
  ["KC_COMMA", "<\n,"],
  ["KC_DOT", ">\n."],
  ["KC_SLASH", "?\n/"],
  ["KC_CAPSLOCK", "Caps\nLock"],
  ["KC_F1", "F1"],
  ["KC_F2", "F2"],
  ["KC_F3", "F3"],
  ["KC_F4", "F4"],
  ["KC_F5", "F5"],
  ["KC_F6", "F6"],
  ["KC_F7", "F7"],
  ["KC_F8", "F8"],
  ["KC_F9", "F9"],
  ["KC_F10", "F10"],
  ["KC_F11", "F11"],
  ["KC_F12", "F12"],
  ["KC_APPLICATION", "Menu"],
  ["KC_LCTRL", "LCtrl"],
  ["KC_LSHIFT", "LShift"],
  ["KC_LALT", "LAlt"],
  ["KC_LGUI", "LGui"],
  ["KC_RCTRL", "RCtrl"],
  ["KC_RSHIFT", "RShift"],
  ["KC_RALT", "RAlt"],
  ["KC_RGUI", "RGui"],
]);

export const KEYCODES_NUMPAD: KeycodeDef[] = table([
  ["KC_NUMLOCK", "Num\nLock"],
  ["KC_KP_SLASH", "/"],
  ["KC_KP_ASTERISK", "*"],
  ["KC_KP_MINUS", "-"],
  ["KC_KP_PLUS", "+"],
  ["KC_KP_ENTER", "Num\nEnter"],
  ["KC_KP_1", "1"],
  ["KC_KP_2", "2"],
  ["KC_KP_3", "3"],
  ["KC_KP_4", "4"],
  ["KC_KP_5", "5"],
  ["KC_KP_6", "6"],
  ["KC_KP_7", "7"],
  ["KC_KP_8", "8"],
  ["KC_KP_9", "9"],
  ["KC_KP_0", "0"],
  ["KC_KP_DOT", "."],
  ["KC_KP_EQUAL", "="],
  ["KC_KP_COMMA", ","],
]);

export const KEYCODES_NAV: KeycodeDef[] = table([
  ["KC_PSCREEN", "Print\nScreen"],
  ["KC_SCROLLLOCK", "Scroll\nLock"],
  ["KC_PAUSE", "Pause"],
  ["KC_INSERT", "Insert"],
  ["KC_HOME", "Home"],
  ["KC_PGUP", "Page\nUp"],
  ["KC_DELETE", "Del"],
  ["KC_END", "End"],
  ["KC_PGDOWN", "Page\nDown"],
  ["KC_RIGHT", "Right"],
  ["KC_LEFT", "Left"],
  ["KC_DOWN", "Down"],
  ["KC_UP", "Up"],
]);

export const KEYCODES_SHIFTED: KeycodeDef[] = table([
  ["KC_TILD", "~"],
  ["KC_EXLM", "!"],
  ["KC_AT", "@"],
  ["KC_HASH", "#"],
  ["KC_DLR", "$"],
  ["KC_PERC", "%"],
  ["KC_CIRC", "^"],
  ["KC_AMPR", "&"],
  ["KC_ASTR", "*"],
  ["KC_LPRN", "("],
  ["KC_RPRN", ")"],
  ["KC_UNDS", "_"],
  ["KC_PLUS", "+"],
  ["KC_LCBR", "{"],
  ["KC_RCBR", "}"],
  ["KC_LT", "<"],
  ["KC_GT", ">"],
  ["KC_COLN", ":"],
  ["KC_PIPE", "|"],
  ["KC_QUES", "?"],
  ["KC_DQUO", '"'],
]);

export const KEYCODES_ISO: KeycodeDef[] = table([
  ["KC_NONUS_HASH", "ISO\n#"],
  ["KC_NONUS_BSLASH", "ISO\n\\"],
  ["KC_RO", "JIS\nRo"],
  ["KC_KANA", "Kana"],
  ["KC_JYEN", "Yen"],
  ["KC_HENK", "Henkan"],
  ["KC_MHEN", "Muhenkan"],
  ["KC_LANG1", "Lang 1"],
  ["KC_LANG2", "Lang 2"],
]);

export const KEYCODES_FN: KeycodeDef[] = table([
  ["KC_F13", "F13"],
  ["KC_F14", "F14"],
  ["KC_F15", "F15"],
  ["KC_F16", "F16"],
  ["KC_F17", "F17"],
  ["KC_F18", "F18"],
  ["KC_F19", "F19"],
  ["KC_F20", "F20"],
  ["KC_F21", "F21"],
  ["KC_F22", "F22"],
  ["KC_F23", "F23"],
  ["KC_F24", "F24"],
]);

export const KEYCODES_MEDIA: KeycodeDef[] = table([
  ["KC_VOLU", "Vol\n+"],
  ["KC_VOLD", "Vol\n-"],
  ["KC_MUTE", "Mute"],
  ["KC_MPLY", "Play\nPause"],
  ["KC_MSTP", "Media\nStop"],
  ["KC_MPRV", "Prev\nTrack"],
  ["KC_MNXT", "Next\nTrack"],
  ["KC_MRWD", "Rewind"],
  ["KC_MFFD", "Fast\nFwd"],
  ["KC_EJCT", "Eject"],
  ["KC_BRIU", "Bright\n+"],
  ["KC_BRID", "Bright\n-"],
  ["KC_PWR", "Power"],
  ["KC_SLEP", "Sleep"],
  ["KC_WAKE", "Wake"],
  ["KC_CALC", "Calc"],
  ["KC_MAIL", "Mail"],
  ["KC_MSEL", "Media\nPlayer"],
  ["KC_MYCM", "My\nPC"],
  ["KC_WSCH", "Web\nSearch"],
  ["KC_WHOM", "Web\nHome"],
  ["KC_WBAK", "Web\nBack"],
  ["KC_WFWD", "Web\nFwd"],
  ["KC_WSTP", "Web\nStop"],
  ["KC_WREF", "Web\nRefresh"],
  ["KC_WFAV", "Web\nFav"],
  ["KC_EXEC", "Exec"],
  ["KC_HELP", "Help"],
  ["KC_SLCT", "Select"],
  ["KC_STOP", "Stop"],
  ["KC_AGIN", "Again"],
  ["KC_UNDO", "Undo"],
  ["KC_CUT", "Cut"],
  ["KC_COPY", "Copy"],
  ["KC_PSTE", "Paste"],
  ["KC_FIND", "Find"],
]);

export const KEYCODES_MOUSE: KeycodeDef[] = table([
  ["KC_MS_U", "Mouse\n↑"],
  ["KC_MS_D", "Mouse\n↓"],
  ["KC_MS_L", "Mouse\n←"],
  ["KC_MS_R", "Mouse\n→"],
  ["KC_BTN1", "Mouse\nBtn 1"],
  ["KC_BTN2", "Mouse\nBtn 2"],
  ["KC_BTN3", "Mouse\nBtn 3"],
  ["KC_BTN4", "Mouse\nBtn 4"],
  ["KC_BTN5", "Mouse\nBtn 5"],
  ["KC_WH_U", "Wheel\n↑"],
  ["KC_WH_D", "Wheel\n↓"],
  ["KC_WH_L", "Wheel\n←"],
  ["KC_WH_R", "Wheel\n→"],
  ["KC_ACL0", "Mouse\nSlow"],
  ["KC_ACL1", "Mouse\nMed"],
  ["KC_ACL2", "Mouse\nFast"],
]);

const MAX_DISPLAY_LAYERS = 16;

function layerKeycodes(): KeycodeDef[] {
  const defs: KeycodeDef[] = [];
  for (const fn of ["MO", "TG", "TT", "OSL", "TO", "DF"]) {
    for (let x = 0; x < MAX_DISPLAY_LAYERS; x++) {
      defs.push({ qmkId: `${fn}(${x})`, label: `${fn}(${x})` });
    }
  }
  defs.push({ qmkId: "FN_MO13", label: "Fn1\n(Fn3)" });
  defs.push({ qmkId: "FN_MO23", label: "Fn2\n(Fn3)" });
  return defs;
}

export const KEYCODES_LAYERS: KeycodeDef[] = layerKeycodes();

function ltKeycodes(): KeycodeDef[] {
  const defs: KeycodeDef[] = [];
  for (let x = 0; x < MAX_DISPLAY_LAYERS; x++) {
    defs.push({ qmkId: `LT${x}(kc)`, label: `LT ${x}\n(kc)`, masked: true });
  }
  return defs;
}

export const KEYCODES_QUANTUM: KeycodeDef[] = [
  ...table([
    ["OSM(MOD_LSFT)", "OSM\nLSft"],
    ["OSM(MOD_LCTL)", "OSM\nLCtl"],
    ["OSM(MOD_LALT)", "OSM\nLAlt"],
    ["OSM(MOD_LGUI)", "OSM\nLGUI"],
    ["OSM(MOD_RSFT)", "OSM\nRSft"],
    ["OSM(MOD_RCTL)", "OSM\nRCtl"],
    ["OSM(MOD_RALT)", "OSM\nRAlt"],
    ["OSM(MOD_RGUI)", "OSM\nRGUI"],
    ["OSM(MOD_LCTL|MOD_LSFT)", "OSM\nCS"],
    ["OSM(MOD_LCTL|MOD_LALT)", "OSM\nCA"],
    ["OSM(MOD_LCTL|MOD_LGUI)", "OSM\nCG"],
    ["OSM(MOD_LSFT|MOD_LALT)", "OSM\nSA"],
    ["OSM(MOD_LSFT|MOD_LGUI)", "OSM\nSG"],
    ["OSM(MOD_LALT|MOD_LGUI)", "OSM\nAG"],
    ["OSM(MOD_MEH)", "OSM\nMeh"],
    ["OSM(MOD_HYPR)", "OSM\nHyper"],
    ["LSFT(kc)", "LSft\n(kc)", true],
    ["LCTL(kc)", "LCtl\n(kc)", true],
    ["LALT(kc)", "LAlt\n(kc)", true],
    ["LGUI(kc)", "LGui\n(kc)", true],
    ["RSFT(kc)", "RSft\n(kc)", true],
    ["RCTL(kc)", "RCtl\n(kc)", true],
    ["RALT(kc)", "RAlt\n(kc)", true],
    ["RGUI(kc)", "RGui\n(kc)", true],
    ["C_S(kc)", "LCS\n(kc)", true],
    ["LCA(kc)", "LCA\n(kc)", true],
    ["LSA(kc)", "LSA\n(kc)", true],
    ["LAG(kc)", "LAG\n(kc)", true],
    ["LCAG(kc)", "LCAG\n(kc)", true],
    ["LCG(kc)", "LCG\n(kc)", true],
    ["RCG(kc)", "RCG\n(kc)", true],
    ["SGUI(kc)", "SGui\n(kc)", true],
    ["MEH(kc)", "Meh\n(kc)", true],
    ["HYPR(kc)", "Hyper\n(kc)", true],
    ["LSFT_T(kc)", "LSft_T\n(kc)", true],
    ["LCTL_T(kc)", "LCtl_T\n(kc)", true],
    ["LALT_T(kc)", "LAlt_T\n(kc)", true],
    ["LGUI_T(kc)", "LGui_T\n(kc)", true],
    ["RSFT_T(kc)", "RSft_T\n(kc)", true],
    ["RCTL_T(kc)", "RCtl_T\n(kc)", true],
    ["RALT_T(kc)", "RAlt_T\n(kc)", true],
    ["RGUI_T(kc)", "RGui_T\n(kc)", true],
    ["C_S_T(kc)", "LCS_T\n(kc)", true],
    ["LCA_T(kc)", "LCA_T\n(kc)", true],
    ["LSA_T(kc)", "LSA_T\n(kc)", true],
    ["LAG_T(kc)", "LAG_T\n(kc)", true],
    ["LCAG_T(kc)", "LCAG_T\n(kc)", true],
    ["RCAG_T(kc)", "RCAG_T\n(kc)", true],
    ["LCG_T(kc)", "LCG_T\n(kc)", true],
    ["RCG_T(kc)", "RCG_T\n(kc)", true],
    ["SGUI_T(kc)", "SGui_T\n(kc)", true],
    ["MEH_T(kc)", "Meh_T\n(kc)", true],
    ["ALL_T(kc)", "Hyper_T\n(kc)", true],
  ]),
  ...ltKeycodes(),
  ...table([
    ["KC_GESC", "Esc\n~"],
    ["KC_LSPO", "LS\n("],
    ["KC_RSPC", "RS\n)"],
    ["KC_LCPO", "LC\n("],
    ["KC_RCPC", "RC\n)"],
    ["KC_LAPO", "LA\n("],
    ["KC_RAPC", "RA\n)"],
    ["KC_SFTENT", "RS\nEnter"],
    ["QK_CAPS_WORD_TOGGLE", "Caps\nWord"],
    ["QK_LAYER_LOCK", "Layer\nLock"],
    ["QK_REPEAT_KEY", "Repeat"],
    ["QK_ALT_REPEAT_KEY", "Alt\nRepeat"],
    ["QK_BOOT", "Boot-\nloader"],
    ["QK_CLEAR_EEPROM", "Clear\nEEPROM"],
  ]),
];

function macroKeycodes(): KeycodeDef[] {
  const defs: KeycodeDef[] = [];
  for (let x = 0; x < 16; x++) {
    defs.push({ qmkId: `M${x}`, label: `M${x}` });
  }
  return defs;
}

export const KEYCODES_MACRO: KeycodeDef[] = macroKeycodes();

export const KEYCODES_LIGHTING: KeycodeDef[] = table([
  ["BL_TOGG", "BL\nToggle"],
  ["BL_STEP", "BL\nCycle"],
  ["BL_BRTG", "BL\nBreath"],
  ["BL_ON", "BL\nOn"],
  ["BL_OFF", "BL\nOff"],
  ["BL_INC", "BL\n+"],
  ["BL_DEC", "BL\n-"],
  ["RGB_TOG", "RGB\nToggle"],
  ["RGB_MOD", "RGB\nMode +"],
  ["RGB_RMOD", "RGB\nMode -"],
  ["RGB_HUI", "Hue\n+"],
  ["RGB_HUD", "Hue\n-"],
  ["RGB_SAI", "Sat\n+"],
  ["RGB_SAD", "Sat\n-"],
  ["RGB_VAI", "Bright\n+"],
  ["RGB_VAD", "Bright\n-"],
  ["RGB_SPI", "Effect\n+"],
  ["RGB_SPD", "Effect\n-"],
  ["RGB_M_P", "RGB\nPlain"],
  ["RGB_M_B", "RGB\nBreath"],
  ["RGB_M_R", "RGB\nRainbow"],
  ["RGB_M_SW", "RGB\nSwirl"],
  ["RGB_M_SN", "RGB\nSnake"],
  ["RGB_M_K", "RGB\nKnight"],
  ["RGB_M_X", "RGB\nXmas"],
  ["RGB_M_G", "RGB\nGradient"],
  ["RGB_M_T", "RGB\nTest"],
]);

export const KEYCODE_CATEGORIES: { name: string; entries: KeycodeDef[] }[] = [
  { name: "Basic", entries: [...KEYCODES_SPECIAL, ...KEYCODES_BASIC] },
  { name: "Numpad", entries: KEYCODES_NUMPAD },
  { name: "Navigation", entries: KEYCODES_NAV },
  { name: "Shifted", entries: KEYCODES_SHIFTED },
  { name: "ISO/International", entries: KEYCODES_ISO },
  { name: "Fn keys", entries: KEYCODES_FN },
  { name: "Layers", entries: KEYCODES_LAYERS },
  { name: "Quantum", entries: KEYCODES_QUANTUM },
  { name: "Macros", entries: KEYCODES_MACRO },
  { name: "Media", entries: KEYCODES_MEDIA },
  { name: "Mouse", entries: KEYCODES_MOUSE },
  { name: "Lighting", entries: KEYCODES_LIGHTING },
];

const ALL_DISPLAY: KeycodeDef[] = KEYCODE_CATEGORIES.flatMap((c) => c.entries);
const displayByQmkId = new Map(ALL_DISPLAY.map((e) => [e.qmkId, e]));

// ---------------------------------------------------------------------------
// Version-dependent lookup state
// ---------------------------------------------------------------------------

interface VersionState {
  nameToCode: Map<string, number>;
  /** Display-priority reverse map for serialize(). */
  codeToName: Map<number, string>;
  /** base value (code & 0xFF00) -> template qmk_id like "LCTL_T(kc)" */
  baseToTemplate: Map<number, string>;
  maskedBases: Set<number>;
}

function buildState(version: 5 | 6): VersionState {
  const nameToCode = buildNameTable(version);
  const codeToName = new Map<number, string>();
  const baseToTemplate = new Map<number, string>();
  const maskedBases = new Set<number>();

  for (const [name, code] of nameToCode) {
    if (name.endsWith("(kc)")) {
      maskedBases.add(code);
      if (!baseToTemplate.has(code)) {
        baseToTemplate.set(code, name);
      }
    }
  }

  // Curated display entries take priority for reverse lookup...
  for (const def of ALL_DISPLAY) {
    if (def.masked) {
      continue;
    }
    const code = nameToCode.get(def.qmkId);
    if (code !== undefined && !codeToName.has(code)) {
      codeToName.set(code, def.qmkId);
    }
  }
  // ...then every other resolvable name (M16-255, TD(n), USER..., OSM variants
  // beyond the curated list, etc.) so serialize() still round-trips them.
  for (const [name, code] of nameToCode) {
    if (name.endsWith("(kc)") || HELPER_NAMES.has(name)) {
      continue;
    }
    if (!codeToName.has(code)) {
      codeToName.set(code, name);
    }
  }

  return { nameToCode, codeToName, baseToTemplate, maskedBases };
}

const STATES: Record<5 | 6, VersionState> = { 5: buildState(5), 6: buildState(6) };

let keycodeVersion: 5 | 6 = 5;

/** Selects the keycode value table matching the device's vial protocol. */
export function setKeycodeVersion(vialProtocol: number): void {
  keycodeVersion = vialProtocol >= 6 ? 6 : 5;
}

function state(): VersionState {
  return STATES[keycodeVersion];
}

// ---------------------------------------------------------------------------
// Parameterized keycode expression parser (subset of vial-gui's AnyKeycode)
// ---------------------------------------------------------------------------

type KcFunc = (args: number[]) => number;

function buildFuncs(): Record<string, KcFunc> {
  const r = (name: string): number => {
    const v = state().nameToCode.get(name);
    if (v === undefined) {
      throw new Error(`unknown constant ${name}`);
    }
    return v;
  };
  const one = (f: (a: number) => number): KcFunc => (args) => {
    if (args.length !== 1) {
      throw new Error("expected 1 argument");
    }
    return f(args[0]);
  };
  const two = (f: (a: number, b: number) => number): KcFunc => (args) => {
    if (args.length !== 2) {
      throw new Error("expected 2 arguments");
    }
    return f(args[0], args[1]);
  };

  const LCTL = one((kc) => r("QK_LCTL") | kc);
  const LSFT = one((kc) => r("QK_LSFT") | kc);
  const LALT = one((kc) => r("QK_LALT") | kc);
  const LGUI = one((kc) => r("QK_LGUI") | kc);
  const RCTL = one((kc) => r("QK_RCTL") | kc);
  const RSFT = one((kc) => r("QK_RSFT") | kc);
  const RALT = one((kc) => r("QK_RALT") | kc);
  const RGUI = one((kc) => r("QK_RGUI") | kc);
  const C_S = one((kc) => r("QK_LCTL") | r("QK_LSFT") | kc);
  const HYPR = one((kc) => r("QK_LCTL") | r("QK_LSFT") | r("QK_LALT") | r("QK_LGUI") | kc);
  const MEH = one((kc) => r("QK_LCTL") | r("QK_LSFT") | r("QK_LALT") | kc);
  const LCAG = one((kc) => r("QK_LCTL") | r("QK_LALT") | r("QK_LGUI") | kc);
  const SGUI = one((kc) => r("QK_LGUI") | r("QK_LSFT") | kc);
  const LCA = one((kc) => r("QK_LCTL") | r("QK_LALT") | kc);
  const LSA = one((kc) => r("QK_LSFT") | r("QK_LALT") | kc);
  const LAG = one((kc) => r("QK_LALT") | r("QK_LGUI") | kc);
  const RSA = one((kc) => r("QK_RSFT") | r("QK_RALT") | kc);
  const RCS = one((kc) => r("QK_RCTL") | r("QK_RSFT") | kc);
  const LCG = one((kc) => r("QK_LCTL") | r("QK_LGUI") | kc);
  const RCG = one((kc) => r("QK_RCTL") | r("QK_RGUI") | kc);

  const MT = two((mod, kc) => r("QK_MOD_TAP") | ((mod & 0x1f) << 8) | (kc & 0xff));
  const mt = (mods: string[]): KcFunc =>
    one((kc) => MT([mods.reduce((acc, m) => acc | r(m), 0), kc]));

  const funcs: Record<string, KcFunc> = {
    LCTL, LSFT, LALT, LGUI, LOPT: LALT, LCMD: LGUI, LWIN: LGUI,
    RCTL, RSFT, RALT, RGUI, ALGR: RALT, ROPT: RALT, RCMD: RGUI, RWIN: RGUI,
    HYPR, MEH, LCAG, SGUI, SCMD: SGUI, SWIN: SGUI, LSG: SGUI,
    C_S, LCA, LSA, LAG, RSA, RCS, SAGR: RSA, LCG, RCG,
    C: LCTL, S: LSFT, A: LALT, G: LGUI,
    LT: two((layer, kc) => r("QK_LAYER_TAP") | ((layer & 0xf) << 8) | (kc & 0xff)),
    TO: one((layer) => r("QK_TO") | (keycodeVersion === 5 ? r("ON_PRESS") << 4 : 0) | (layer & 0xff)),
    MO: one((layer) => r("QK_MOMENTARY") | (layer & 0xff)),
    DF: one((layer) => r("QK_DEF_LAYER") | (layer & 0xff)),
    TG: one((layer) => r("QK_TOGGLE_LAYER") | (layer & 0xff)),
    OSL: one((layer) => r("QK_ONE_SHOT_LAYER") | (layer & 0xff)),
    LM: two((layer, mod) => r("QK_LAYER_MOD") | ((layer & 0xf) << r("QMK_LM_SHIFT")) | (mod & r("QMK_LM_MASK"))),
    OSM: one((mod) => r("QK_ONE_SHOT_MOD") | (mod & 0xff)),
    TT: one((layer) => r("QK_LAYER_TAP_TOGGLE") | (layer & 0xff)),
    MT,
    TD: one((n) => r("QK_TAP_DANCE") | (n & 0xff)),
    PDF: one((layer) => r("QK_PERSISTENT_DEF_LAYER") + (layer & 0xff)),
    LCTL_T: mt(["MOD_LCTL"]), RCTL_T: mt(["MOD_RCTL"]), CTL_T: mt(["MOD_LCTL"]),
    LSFT_T: mt(["MOD_LSFT"]), RSFT_T: mt(["MOD_RSFT"]), SFT_T: mt(["MOD_LSFT"]),
    LALT_T: mt(["MOD_LALT"]), RALT_T: mt(["MOD_RALT"]), LOPT_T: mt(["MOD_LALT"]),
    ROPT_T: mt(["MOD_RALT"]), ALGR_T: mt(["MOD_RALT"]), ALT_T: mt(["MOD_LALT"]), OPT_T: mt(["MOD_LALT"]),
    LGUI_T: mt(["MOD_LGUI"]), RGUI_T: mt(["MOD_RGUI"]), LCMD_T: mt(["MOD_LGUI"]), LWIN_T: mt(["MOD_LGUI"]),
    RCMD_T: mt(["MOD_RGUI"]), RWIN_T: mt(["MOD_RGUI"]), GUI_T: mt(["MOD_LGUI"]), CMD_T: mt(["MOD_LGUI"]), WIN_T: mt(["MOD_LGUI"]),
    C_S_T: mt(["MOD_LCTL", "MOD_LSFT"]),
    MEH_T: mt(["MOD_LCTL", "MOD_LSFT", "MOD_LALT"]),
    LCAG_T: mt(["MOD_LCTL", "MOD_LALT", "MOD_LGUI"]),
    RCAG_T: mt(["MOD_RCTL", "MOD_RALT", "MOD_RGUI"]),
    HYPR_T: mt(["MOD_LCTL", "MOD_LSFT", "MOD_LALT", "MOD_LGUI"]),
    ALL_T: mt(["MOD_LCTL", "MOD_LSFT", "MOD_LALT", "MOD_LGUI"]),
    SGUI_T: mt(["MOD_LGUI", "MOD_LSFT"]), SCMD_T: mt(["MOD_LGUI", "MOD_LSFT"]),
    SWIN_T: mt(["MOD_LGUI", "MOD_LSFT"]), LSG_T: mt(["MOD_LGUI", "MOD_LSFT"]),
    LCA_T: mt(["MOD_LCTL", "MOD_LALT"]),
    LSA_T: mt(["MOD_LSFT", "MOD_LALT"]),
    LAG_T: mt(["MOD_LALT", "MOD_LGUI"]),
    RSA_T: mt(["MOD_RSFT", "MOD_RALT"]), SAGR_T: mt(["MOD_RSFT", "MOD_RALT"]),
    RCS_T: mt(["MOD_RCTL", "MOD_RSFT"]),
    LCG_T: mt(["MOD_LCTL", "MOD_LGUI"]),
    RCG_T: mt(["MOD_RCTL", "MOD_RGUI"]),
  };
  for (let x = 0; x < 16; x++) {
    funcs[`LT${x}`] = one((kc) => r("QK_LAYER_TAP") | (x << 8) | (kc & 0xff));
  }
  return funcs;
}

interface Parser {
  input: string;
  pos: number;
}

function skipWs(p: Parser): void {
  while (p.pos < p.input.length && p.input[p.pos] === " ") {
    p.pos++;
  }
}

function parseExpr(p: Parser, funcs: Record<string, KcFunc>): number {
  let value = parseTerm(p, funcs);
  skipWs(p);
  while (p.pos < p.input.length && p.input[p.pos] === "|") {
    p.pos++;
    value |= parseTerm(p, funcs);
    skipWs(p);
  }
  return value;
}

function parseTerm(p: Parser, funcs: Record<string, KcFunc>): number {
  skipWs(p);
  const rest = p.input.slice(p.pos);

  const num = /^(0[xX][0-9a-fA-F]+|\d+)/.exec(rest);
  if (num) {
    p.pos += num[0].length;
    return Number.parseInt(num[0], num[0].toLowerCase().startsWith("0x") ? 16 : 10);
  }

  const ident = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
  if (!ident) {
    throw new Error(`unexpected character at "${rest}"`);
  }
  const name = ident[0];
  p.pos += name.length;
  skipWs(p);

  if (p.input[p.pos] === "(") {
    const fn = funcs[name];
    if (!fn) {
      throw new Error(`unknown function ${name}`);
    }
    p.pos++;
    const args: number[] = [parseExpr(p, funcs)];
    skipWs(p);
    while (p.input[p.pos] === ",") {
      p.pos++;
      args.push(parseExpr(p, funcs));
      skipWs(p);
    }
    if (p.input[p.pos] !== ")") {
      throw new Error(`expected ")" in ${p.input}`);
    }
    p.pos++;
    return fn(args);
  }

  const value = state().nameToCode.get(name);
  if (value === undefined) {
    throw new Error(`unknown keycode ${name}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Converts an integer keycode (as read from the device) to its qmk_id string. */
export function serialize(code: number): string {
  const s = state();
  if (s.maskedBases.has(code & 0xff00)) {
    const outer = s.baseToTemplate.get(code & 0xff00);
    const inner = s.codeToName.get(code & 0x00ff);
    if (outer && inner) {
      return outer.replace("kc", inner);
    }
  } else {
    const name = s.codeToName.get(code);
    if (name) {
      return name;
    }
  }
  return "0x" + code.toString(16);
}

/**
 * Converts a qmk_id string — a plain name, a composite expression like
 * "LT(2,KC_A)" / "LT2(KC_A)" / "LSFT(KC_1)", or a "0x.." literal — to its
 * integer keycode. Throws on anything unparseable or outside the 16-bit range
 * the VIA protocol can carry (e.g. features faked in the v5 table).
 */
export function deserialize(qmkId: string): number {
  const direct = state().nameToCode.get(qmkId);
  let value: number;
  if (direct !== undefined) {
    value = direct;
  } else {
    const p: Parser = { input: qmkId, pos: 0 };
    value = parseExpr(p, buildFuncs());
    skipWs(p);
    if (p.pos !== qmkId.length) {
      throw new Error(`unexpected trailing input in "${qmkId}"`);
    }
  }
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`keycode ${qmkId} (${value}) is not supported by this protocol version`);
  }
  return value;
}

/** Whether qmkId resolves to a basic (8-bit) keycode usable inside masked templates. */
export function isBasicQmkId(qmkId: string): boolean {
  try {
    return deserialize(qmkId) <= 0xff;
  } catch {
    return false;
  }
}

/**
 * Runtime behaviour of a composite keycode, discriminated by `kind` so callers
 * can describe each shape *accurately* instead of forcing everything into a
 * tap/hold mould (see {@link dualRole}, which flattens the first three cases):
 *
 * - `modTap` — Mod-Tap (`LCTL_T(KC_A)`): genuinely tap `inner` / hold the
 *   modifier `role`.
 * - `layerTap` — Layer-Tap (`LT(2,KC_A)` / serialized `LT2(KC_A)`): genuinely
 *   tap `inner` / hold to activate `layer` (`role` is its short "L2" label).
 * - `modCombo` — masked modifier (`LSFT(KC_A)`, `C_S(KC_A)`, `HYPR(KC_A)`…):
 *   fires the modifier `role` **together with** `inner` on a single press. This
 *   is NOT a tap/hold key even though it shares the `fn(kc)` shape.
 * - `plain` — anything else: a single action, no second role.
 */
export type KeyBehavior =
  | { kind: "modTap"; inner: string; role: string }
  | { kind: "layerTap"; inner: string; role: string; layer: number }
  | { kind: "modCombo"; inner: string; role: string }
  | { kind: "plain" };

export function keyBehavior(qmkId: string): KeyBehavior {
  const composite = /^([A-Za-z0-9_]+)\((.+)\)$/.exec(qmkId);
  if (!composite) {
    return { kind: "plain" };
  }
  const [, fn, arg] = composite;
  // Layer-Tap, canonical two-arg form LT(<layer>,kc).
  if (fn === "LT") {
    const comma = arg.indexOf(",");
    if (comma < 0) {
      return { kind: "plain" };
    }
    const layer = Number.parseInt(arg.slice(0, comma).trim(), 10);
    return { kind: "layerTap", inner: arg.slice(comma + 1).trim(), role: `L${layer}`, layer };
  }
  // Layer-Tap, serialized one-arg form LT<n>(kc).
  const ltN = /^LT(\d+)$/.exec(fn);
  if (ltN) {
    const layer = Number.parseInt(ltN[1], 10);
    return { kind: "layerTap", inner: arg, role: `L${layer}`, layer };
  }
  // Mod-Tap <mods>_T(kc): the display template's first line is the modifier
  // label plus a "_T" suffix (e.g. "LCtl_T"), which we strip for the role label.
  if (fn.endsWith("_T")) {
    const tmpl = displayByQmkId.get(`${fn}(kc)`);
    const role = (tmpl ? tmpl.label.split("\n")[0] : fn).replace(/_T$/, "");
    return { kind: "modTap", inner: arg, role };
  }
  // Masked modifier <mods>(kc): every one has a `${fn}(kc)` display template
  // (the `_T` Mod-Tap variants were already handled above, so a surviving match
  // is always a masked mod). The template's first line is the modifier label
  // (e.g. "LSft", "Hyper") — no `_T` suffix to strip — which becomes the role.
  const maskTmpl = displayByQmkId.get(`${fn}(kc)`);
  if (maskTmpl) {
    return { kind: "modCombo", inner: arg, role: maskTmpl.label.split("\n")[0] };
  }
  return { kind: "plain" };
}

/**
 * Splits a dual-role tap/hold keycode into its two independent actions, or
 * returns null for everything else. `tap` is the qmk_id fired on a normal press
 * (the inner key, e.g. `KC_A`); `hold` is a short label for the second role
 * (e.g. `LCtl`, `L2`). Covers Mod-Tap (`LCTL_T(KC_A)`), Layer-Tap
 * (`LT2(KC_A)` serialized, or the canonical `LT(2,KC_A)`), and masked-modifier
 * combos (`LSFT(KC_A)`, `C_S(KC_A)`, `HYPR(KC_A)`…).
 *
 * A masked modifier fires both roles *together* rather than distinguishing tap
 * from hold, so it isn't literally a tap/hold key — but we still surface it as
 * dual-role so the modifier renders in the hold band and can be retargeted via
 * the shared hold editor. NOTE: that editor rebuilds the hold as a real Mod-Tap
 * (`MT(...)`), i.e. editing converts the fire-together masked form into an
 * actual tap/hold — an accepted trade-off for one unified editor. Callers that
 * need to tell these shapes apart (e.g. the hover info card) should use
 * {@link keyBehavior} instead.
 */
export function dualRole(qmkId: string): { tap: string; hold: string } | null {
  const b = keyBehavior(qmkId);
  return b.kind === "plain" ? null : { tap: b.inner, hold: b.role };
}

export type HoldInfo =
  | { type: "mod"; ctrl: boolean; shift: boolean; alt: boolean; gui: boolean; side: "L" | "R" }
  | { type: "layer"; layer: number };

/**
 * Structured view of a dual-role key's hold action, for the dual-role editor:
 * either the modifier set + side of a Mod-Tap (or masked modifier — both carry
 * the same mod bits in the keycode's high byte), or the target layer of a
 * Layer-Tap. Returns null for non-dual-role keys. Companion to {@link dualRole},
 * which labels the hold half rather than decomposing it.
 */
export function holdInfo(qmkId: string): HoldInfo | null {
  const composite = /^([A-Za-z0-9_]+)\((.+)\)$/.exec(qmkId);
  if (!composite || !dualRole(qmkId)) {
    return null;
  }
  const [, fn, arg] = composite;
  if (fn === "LT") {
    return { type: "layer", layer: Number.parseInt(arg.slice(0, arg.indexOf(",")).trim(), 10) };
  }
  const ltN = /^LT(\d+)$/.exec(fn);
  if (ltN) {
    return { type: "layer", layer: Number.parseInt(ltN[1], 10) };
  }
  // Mod-Tap: the modifier mask sits in bits 8-12 of the keycode — the low nibble
  // is Ctrl/Shift/Alt/GUI and bit 4 flags the right-hand side. The QK_MOD_TAP
  // base bits fall outside the 0x1f mask, so this is version-independent.
  const mask = (deserialize(qmkId) >> 8) & 0x1f;
  return {
    type: "mod",
    ctrl: (mask & 0x01) !== 0,
    shift: (mask & 0x02) !== 0,
    alt: (mask & 0x04) !== 0,
    gui: (mask & 0x08) !== 0,
    side: (mask & 0x10) !== 0 ? "R" : "L",
  };
}

/**
 * Returns qmkId with its tap (inner) key swapped for newTap while keeping the
 * hold role — used when the user edits only the tap half of a dual-role cap.
 * newTap must be a basic (8-bit) keycode; a non-basic inner throws so the caller
 * can surface it.
 */
export function withTap(qmkId: string, newTap: string): string {
  const composite = /^([A-Za-z0-9_]+)\((.+)\)$/.exec(qmkId);
  if (!composite) {
    return qmkId;
  }
  const [, fn, arg] = composite;
  const expr = fn === "LT" ? `LT(${arg.slice(0, arg.indexOf(",")).trim()},${newTap})` : `${fn}(${newTap})`;
  return serialize(deserialize(expr));
}

/** Builds a Layer-Tap qmk_id from a layer number + tap key. */
export function buildLayerTap(layer: number, tap: string): string {
  return serialize(deserialize(`LT(${layer},${tap})`));
}

/**
 * Builds a Mod-Tap qmk_id from a modifier selection + tap key. With no modifier
 * selected the hold is meaningless, so it collapses to the plain tap key —
 * that's how the dual-role editor "removes" the hold role from a cap.
 */
export function buildModTap(
  mods: { ctrl: boolean; shift: boolean; alt: boolean; gui: boolean; side: "L" | "R" },
  tap: string,
): string {
  const p = mods.side === "R" ? "MOD_R" : "MOD_L";
  const names: string[] = [];
  if (mods.ctrl) names.push(`${p}CTL`);
  if (mods.shift) names.push(`${p}SFT`);
  if (mods.alt) names.push(`${p}ALT`);
  if (mods.gui) names.push(`${p}GUI`);
  if (names.length === 0) {
    return tap;
  }
  return serialize(deserialize(`MT(${names.join("|")},${tap})`));
}

/** Basic modifier keycode → its Mod-Tap MOD_ constant (both spellings mapped). */
const HOLD_MOD_FROM_BASIC: Record<string, string> = {
  KC_LCTRL: "MOD_LCTL", KC_LCTL: "MOD_LCTL",
  KC_LSHIFT: "MOD_LSFT", KC_LSFT: "MOD_LSFT",
  KC_LALT: "MOD_LALT",
  KC_LGUI: "MOD_LGUI",
  KC_RCTRL: "MOD_RCTL", KC_RCTL: "MOD_RCTL",
  KC_RSHIFT: "MOD_RSFT", KC_RSFT: "MOD_RSFT",
  KC_RALT: "MOD_RALT",
  KC_RGUI: "MOD_RGUI",
};

/**
 * Recombines a keycode picked from the general picker into the *hold* action of
 * a cap, keeping the existing tap key. The pick is interpreted as a hold:
 * a momentary layer `MO(n)` becomes a Layer-Tap, a plain modifier (`KC_LCTRL`…)
 * becomes a Mod-Tap. Anything that can't act as a hold falls back to replacing
 * the whole cap with the pick. `current` may be plain (adds a hold to it) or
 * already dual-role (its tap is preserved).
 */
export function withHold(current: string, pickedHold: string): string {
  const tap = dualRole(current)?.tap ?? current;
  const mo = /^MO\((\d+)\)$/.exec(pickedHold);
  if (mo) {
    return buildLayerTap(Number.parseInt(mo[1], 10), tap);
  }
  const mod = HOLD_MOD_FROM_BASIC[pickedHold];
  if (mod) {
    return serialize(deserialize(`MT(${mod},${tap})`));
  }
  return pickedHold;
}

// ---------------------------------------------------------------------------
// Device-specific keycodes (custom keycodes + tap dance)
// ---------------------------------------------------------------------------
//
// These aren't part of the fixed tables: their names, labels and counts come
// from the connected keyboard's vial.json / dynamic-entry counts, so the UI and
// label() resolve them through this registry, set once per device on connect
// (mirroring setKeycodeVersion). Custom keycodes occupy the USER00.. (QK_KB)
// slots; tap dance uses TD(n).

/** One `customKeycodes` entry from a device's vial.json. */
export interface CustomKeycode {
  name: string;
  title?: string;
  shortName?: string;
}

let customKeycodeDefsCache: KeycodeDef[] = [];
let tapDanceDefsCache: KeycodeDef[] = [];
/** qmk_id -> display label for whatever the connected device defines. */
const deviceLabelByQmkId = new Map<string, string>();

/**
 * Registers the connected keyboard's custom keycodes (from vial.json's
 * `customKeycodes`). The i-th entry maps to the `USER0i` slot; its `shortName`
 * (falling back to `name`) becomes the keycap/button label. Pass `[]` to clear.
 */
export function setCustomKeycodes(list: CustomKeycode[]): void {
  customKeycodeDefsCache = [];
  for (const [i, c] of list.entries()) {
    if (i >= 16) break;
    const qmkId = `USER${String(i).padStart(2, "0")}`;
    const short = (c.shortName || c.name || qmkId).trim();
    if (!short || short === qmkId) continue;
    deviceLabelByQmkId.set(qmkId, short);
    customKeycodeDefsCache.push({ qmkId, label: short, title: c.title || c.name });
  }
}

/** Registers how many tap-dance slots the device exposes, as TD(0)..TD(n-1). */
export function setTapDanceCount(count: number): void {
  tapDanceDefsCache = [];
  for (let i = 0; i < count; i++) {
    const qmkId = `TD(${i})`;
    deviceLabelByQmkId.set(qmkId, `TD${i}`);
    tapDanceDefsCache.push({ qmkId, label: `TD${i}` });
  }
}

/** The connected device's custom keycodes, for building a picker tab. */
export function customKeycodeDefs(): readonly KeycodeDef[] {
  return customKeycodeDefsCache;
}

/** The connected device's tap-dance keycodes, for building a picker tab. */
export function tapDanceKeycodeDefs(): readonly KeycodeDef[] {
  return tapDanceDefsCache;
}

/** Human-readable label for a qmk_id (or raw hex fallback identifier). */
export function label(qmkId: string): string {
  const device = deviceLabelByQmkId.get(qmkId);
  if (device) {
    return device;
  }
  const def = displayByQmkId.get(qmkId);
  if (def) {
    return def.label;
  }
  const composite = /^([A-Za-z0-9_]+)\((.+)\)$/.exec(qmkId);
  if (composite) {
    const tmpl = displayByQmkId.get(`${composite[1]}(kc)`);
    if (tmpl) {
      const inner = label(composite[2]).split("\n").join(" ");
      return tmpl.label.replace("(kc)", inner);
    }
  }
  return qmkId;
}
