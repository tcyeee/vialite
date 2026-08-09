import { useI18n } from "../../../contexts/i18n.tsx";

/**
 * A full, simulated 104-key ANSI keyboard for quick basic-key assignment,
 * laid out like a real board (function row, main alpha block, nav cluster,
 * arrow keys, full numpad) so users recognise a key by position and click it
 * straight onto the selected cap. It's a shortcut over the cascade selector
 * below — every key here is a plain `KC_*` basic key.
 *
 * Keys are placed on a unit grid (`U` rem per 1u key) via absolute positioning,
 * the way physical-layout editors work, so the staggered rows line up exactly.
 * Each button carries only its `KC_` id; picking is handled by the parent
 * (ConfigPanel) so it shares the same masked-template / auto-advance flow as the
 * rest of the palette.
 */

/** One placed key. `sub` is the shifted-layer glyph printed small above. */
interface Key {
  x: number;
  y: number;
  /** Width in key units (default 1). */
  w?: number;
  /** Height in key units (default 1); used by the tall numpad +/Enter keys. */
  h?: number;
  label: string;
  sub?: string;
  qmkId: string;
}

/** US-layout shifted glyph for the number/symbol keys. */
const SHIFTED: Record<string, string> = {
  "1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
  "6": "^", "7": "&", "8": "*", "9": "(", "0": ")",
};

const keys: Key[] = [];
const push = (k: Key) => keys.push(k);

// x offsets of the nav cluster (Ins/Home/PgUp, Del/End/PgDn, arrows) and the
// numpad, sitting to the right of the 15u-wide main block with a 0.25u gap
// between each block, matching a real full-size ANSI 104-key board.
const NAV_X = 15.25;
const NUM_X = 18.5;

// Row 1 — function row + PrtScn/ScrLk/Pause (y = 0).
push({ x: 0, y: 0, label: "Esc", qmkId: "KC_ESCAPE" });
["1", "2", "3", "4"].forEach((n, i) => push({ x: 2 + i, y: 0, label: `F${n}`, qmkId: `KC_F${n}` }));
["5", "6", "7", "8"].forEach((n, i) => push({ x: 6.5 + i, y: 0, label: `F${n}`, qmkId: `KC_F${n}` }));
["9", "10", "11", "12"].forEach((n, i) => push({ x: 11 + i, y: 0, label: `F${n}`, qmkId: `KC_F${n}` }));
push({ x: NAV_X, y: 0, label: "PrtSc", qmkId: "KC_PSCREEN" });
push({ x: NAV_X + 1, y: 0, label: "ScrLk", qmkId: "KC_SCROLLLOCK" });
push({ x: NAV_X + 2, y: 0, label: "Pause", qmkId: "KC_PAUSE" });

// Row 2 — number row + Backspace, Insert/Home/PgUp, numpad top (y = 1.25).
push({ x: 0, y: 1.25, label: "`", sub: "~", qmkId: "KC_GRAVE" });
[..."1234567890"].forEach((d, i) => push({ x: 1 + i, y: 1.25, label: d, sub: SHIFTED[d], qmkId: `KC_${d}` }));
push({ x: 11, y: 1.25, label: "-", sub: "_", qmkId: "KC_MINUS" });
push({ x: 12, y: 1.25, label: "=", sub: "+", qmkId: "KC_EQUAL" });
push({ x: 13, y: 1.25, w: 2, label: "Bksp", qmkId: "KC_BSPACE" });
push({ x: NAV_X, y: 1.25, label: "Ins", qmkId: "KC_INSERT" });
push({ x: NAV_X + 1, y: 1.25, label: "Home", qmkId: "KC_HOME" });
push({ x: NAV_X + 2, y: 1.25, label: "PgUp", qmkId: "KC_PGUP" });
push({ x: NUM_X, y: 1.25, label: "Num", qmkId: "KC_NUMLOCK" });
push({ x: NUM_X + 1, y: 1.25, label: "/", qmkId: "KC_KP_SLASH" });
push({ x: NUM_X + 2, y: 1.25, label: "*", qmkId: "KC_KP_ASTERISK" });
push({ x: NUM_X + 3, y: 1.25, label: "-", qmkId: "KC_KP_MINUS" });

// Row 3 — Tab / QWERTY / Delete/End/PgDn, numpad 7-8-9 + tall + (y = 2.25).
push({ x: 0, y: 2.25, w: 1.5, label: "Tab", qmkId: "KC_TAB" });
[..."QWERTYUIOP"].forEach((c, i) => push({ x: 1.5 + i, y: 2.25, label: c, qmkId: `KC_${c}` }));
push({ x: 11.5, y: 2.25, label: "[", sub: "{", qmkId: "KC_LBRACKET" });
push({ x: 12.5, y: 2.25, label: "]", sub: "}", qmkId: "KC_RBRACKET" });
push({ x: 13.5, y: 2.25, w: 1.5, label: "\\", sub: "|", qmkId: "KC_BSLASH" });
push({ x: NAV_X, y: 2.25, label: "Del", qmkId: "KC_DELETE" });
push({ x: NAV_X + 1, y: 2.25, label: "End", qmkId: "KC_END" });
push({ x: NAV_X + 2, y: 2.25, label: "PgDn", qmkId: "KC_PGDOWN" });
["7", "8", "9"].forEach((d, i) => push({ x: NUM_X + i, y: 2.25, label: d, qmkId: `KC_KP_${d}` }));
push({ x: NUM_X + 3, y: 2.25, h: 2, label: "+", qmkId: "KC_KP_PLUS" });

