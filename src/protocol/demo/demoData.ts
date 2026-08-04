// Initial firmware state MockHidTransport (./mockHidTransport.ts) reports for the preview-mode
// keyboard described in demoDefinition.ts — the keymap, encoder assignments, tap dance/combo
// entries, macros, and QMK Settings defaults a real vial-qmk build would have baked in.
//
// Kept dependency-free like demoDefinition.ts (no imports from the rest of src/) other than the
// qsid constants, which are just numeric identifiers.
import {
  QMK_SETTINGS_QSID_CHORDAL_HOLD,
  QMK_SETTINGS_QSID_COMBO_TERM,
  QMK_SETTINGS_QSID_FLOW_TAP,
  QMK_SETTINGS_QSID_GRAVE_ESCAPE,
  QMK_SETTINGS_QSID_HOLD_ON_OTHER_KEY_PRESS,
  QMK_SETTINGS_QSID_MAGIC,
  QMK_SETTINGS_QSID_MOUSEKEY_DELAY,
  QMK_SETTINGS_QSID_MOUSEKEY_INTERVAL,
  QMK_SETTINGS_QSID_MOUSEKEY_MAX_SPEED,
  QMK_SETTINGS_QSID_MOUSEKEY_STEP_SIZE,
  QMK_SETTINGS_QSID_MOUSEKEY_TIME_TO_MAX,
  QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_DELAY,
  QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_INTERVAL,
  QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_MAX_SPEED,
  QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_TIME_TO_MAX,
  QMK_SETTINGS_QSID_ONESHOT_TAP_TOGGLE,
  QMK_SETTINGS_QSID_ONESHOT_TIMEOUT,
  QMK_SETTINGS_QSID_PERMISSIVE_HOLD,
  QMK_SETTINGS_QSID_QUICK_TAP_TERM,
  QMK_SETTINGS_QSID_RETRO_TAPPING,
  QMK_SETTINGS_QSID_TAP_CODE_DELAY,
  QMK_SETTINGS_QSID_TAP_HOLD_CAPS_DELAY,
  QMK_SETTINGS_QSID_TAP_HOLD_FLAGS,
  QMK_SETTINGS_QSID_TAPPING_TERM,
  QMK_SETTINGS_QSID_TAPPING_TOGGLE,
  type ComboEntry,
  type MacroAction,
  type TapDanceEntry,
} from "../keyboard.ts";

export const DEMO_LAYER_COUNT = 4;

