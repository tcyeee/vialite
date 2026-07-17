import { useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { deserialize, serialize } from "../../protocol/keycodes.ts";
import { HelpIcon } from "../common/HelpIcon.tsx";

/**
 * A full, simulated 89-key keyboard for quick basic-key assignment, laid out
 * like a real board (function row, main alpha block, arrow keys, numpad) so
 * users recognise a key by position and click it straight onto the selected
 * cap. It's a shortcut over the cascade selector below — every key here is a
 * plain `KC_*` basic key.
 *
 * Keys are placed on a unit grid (`U` rem per 1u key) via absolute positioning,
 * the way physical-layout editors work, so the staggered rows line up exactly.
 * Each button carries only its `KC_` id; picking is handled by the parent
 * (KeycodeTabs) so it shares the same masked-template / auto-advance flow as the
 * rest of the palette.
 */

/** One placed key. `sub` is the shifted-layer glyph printed small above. */
interface Key {
  x: number;
  y: number;
  /** Width in key units (default 1). */
  w?: number;
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

// Row 1 — function row (y = 0).
push({ x: 0, y: 0, label: "Esc", qmkId: "KC_ESCAPE" });
["1", "2", "3", "4"].forEach((n, i) => push({ x: 2 + i, y: 0, label: `F${n}`, qmkId: `KC_F${n}` }));
["5", "6", "7", "8"].forEach((n, i) => push({ x: 6.5 + i, y: 0, label: `F${n}`, qmkId: `KC_F${n}` }));
["9", "10", "11", "12"].forEach((n, i) => push({ x: 11 + i, y: 0, label: `F${n}`, qmkId: `KC_F${n}` }));

// Row 2 — number row + Backspace, numpad top (y = 1.25).
push({ x: 0, y: 1.25, label: "`", sub: "~", qmkId: "KC_GRAVE" });
[..."1234567890"].forEach((d, i) => push({ x: 1 + i, y: 1.25, label: d, sub: SHIFTED[d], qmkId: `KC_${d}` }));
push({ x: 11, y: 1.25, label: "-", sub: "_", qmkId: "KC_MINUS" });
push({ x: 12, y: 1.25, label: "=", sub: "+", qmkId: "KC_EQUAL" });
push({ x: 13, y: 1.25, w: 2, label: "Bksp", qmkId: "KC_BSPACE" });
push({ x: 15.5, y: 1.25, label: "Num", qmkId: "KC_NUMLOCK" });
push({ x: 16.5, y: 1.25, label: "/", qmkId: "KC_KP_SLASH" });
push({ x: 17.5, y: 1.25, label: "*", qmkId: "KC_KP_ASTERISK" });

// Row 3 — Tab / QWERTY / numpad 7-8-9 (y = 2.25).
push({ x: 0, y: 2.25, w: 1.5, label: "Tab", qmkId: "KC_TAB" });
[..."QWERTYUIOP"].forEach((c, i) => push({ x: 1.5 + i, y: 2.25, label: c, qmkId: `KC_${c}` }));
push({ x: 11.5, y: 2.25, label: "[", sub: "{", qmkId: "KC_LBRACKET" });
push({ x: 12.5, y: 2.25, label: "]", sub: "}", qmkId: "KC_RBRACKET" });
push({ x: 13.5, y: 2.25, w: 1.5, label: "\\", sub: "|", qmkId: "KC_BSLASH" });
["7", "8", "9"].forEach((d, i) => push({ x: 15.5 + i, y: 2.25, label: d, qmkId: `KC_KP_${d}` }));

// Row 4 — Caps / home row / Enter / numpad 4-5-6 (y = 3.25).
push({ x: 0, y: 3.25, w: 1.75, label: "Caps", qmkId: "KC_CAPSLOCK" });
[..."ASDFGHJKL"].forEach((c, i) => push({ x: 1.75 + i, y: 3.25, label: c, qmkId: `KC_${c}` }));
push({ x: 10.75, y: 3.25, label: ";", sub: ":", qmkId: "KC_SCOLON" });
push({ x: 11.75, y: 3.25, label: "'", sub: "\"", qmkId: "KC_QUOTE" });
push({ x: 12.75, y: 3.25, w: 2.25, label: "Enter", qmkId: "KC_ENTER" });
["4", "5", "6"].forEach((d, i) => push({ x: 15.5 + i, y: 3.25, label: d, qmkId: `KC_KP_${d}` }));

// Row 5 — Shifts / bottom letter row / ↑ / numpad 1-2-3 (y = 4.25).
push({ x: 0, y: 4.25, w: 2.25, label: "Shift", qmkId: "KC_LSHIFT" });
[..."ZXCVBNM"].forEach((c, i) => push({ x: 2.25 + i, y: 4.25, label: c, qmkId: `KC_${c}` }));
push({ x: 9.25, y: 4.25, label: ",", sub: "<", qmkId: "KC_COMMA" });
push({ x: 10.25, y: 4.25, label: ".", sub: ">", qmkId: "KC_DOT" });
push({ x: 11.25, y: 4.25, label: "/", sub: "?", qmkId: "KC_SLASH" });
push({ x: 12.25, y: 4.25, w: 1.75, label: "Shift", qmkId: "KC_RSHIFT" });
push({ x: 14, y: 4.25, label: "↑", qmkId: "KC_UP" });
["1", "2", "3"].forEach((d, i) => push({ x: 15.5 + i, y: 4.25, label: d, qmkId: `KC_KP_${d}` }));

// Row 6 — modifiers / space / arrows / numpad 0 (y = 5.25).
push({ x: 0, y: 5.25, w: 1.25, label: "Ctrl", qmkId: "KC_LCTRL" });
push({ x: 1.25, y: 5.25, w: 1.25, label: "Win", qmkId: "KC_LGUI" });
push({ x: 2.5, y: 5.25, w: 1.25, label: "Alt", qmkId: "KC_LALT" });
push({ x: 3.75, y: 5.25, w: 5.75, label: "Space", qmkId: "KC_SPACE" });
push({ x: 9.5, y: 5.25, w: 1.25, label: "Alt", qmkId: "KC_RALT" });
push({ x: 10.75, y: 5.25, w: 1.25, label: "Menu", qmkId: "KC_APPLICATION" });
push({ x: 12, y: 5.25, label: "←", qmkId: "KC_LEFT" });
push({ x: 13, y: 5.25, label: "↓", qmkId: "KC_DOWN" });
push({ x: 14, y: 5.25, label: "→", qmkId: "KC_RIGHT" });
push({ x: 15.5, y: 5.25, w: 3, label: "0", qmkId: "KC_KP_0" });

// Unit geometry. `U` rem per 1u; `GAP` rem trimmed off every key for spacing.
const U = 2.4;
const GAP = 0.25;
const COLS = 18.5;
const ROWS = 6.25;

interface Props {
  onPick: (qmkId: string) => void;
}

export function BasicKeyboardGrid({ onPick }: Props) {
  const { t } = useI18n();
  // "任意按键" modal: a free-form keycode expression (e.g. LT(2,KC_A), 0x5c00)
  // parsed and normalised to its canonical qmk_id before assignment.
  const [anyOpen, setAnyOpen] = useState(false);
  const [anyValue, setAnyValue] = useState("");
  const [anyError, setAnyError] = useState<string | null>(null);

  const closeAny = () => {
    setAnyOpen(false);
    setAnyValue("");
    setAnyError(null);
  };

  const submitAny = () => {
    const text = anyValue.trim();
    if (!text) return;
    try {
      const qmkId = serialize(deserialize(text));
      onPick(qmkId);
      closeAny();
    } catch (err) {
      setAnyError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold opacity-70">{t("groupBasicBoard")}</h4>
      <div className="overflow-x-auto pb-2">
        <div className="w-fit rounded-lg border border-base-content/30 bg-base-200 p-2">
          <div
            className="relative"
            style={{ width: `${COLS * U}rem`, height: `${ROWS * U}rem` }}
          >
            {keys.map((k) => {
              const w = k.w ?? 1;
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
                    height: `${U - GAP}rem`,
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

      <div className="mt-3">
        <h4 className="mb-2 text-sm font-semibold opacity-70">{t("specialKeys")}</h4>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-sm btn-outline"
            title={t("clearNoTitle")}
            onClick={() => onPick("KC_NO")}
          >
            {t("specialClear")}
          </button>
          <button
            className="btn btn-sm btn-outline"
            title={t("clearTransTitle")}
            onClick={() => onPick("KC_TRNS")}
          >
            {t("specialTransparent")}
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => setAnyOpen(true)}>
            {t("specialAny")}
          </button>
        </div>
      </div>

      <dialog className={`modal${anyOpen ? " modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="flex items-center gap-1 text-base font-semibold">
            <span>{t("anyKeycodeHeading")}</span>
            <HelpIcon text={t("anyKeyPlaceholder")} />
          </h3>
          <input
            type="text"
            className="input input-bordered mt-4 w-full"
            placeholder={t("anyKeyPlaceholder")}
            value={anyValue}
            autoFocus
            onChange={(e) => {
              setAnyValue(e.target.value);
              setAnyError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAny();
            }}
          />
          {anyError && (
            <div className="alert alert-error alert-soft mt-3 py-1 text-sm">
              <span>{anyError}</span>
            </div>
          )}
          <div className="modal-action">
            <button className="btn btn-sm" onClick={closeAny}>
              {t("cancel")}
            </button>
            <button className="btn btn-sm btn-primary" onClick={submitAny}>
              {t("set")}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={closeAny}>
            close
          </button>
        </form>
      </dialog>
    </div>
  );
}
