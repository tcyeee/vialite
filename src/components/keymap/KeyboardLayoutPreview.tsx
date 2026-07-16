import { useMemo, type CSSProperties } from "react";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { label as kcLabel } from "../../protocol/keycodes.ts";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";

/** Cap size in px per KLE unit, keyed by the display-size setting. */
export type PreviewSize = "s" | "m" | "l" | "xl";
export const PREVIEW_UNITS: Record<PreviewSize, number> = { s: 56, m: 68, l: 82, xl: 98 };

/** Defaults for the tunable case/plate appearance. */
export const DEFAULT_KEY_SPACING = 3;
export const DEFAULT_CASE_THICKNESS = 15;
export const DEFAULT_CASE_COLOR = "#b0b0b0";
export const DEFAULT_PLATE_COLOR = "#8a8a8a";

export interface PreviewAppearance {
  /** Gap in px between adjacent keys (按键间距). */
  gap?: number;
  /** Case bezel thickness in px around the plate (外壳厚度). */
  caseThickness?: number;
  /** Case (外壳) fill color. */
  caseColor?: string;
  /** Plate (定位板) fill color the keys sit on. */
  plateColor?: string;
}

function shapeStyle(
  s: { x: number; y: number; width: number; height: number; rotationAngle: number; rotationX: number; rotationY: number },
  shiftX: number,
  shiftY: number,
  UNIT: number,
  gap: number,
): CSSProperties {
  const style: CSSProperties = {
    left: (s.x + shiftX) * UNIT,
    top: (s.y + shiftY) * UNIT,
    width: s.width * UNIT - gap,
    height: s.height * UNIT - gap,
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
 *
 * The case (外壳) and plate (定位板) appearance is tunable via {@link PreviewAppearance}.
 */
export function KeyboardLayoutPreview({
  keyboard,
  size = "m",
  gap = DEFAULT_KEY_SPACING,
  caseThickness = DEFAULT_CASE_THICKNESS,
  caseColor = DEFAULT_CASE_COLOR,
  plateColor = DEFAULT_PLATE_COLOR,
}: { keyboard: Keyboard; size?: PreviewSize } & PreviewAppearance) {
  const UNIT = PREVIEW_UNITS[size];
  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    [keyboard, keyboard.layoutOptions],
  );

  return (
    <div
      className="keyboard-case"
      style={{ padding: caseThickness, background: caseColor, width: "fit-content" }}
    >
      <div
        className="keyboard-layout"
        style={{
          width: placed.width * UNIT,
          height: placed.height * UNIT,
          background: plateColor,
          pointerEvents: "none",
        }}
      >
        {placed.keys
          .filter(({ key }) => !key.decal)
          .map(({ key, shiftX, shiftY }) => (
            <div
              key={`${key.row},${key.col}@${key.x},${key.y}`}
              className="key"
              style={shapeStyle(key, shiftX, shiftY, UNIT, gap)}
            >
              {hasSecondRect(key) && (
                <span
                  className="key-part2"
                  style={{
                    left: key.x2 * UNIT,
                    top: key.y2 * UNIT,
                    width: key.width2 * UNIT - gap,
                    height: key.height2 * UNIT - gap,
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
            style={shapeStyle(encoder, shiftX, shiftY, UNIT, gap)}
          >
            <span className="encoder-dir">{encoder.direction === 1 ? "↻" : "↺"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
