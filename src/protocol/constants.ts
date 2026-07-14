// Ported from vial-gui's protocol/constants.py

export const CMD_VIA_GET_PROTOCOL_VERSION = 0x01;
export const CMD_VIA_GET_KEYBOARD_VALUE = 0x02;
export const CMD_VIA_SET_KEYBOARD_VALUE = 0x03;
export const CMD_VIA_GET_KEYCODE = 0x04;
export const CMD_VIA_SET_KEYCODE = 0x05;
export const CMD_VIA_LIGHTING_SET_VALUE = 0x07;
export const CMD_VIA_LIGHTING_GET_VALUE = 0x08;
export const CMD_VIA_LIGHTING_SAVE = 0x09;
export const CMD_VIA_MACRO_GET_COUNT = 0x0c;
export const CMD_VIA_MACRO_GET_BUFFER_SIZE = 0x0d;
export const CMD_VIA_MACRO_GET_BUFFER = 0x0e;
export const CMD_VIA_MACRO_SET_BUFFER = 0x0f;
export const CMD_VIA_GET_LAYER_COUNT = 0x11;
export const CMD_VIA_KEYMAP_GET_BUFFER = 0x12;
export const CMD_VIA_VIAL_PREFIX = 0xfe;
export const VIA_LAYOUT_OPTIONS = 0x02;
export const VIA_SWITCH_MATRIX_STATE = 0x03;
export const QMK_BACKLIGHT_BRIGHTNESS = 0x09;
export const QMK_BACKLIGHT_EFFECT = 0x0a;
export const QMK_RGBLIGHT_BRIGHTNESS = 0x80;
export const QMK_RGBLIGHT_EFFECT = 0x81;
export const QMK_RGBLIGHT_EFFECT_SPEED = 0x82;
export const QMK_RGBLIGHT_COLOR = 0x83;
export const VIALRGB_GET_INFO = 0x40;
export const VIALRGB_GET_MODE = 0x41;
export const VIALRGB_GET_SUPPORTED = 0x42;
export const VIALRGB_SET_MODE = 0x41;
export const CMD_VIAL_GET_KEYBOARD_ID = 0x00;
export const CMD_VIAL_GET_SIZE = 0x01;
export const CMD_VIAL_GET_DEFINITION = 0x02;
export const CMD_VIAL_GET_ENCODER = 0x03;
export const CMD_VIAL_SET_ENCODER = 0x04;
export const CMD_VIAL_GET_UNLOCK_STATUS = 0x05;
export const CMD_VIAL_UNLOCK_START = 0x06;
export const CMD_VIAL_UNLOCK_POLL = 0x07;
export const CMD_VIAL_LOCK = 0x08;
export const CMD_VIAL_QMK_SETTINGS_QUERY = 0x09;
export const CMD_VIAL_QMK_SETTINGS_GET = 0x0a;
export const CMD_VIAL_QMK_SETTINGS_SET = 0x0b;
export const CMD_VIAL_QMK_SETTINGS_RESET = 0x0c;
export const CMD_VIAL_DYNAMIC_ENTRY_OP = 0x0d;
export const DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES = 0x00;
export const DYNAMIC_VIAL_TAP_DANCE_GET = 0x01;
export const DYNAMIC_VIAL_TAP_DANCE_SET = 0x02;
export const DYNAMIC_VIAL_COMBO_GET = 0x03;
export const DYNAMIC_VIAL_COMBO_SET = 0x04;
export const DYNAMIC_VIAL_KEY_OVERRIDE_GET = 0x05;
export const DYNAMIC_VIAL_KEY_OVERRIDE_SET = 0x06;
export const DYNAMIC_VIAL_ALT_REPEAT_KEY_GET = 0x07;
export const DYNAMIC_VIAL_ALT_REPEAT_KEY_SET = 0x08;

/** How much of a macro/keymap buffer we can read/write per packet. */
export const BUFFER_FETCH_CHUNK = 28;

export const VIAL_PROTOCOL_ADVANCED_MACROS = 2;
export const VIAL_PROTOCOL_MATRIX_TESTER = 3;
export const VIAL_PROTOCOL_DYNAMIC = 4;
export const VIAL_PROTOCOL_QMK_SETTINGS = 4;
export const VIAL_PROTOCOL_EXT_MACROS = 5;
export const VIAL_PROTOCOL_KEY_OVERRIDE = 5;

export const SUPPORTED_VIA_PROTOCOL = [-1, 9];
export const SUPPORTED_VIAL_PROTOCOL = [-1, 0, 1, 2, 3, 4, 5, 6];

/** Raw HID report length used by the VIA/Vial protocol (excludes the report ID byte). */
export const MSG_LEN = 32;

export const VIAL_USAGE_PAGE = 0xff60;
export const VIAL_USAGE = 0x61;
