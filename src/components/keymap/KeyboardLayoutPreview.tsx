import { useMemo, type CSSProperties } from "react";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { label as kcLabel } from "../../protocol/keycodes.ts";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";

/** Cap size in px per KLE unit, keyed by the display-size setting. */
export type PreviewSize = "s" | "m" | "l" | "xl";
export const PREVIEW_UNITS: Record<PreviewSize, number> = { s: 38, m: 48, l: 60, xl: 74 };
const GAP = 3;

function shapeStyle(
  s: { x: number; y: number; width: number; height: number; rotationAngle: number; rotationX: number; rotationY: number },
  shiftX: number,
  shiftY: number,
  UNIT: number,
): CSSProperties {
  const style: CSSProperties = {
    left: (s.x + shiftX) * UNIT,
    top: (s.y + shiftY) * UNIT,
    width: s.width * UNIT - GAP,
    height: s.height * UNIT - GAP,
  };
  if (s.rotationAngle) {
    style.transform = `rotate(${s.rotationAngle}deg)`;
    style.transformOrigin = `${(s.rotationX - s.x) * UNIT}px ${(s.rotationY - s.y) * UNIT}px`;
  }
  return style;
}

/**
 * Read-only rendering of the connected board's physical layout — same geometry
 * pipeline as {@link KeyboardLayout}, but non-interactive (`pointer-events:none`)
 * and captioned with layer-0 labels so the board is recognizable. Used by the
 * 键盘配色 section as a display-only preview; no per-key action wired up yet.
 */
export function KeyboardLayoutPreview({ keyboard, size = "m" }: { keyboard: Keyboard; size?: PreviewSize }) {
  const UNIT = PREVIEW_UNITS[size];
  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    [keyboard, keyboard.layoutOptions],
  );

  return (
    <div
      className="keyboard-layout"
      style={{ width: placed.width * UNIT, height: placed.height * UNIT, pointerEvents: "none" }}
    >
      {placed.keys
        .filter(({ key }) => !key.decal)
        .map(({ key, shiftX, shiftY }) => (
          <div
            key={`${key.row},${key.col}@${key.x},${key.y}`}
            className="key"
            style={shapeStyle(key, shiftX, shiftY, UNIT)}
          >
            {hasSecondRect(key) && (
              <span
                className="key-part2"
                style={{
                  left: key.x2 * UNIT,
                  top: key.y2 * UNIT,
                  width: key.width2 * UNIT - GAP,
                  height: key.height2 * UNIT - GAP,
                }}
              />
            )}
            <span className="key-label">{kcLabel(keyboard.getKey(0, key.row, key.col))}</span>
          </div>
        ))}
      {placed.encoders.map(({ encoder, shiftX, shiftY }) => (
        <div
          key={`e${encoder.index},${encoder.direction}@${encoder.x},${encoder.y}`}
          className="encoder"
          style={shapeStyle(encoder, shiftX, shiftY, UNIT)}
        >
          <span className="encoder-dir">{encoder.direction === 1 ? "↻" : "↺"}</span>
        </div>
      ))}
    </div>
  );
}
