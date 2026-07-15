import { useMemo, type CSSProperties } from "react";
import type { Keyboard } from "../protocol/keyboard.ts";
import { label as kcLabel } from "../protocol/keycodes.ts";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";

const UNIT = 54;
/** Gap between keycaps, in px (subtracted from each key's rendered size). */
const GAP = 4;

interface Props {
  keyboard: Keyboard;
  layer: number;
  onKeySelect: (row: number, col: number) => void;
  onEncoderSelect: (index: number, direction: 0 | 1) => void;
}

function shapeStyle(
  s: { x: number; y: number; width: number; height: number; rotationAngle: number; rotationX: number; rotationY: number },
  shiftX: number,
  shiftY: number,
): CSSProperties {
  const style: CSSProperties = {
    left: (s.x + shiftX) * UNIT,
    top: (s.y + shiftY) * UNIT,
    width: s.width * UNIT - GAP,
    height: s.height * UNIT - GAP,
  };
  if (s.rotationAngle) {
    // Rotate around the KLE cluster origin (rx, ry), expressed relative to
    // this element's top-left. The shift moves element and origin together,
    // matching vial-gui's translate-after-rotate transform order.
    style.transform = `rotate(${s.rotationAngle}deg)`;
    style.transformOrigin = `${(s.rotationX - s.x) * UNIT}px ${(s.rotationY - s.y) * UNIT}px`;
  }
  return style;
}

export function KeyboardLayout({ keyboard, layer, onKeySelect, onEncoderSelect }: Props) {
  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    // Keyboard mutates in place; layoutOptions is the only geometry input that
    // changes after the initial load.
    [keyboard, keyboard.layoutOptions],
  );

  return (
    <div
      className="keyboard-layout"
      style={{ width: placed.width * UNIT, height: placed.height * UNIT }}
    >
      {placed.keys
        .filter(({ key }) => !key.decal)
        .map(({ key, shiftX, shiftY }) => {
          const qmkId = keyboard.getKey(layer, key.row, key.col);
          return (
            <button
              key={`${key.row},${key.col}@${key.x},${key.y}`}
              className="key"
              title={qmkId}
              onClick={() => onKeySelect(key.row, key.col)}
              style={shapeStyle(key, shiftX, shiftY)}
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
              <span className="key-label">{kcLabel(qmkId)}</span>
            </button>
          );
        })}
      {placed.encoders.map(({ encoder, shiftX, shiftY }) => {
        const qmkId = keyboard.getEncoder(layer, encoder.index, encoder.direction);
        return (
          <button
            key={`e${encoder.index},${encoder.direction}@${encoder.x},${encoder.y}`}
            className="encoder"
            title={`Encoder ${encoder.index} ${encoder.direction === 1 ? "CW" : "CCW"}: ${qmkId}`}
            onClick={() => onEncoderSelect(encoder.index, encoder.direction)}
            style={shapeStyle(encoder, shiftX, shiftY)}
          >
            <span className="encoder-dir">{encoder.direction === 1 ? "↻" : "↺"}</span>
            <span className="key-label">{kcLabel(qmkId)}</span>
          </button>
        );
      })}
    </div>
  );
}
