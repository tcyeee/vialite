import { type CSSProperties } from "react";
import { KeycapFace } from "./KeycapFace.tsx";

const UNIT = 42;
const GAP = 4;

interface Qc {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

/**
 * Physical layout of a standard ANSI 104-key keyboard, expressed in KLE-style
 * key units. Used purely as a keycode palette: clicking a key assigns its
 * qmk_id to whatever key/encoder is currently selected in the layout above.
 */
const KEYS_104: Qc[] = [
  // Function row
  { id: "KC_ESCAPE", x: 0, y: 0 },
  { id: "KC_F1", x: 2, y: 0 },
  { id: "KC_F2", x: 3, y: 0 },
  { id: "KC_F3", x: 4, y: 0 },
  { id: "KC_F4", x: 5, y: 0 },
  { id: "KC_F5", x: 6.5, y: 0 },
  { id: "KC_F6", x: 7.5, y: 0 },
  { id: "KC_F7", x: 8.5, y: 0 },
  { id: "KC_F8", x: 9.5, y: 0 },
  { id: "KC_F9", x: 11, y: 0 },
  { id: "KC_F10", x: 12, y: 0 },
  { id: "KC_F11", x: 13, y: 0 },
  { id: "KC_F12", x: 14, y: 0 },
  { id: "KC_PSCREEN", x: 15.25, y: 0 },
  { id: "KC_SCROLLLOCK", x: 16.25, y: 0 },
  { id: "KC_PAUSE", x: 17.25, y: 0 },

  // Number row
  { id: "KC_GRAVE", x: 0, y: 1.25 },
  { id: "KC_1", x: 1, y: 1.25 },
  { id: "KC_2", x: 2, y: 1.25 },
  { id: "KC_3", x: 3, y: 1.25 },
  { id: "KC_4", x: 4, y: 1.25 },
  { id: "KC_5", x: 5, y: 1.25 },
  { id: "KC_6", x: 6, y: 1.25 },
  { id: "KC_7", x: 7, y: 1.25 },
  { id: "KC_8", x: 8, y: 1.25 },
  { id: "KC_9", x: 9, y: 1.25 },
  { id: "KC_0", x: 10, y: 1.25 },
  { id: "KC_MINUS", x: 11, y: 1.25 },
  { id: "KC_EQUAL", x: 12, y: 1.25 },
  { id: "KC_BSPACE", x: 13, y: 1.25, w: 2 },
  { id: "KC_INSERT", x: 15.25, y: 1.25 },
  { id: "KC_HOME", x: 16.25, y: 1.25 },
  { id: "KC_PGUP", x: 17.25, y: 1.25 },

  // QWERTY row
  { id: "KC_TAB", x: 0, y: 2.25, w: 1.5 },
  { id: "KC_Q", x: 1.5, y: 2.25 },
  { id: "KC_W", x: 2.5, y: 2.25 },
  { id: "KC_E", x: 3.5, y: 2.25 },
  { id: "KC_R", x: 4.5, y: 2.25 },
  { id: "KC_T", x: 5.5, y: 2.25 },
  { id: "KC_Y", x: 6.5, y: 2.25 },
  { id: "KC_U", x: 7.5, y: 2.25 },
  { id: "KC_I", x: 8.5, y: 2.25 },
  { id: "KC_O", x: 9.5, y: 2.25 },
  { id: "KC_P", x: 10.5, y: 2.25 },
  { id: "KC_LBRACKET", x: 11.5, y: 2.25 },
  { id: "KC_RBRACKET", x: 12.5, y: 2.25 },
  { id: "KC_BSLASH", x: 13.5, y: 2.25, w: 1.5 },
  { id: "KC_DELETE", x: 15.25, y: 2.25 },
  { id: "KC_END", x: 16.25, y: 2.25 },
  { id: "KC_PGDOWN", x: 17.25, y: 2.25 },

  // Home row
  { id: "KC_CAPSLOCK", x: 0, y: 3.25, w: 1.75 },
  { id: "KC_A", x: 1.75, y: 3.25 },
  { id: "KC_S", x: 2.75, y: 3.25 },
  { id: "KC_D", x: 3.75, y: 3.25 },
  { id: "KC_F", x: 4.75, y: 3.25 },
  { id: "KC_G", x: 5.75, y: 3.25 },
  { id: "KC_H", x: 6.75, y: 3.25 },
  { id: "KC_J", x: 7.75, y: 3.25 },
  { id: "KC_K", x: 8.75, y: 3.25 },
  { id: "KC_L", x: 9.75, y: 3.25 },
  { id: "KC_SCOLON", x: 10.75, y: 3.25 },
  { id: "KC_QUOTE", x: 11.75, y: 3.25 },
  { id: "KC_ENTER", x: 12.75, y: 3.25, w: 2.25 },

  // Shift row
  { id: "KC_LSHIFT", x: 0, y: 4.25, w: 2.25 },
  { id: "KC_Z", x: 2.25, y: 4.25 },
  { id: "KC_X", x: 3.25, y: 4.25 },
  { id: "KC_C", x: 4.25, y: 4.25 },
  { id: "KC_V", x: 5.25, y: 4.25 },
  { id: "KC_B", x: 6.25, y: 4.25 },
  { id: "KC_N", x: 7.25, y: 4.25 },
  { id: "KC_M", x: 8.25, y: 4.25 },
  { id: "KC_COMMA", x: 9.25, y: 4.25 },
  { id: "KC_DOT", x: 10.25, y: 4.25 },
  { id: "KC_SLASH", x: 11.25, y: 4.25 },
  { id: "KC_RSHIFT", x: 12.25, y: 4.25, w: 2.75 },
  { id: "KC_UP", x: 16.25, y: 4.25 },

  // Bottom row
  { id: "KC_LCTRL", x: 0, y: 5.25, w: 1.25 },
  { id: "KC_LGUI", x: 1.25, y: 5.25, w: 1.25 },
  { id: "KC_LALT", x: 2.5, y: 5.25, w: 1.25 },
  { id: "KC_SPACE", x: 3.75, y: 5.25, w: 6.25 },
  { id: "KC_RALT", x: 10, y: 5.25, w: 1.25 },
  { id: "KC_RGUI", x: 11.25, y: 5.25, w: 1.25 },
  { id: "KC_APPLICATION", x: 12.5, y: 5.25, w: 1.25 },
  { id: "KC_RCTRL", x: 13.75, y: 5.25, w: 1.25 },
  { id: "KC_LEFT", x: 15.25, y: 5.25 },
  { id: "KC_DOWN", x: 16.25, y: 5.25 },
  { id: "KC_RIGHT", x: 17.25, y: 5.25 },

  // Numpad
  { id: "KC_NUMLOCK", x: 18.5, y: 1.25 },
  { id: "KC_KP_SLASH", x: 19.5, y: 1.25 },
  { id: "KC_KP_ASTERISK", x: 20.5, y: 1.25 },
  { id: "KC_KP_MINUS", x: 21.5, y: 1.25 },
  { id: "KC_KP_7", x: 18.5, y: 2.25 },
  { id: "KC_KP_8", x: 19.5, y: 2.25 },
  { id: "KC_KP_9", x: 20.5, y: 2.25 },
  { id: "KC_KP_PLUS", x: 21.5, y: 2.25, h: 2 },
  { id: "KC_KP_4", x: 18.5, y: 3.25 },
  { id: "KC_KP_5", x: 19.5, y: 3.25 },
  { id: "KC_KP_6", x: 20.5, y: 3.25 },
  { id: "KC_KP_1", x: 18.5, y: 4.25 },
  { id: "KC_KP_2", x: 19.5, y: 4.25 },
  { id: "KC_KP_3", x: 20.5, y: 4.25 },
  { id: "KC_KP_ENTER", x: 21.5, y: 4.25, h: 2 },
  { id: "KC_KP_0", x: 18.5, y: 5.25, w: 2 },
  { id: "KC_KP_DOT", x: 20.5, y: 5.25 },
];

const BOARD_WIDTH = 22.5;
const BOARD_HEIGHT = 6.25;

/** qmk_ids the 104-key board already exposes, so other pickers can avoid listing them twice. */
export const QUICK_CONFIG_QMK_IDS: ReadonlySet<string> = new Set(KEYS_104.map((k) => k.id));

interface Props {
  onPick: (qmkId: string) => void;
  disabled?: boolean;
  /** Multiplier on the key unit size (default 1). */
  scale?: number;
}

export function QuickConfig104({ onPick, disabled, scale = 1 }: Props) {
  const unit = UNIT * scale;
  return (
    <div
      className="keyboard-layout"
      style={{
        width: BOARD_WIDTH * unit,
        height: BOARD_HEIGHT * unit,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : undefined,
      }}
    >
      {KEYS_104.map((k) => {
        const style: CSSProperties = {
          left: k.x * unit,
          top: k.y * unit,
          width: (k.w ?? 1) * unit - GAP,
          height: (k.h ?? 1) * unit - GAP,
        };
        return (
          <button
            key={k.id}
            className="key"
            title={k.id}
            onClick={() => onPick(k.id)}
            style={style}
          >
            <KeycapFace qmkId={k.id} />
          </button>
        );
      })}
    </div>
  );
}