/** `${row},${col}` -> qmk_id, one map per layer. Positions not listed default to KC_TRNS (layers 1-3) or KC_NO. */
const LAYER0: Record<string, string> = {
  "0,0": "KC_ESCAPE",
  "0,1": "KC_1",
  "0,2": "KC_2",
  "0,3": "KC_3",
  "0,4": "KC_4",
  "0,5": "KC_5",
  "0,6": "KC_6",
  "0,7": "KC_7",
  "0,8": "KC_8",
  "0,9": "KC_9",
  "0,10": "KC_0",
  "0,11": "KC_MINUS",
  "0,12": "KC_EQUAL",
  "0,13": "KC_BSPACE",
  "0,14": "KC_DELETE",
  "1,0": "KC_TAB",
  "1,1": "KC_Q",
  "1,2": "KC_W",
  "1,3": "KC_E",
  "1,4": "KC_R",
  "1,5": "KC_T",
  "1,6": "KC_Y",
  "1,7": "KC_U",
  "1,8": "KC_I",
  "1,9": "KC_O",
  "1,10": "KC_P",
  "1,11": "KC_LBRACKET",
  "1,12": "KC_RBRACKET",
  "1,13": "KC_BSLASH",
  "1,14": "KC_PGUP",
  "2,0": "TD(0)",
  "2,1": "KC_A",
  "2,2": "KC_S",
  "2,3": "KC_D",
  "2,4": "KC_F",
  "2,5": "KC_G",
  "2,6": "KC_H",
  "2,7": "KC_J",
  "2,8": "KC_K",
  "2,9": "KC_L",
  "2,10": "KC_SCOLON",
  "2,11": "KC_QUOTE",
  "2,12": "KC_ENTER",
  "2,13": "KC_PGDOWN",
  // The knob's push switch (drawn in the knob's cell, see demoDefinition.ts).
  // Mute is what a volume knob's press does on practically every board.
  "2,14": "KC_MUTE",
  "3,0": "KC_LSHIFT",
  // The 1u key split off the left shift — an ISO backslash, the usual filler for that slot.
  "3,1": "KC_NONUS_BSLASH",
  "3,2": "KC_Z",
  "3,3": "KC_X",
  "3,4": "KC_C",
  "3,5": "KC_V",
  "3,6": "KC_B",
  "3,7": "KC_N",
  "3,8": "KC_M",
  "3,9": "KC_COMMA",
  "3,10": "KC_DOT",
  "3,11": "KC_SLASH",
  "3,12": "KC_RSHIFT",
  "3,13": "KC_UP",
  "3,14": "KC_END",
  "4,0": "KC_LCTRL",
  // The layout-options alternates at (4,1)/(4,2): only one is ever visible (see
  // demoDefinition.ts's posOpt), but both need a binding since both are real matrix cells.
  // Making the "Fn" alternate an actual MO(1) (not just a differently-labeled LGui) means
  // toggling 布局选项 changes real behavior, not just the keycap legend.
  "4,1": "KC_LGUI",
  "4,2": "MO(1)",
  "4,3": "KC_LALT",
  "4,4": "KC_SPACE",
  "4,5": "KC_RALT",
  "4,6": "MO(1)",
  // The second bottom-row layer key (where a 65% would put RCtrl) — without it layer 2 would
  // have no activation key at all.
  "4,7": "MO(2)",
  "4,8": "KC_LEFT",
  "4,9": "KC_DOWN",
  "4,10": "KC_RIGHT",
};

/** Fn layer — function row, RGB cluster on ZXCVBNM, Home/End on the arrow cluster, two macro keys. */
const LAYER1: Record<string, string> = {
  "0,0": "KC_GRAVE",
  "0,1": "KC_F1",
  "0,2": "KC_F2",
  "0,3": "KC_F3",
  "0,4": "KC_F4",
  "0,5": "KC_F5",
  "0,6": "KC_F6",
  "0,7": "KC_F7",
  "0,8": "KC_F8",
  "0,9": "KC_F9",
  "0,10": "KC_F10",
  "0,11": "KC_F11",
  "0,12": "KC_F12",
  "0,14": "KC_INSERT",
  "1,11": "M0",
  "1,12": "M1",
  "3,2": "RGB_TOG",
  "3,3": "RGB_MOD",
  "3,4": "RGB_RMOD",
  "3,5": "RGB_HUI",
  "3,6": "RGB_HUD",
  "3,7": "RGB_SAI",
  "3,8": "RGB_SAD",
  "3,9": "RGB_VAI",
  "3,10": "RGB_VAD",
  "4,8": "KC_HOME",
  "4,10": "KC_END",
};

/** Lightly configured layer (reached by the bottom row's MO(2)) — a small transport-control
 *  cluster, everything else transparent. */
const LAYER2: Record<string, string> = {
  "3,5": "KC_MUTE",
  "3,6": "KC_MPLY",
  "3,7": "KC_MPRV",
  "3,8": "KC_MNXT",
};

/** Deliberately left unconfigured — demonstrates the "not yet configured" layer badge. */
const LAYER3: Record<string, string> = {};

export const DEMO_LAYERS: Record<string, string>[] = [LAYER0, LAYER1, LAYER2, LAYER3];

/** `${layer},${direction}` -> qmk_id for the single encoder (index 0). Unset = KC_TRNS. */
export const DEMO_ENCODER: Record<string, string> = {
  "0,0": "KC_VOLD",
  "0,1": "KC_VOLU",
  "1,0": "RGB_HUD",
  "1,1": "RGB_HUI",
};

export const DEMO_TAP_DANCE: TapDanceEntry[] = [
  { onTap: "KC_ESCAPE", onHold: "KC_CAPSLOCK", onDoubleTap: "KC_NO", onTapHold: "KC_NO", tappingTerm: 200 },
];