// Row 4 — Caps / home row / Enter, numpad 4-5-6 (y = 3.25).
push({ x: 0, y: 3.25, w: 1.75, label: "Caps", qmkId: "KC_CAPSLOCK" });
[..."ASDFGHJKL"].forEach((c, i) => push({ x: 1.75 + i, y: 3.25, label: c, qmkId: `KC_${c}` }));
push({ x: 10.75, y: 3.25, label: ";", sub: ":", qmkId: "KC_SCOLON" });
push({ x: 11.75, y: 3.25, label: "'", sub: "\"", qmkId: "KC_QUOTE" });
push({ x: 12.75, y: 3.25, w: 2.25, label: "Enter", qmkId: "KC_ENTER" });
["4", "5", "6"].forEach((d, i) => push({ x: NUM_X + i, y: 3.25, label: d, qmkId: `KC_KP_${d}` }));

// Row 5 — Shifts / bottom letter row / ↑, numpad 1-2-3 + tall Enter (y = 4.25).
push({ x: 0, y: 4.25, w: 2.25, label: "Shift", qmkId: "KC_LSHIFT" });
[..."ZXCVBNM"].forEach((c, i) => push({ x: 2.25 + i, y: 4.25, label: c, qmkId: `KC_${c}` }));
push({ x: 9.25, y: 4.25, label: ",", sub: "<", qmkId: "KC_COMMA" });
push({ x: 10.25, y: 4.25, label: ".", sub: ">", qmkId: "KC_DOT" });
push({ x: 11.25, y: 4.25, label: "/", sub: "?", qmkId: "KC_SLASH" });
push({ x: 12.25, y: 4.25, w: 2.75, label: "Shift", qmkId: "KC_RSHIFT" });
push({ x: NAV_X + 1, y: 4.25, label: "↑", qmkId: "KC_UP" });
["1", "2", "3"].forEach((d, i) => push({ x: NUM_X + i, y: 4.25, label: d, qmkId: `KC_KP_${d}` }));
push({ x: NUM_X + 3, y: 4.25, h: 2, label: "Enter", qmkId: "KC_KP_ENTER" });

// Row 6 — modifiers / space / arrows, numpad 0 + . (y = 5.25).
push({ x: 0, y: 5.25, w: 1.25, label: "Ctrl", qmkId: "KC_LCTRL" });
push({ x: 1.25, y: 5.25, w: 1.25, label: "Win", qmkId: "KC_LGUI" });
push({ x: 2.5, y: 5.25, w: 1.25, label: "Alt", qmkId: "KC_LALT" });
push({ x: 3.75, y: 5.25, w: 6.25, label: "Space", qmkId: "KC_SPACE" });
push({ x: 10, y: 5.25, w: 1.25, label: "Alt", qmkId: "KC_RALT" });
push({ x: 11.25, y: 5.25, w: 1.25, label: "Win", qmkId: "KC_RGUI" });
push({ x: 12.5, y: 5.25, w: 1.25, label: "Menu", qmkId: "KC_APPLICATION" });
push({ x: 13.75, y: 5.25, w: 1.25, label: "Ctrl", qmkId: "KC_RCTRL" });
push({ x: NAV_X, y: 5.25, label: "←", qmkId: "KC_LEFT" });
push({ x: NAV_X + 1, y: 5.25, label: "↓", qmkId: "KC_DOWN" });
push({ x: NAV_X + 2, y: 5.25, label: "→", qmkId: "KC_RIGHT" });
push({ x: NUM_X, y: 5.25, w: 2, label: "0", qmkId: "KC_KP_0" });
push({ x: NUM_X + 2, y: 5.25, label: ".", qmkId: "KC_KP_DOT" });

// Unit geometry. `U` rem per 1u; `GAP` rem trimmed off every key for spacing.
const U = 2.4;
const GAP = 0.25;
const COLS = NUM_X + 4;
const ROWS = 6.25;

interface Props {
  onPick: (qmkId: string) => void;
}

export function BasicKeyboardGrid({ onPick }: Props) {
  const { t } = useI18n();

  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold opacity-70">{t("groupBasicBoard")}</h4>
      <div className="scrollbar-hide overflow-x-auto pb-2">
        <div className="relative w-fit rounded-lg border border-base-content/30 bg-base-200 p-2">
          <div
            className="relative"
            style={{ width: `${COLS * U}rem`, height: `${ROWS * U}rem` }}
          >
            {keys.map((k) => {
              const w = k.w ?? 1;
              const h = k.h ?? 1;
              return (
                <button
                  key={k.qmkId}
                  title={k.qmkId}
                  onClick={() => onPick(k.qmkId)}
                  className="absolute flex flex-col items-center justify-center rounded-md border border-base-content/20 bg-base-100 leading-none transition-colors hover:bg-base-200"
                  style={{
                    left: `${k.x * U + GAP / 2}rem`,
                    top: `${k.y * U + GAP / 2}rem`,
                    width: `${w * U - GAP}rem`,
                    height: `${h * U - GAP}rem`,
                  }}
                >
                  {k.sub && <span className="text-[0.6rem] opacity-55">{k.sub}</span>}
                  <span className="text-[0.72rem]">{k.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