export const DEMO_COMBOS: ComboEntry[] = [
  { keys: ["KC_J", "KC_K", "KC_NO", "KC_NO"], output: "KC_ESCAPE" },
  { keys: ["KC_LSHIFT", "KC_RSHIFT", "KC_NO", "KC_NO"], output: "KC_CAPSLOCK" },
];

export const DEMO_MACROS: MacroAction[][] = [
  // Macro "text" actions are typed keystroke-by-keystroke (ASCII only, like real SendString
  // macros) — no CJK here, the same way a real board couldn't type it either.
  [{ kind: "text", text: "Hello from Vialite's feature preview mode!" }],
  [
    { kind: "down", keycodes: ["KC_LGUI"] },
    { kind: "tap", keycodes: ["KC_L"] },
    { kind: "up", keycodes: ["KC_LGUI"] },
  ],
];
export const DEMO_MACRO_MEMORY = 1024;

/** qsid -> initial value, covering every qsid vialite has UI for (see QMK_SETTINGS_WIDTH). */
export const DEMO_QMK_SETTINGS: Record<number, number> = {
  [QMK_SETTINGS_QSID_MAGIC]: 0,
  [QMK_SETTINGS_QSID_GRAVE_ESCAPE]: 0,
  [QMK_SETTINGS_QSID_TAPPING_TERM]: 200,
  [QMK_SETTINGS_QSID_TAP_HOLD_FLAGS]: 0,
  [QMK_SETTINGS_QSID_TAP_CODE_DELAY]: 0,
  [QMK_SETTINGS_QSID_TAP_HOLD_CAPS_DELAY]: 0,
  [QMK_SETTINGS_QSID_TAPPING_TOGGLE]: 5,
  [QMK_SETTINGS_QSID_PERMISSIVE_HOLD]: 0,
  [QMK_SETTINGS_QSID_HOLD_ON_OTHER_KEY_PRESS]: 0,
  [QMK_SETTINGS_QSID_RETRO_TAPPING]: 0,
  [QMK_SETTINGS_QSID_QUICK_TAP_TERM]: 100,
  [QMK_SETTINGS_QSID_CHORDAL_HOLD]: 0,
  [QMK_SETTINGS_QSID_FLOW_TAP]: 0,
  [QMK_SETTINGS_QSID_COMBO_TERM]: 50,
  [QMK_SETTINGS_QSID_ONESHOT_TAP_TOGGLE]: 0,
  [QMK_SETTINGS_QSID_ONESHOT_TIMEOUT]: 300,
  [QMK_SETTINGS_QSID_MOUSEKEY_DELAY]: 10,
  [QMK_SETTINGS_QSID_MOUSEKEY_INTERVAL]: 20,
  [QMK_SETTINGS_QSID_MOUSEKEY_STEP_SIZE]: 8,
  [QMK_SETTINGS_QSID_MOUSEKEY_MAX_SPEED]: 10,
  [QMK_SETTINGS_QSID_MOUSEKEY_TIME_TO_MAX]: 30,
  [QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_DELAY]: 10,
  [QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_INTERVAL]: 80,
  [QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_MAX_SPEED]: 8,
  [QMK_SETTINGS_QSID_MOUSEKEY_WHEEL_TIME_TO_MAX]: 40,
};

/** Initial VialRGB state: mode 2 ("Solid Color"), half brightness, a violet hue. */
export const DEMO_RGB = {
  supportedEffects: [0, 2, 3, 4, 5, 6, 13, 16, 24] as const,
  mode: 2,
  speed: 128,
  hsv: [170, 255, 128] as [number, number, number],
  maxBrightness: 255,
};

export const DEMO_UID = 0xc0ffee00c0ffee00n;
export const DEMO_VIA_PROTOCOL = 9;
export const DEMO_VIAL_PROTOCOL = 6;
export const DEMO_PRODUCT_NAME = "Vialite Preview Keyboard";
export const DEMO_VENDOR_ID = 0xfeed;
export const DEMO_PRODUCT_ID = 0x6060;
