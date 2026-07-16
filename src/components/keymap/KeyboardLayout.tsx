import { useMemo } from "react";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { label as kcLabel } from "../../protocol/keycodes.ts";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { appearanceMetrics, shapeStyle } from "./KeyboardLayoutPreview.tsx";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";

type Selected =
  | { kind: "key"; row: number; col: number }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

interface Props {
  keyboard: Keyboard;
  layer: number;
  selected?: Selected | null;
  onKeySelect: (row: number, col: number) => void;
  onEncoderSelect: (index: number, direction: 0 | 1) => void;
}

export function KeyboardLayout({ keyboard, layer, selected, onKeySelect, onEncoderSelect }: Props) {
  // Physical appearance (size, spacing, case/plate) is shared with the 键盘配色
  // page via context, so tuning it there restyles this interactive board too.
  // Geometry runs through the same helpers as KeyboardLayoutPreview, so the two
  // boards stay pixel-identical — this one just swaps read-only divs for
  // clickable buttons and captions the active layer instead of layer 0.
  const { size, spacing, keycapWidth, caseRadius, caseThickness, caseColor, plateColor } =
    usePreviewAppearance();
  const { PITCH, inset, outerRadius, innerRadius, showCase } = appearanceMetrics(
    size,
    spacing,
    keycapWidth,
    caseRadius,
    caseThickness,
  );
  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    // Keyboard mutates in place; layoutOptions is the only geometry input that
    // changes after the initial load.
    [keyboard, keyboard.layoutOptions],
  );

  return (
    <div
      className="keyboard-case"
      style={{
        padding: caseThickness,
        background: showCase ? caseColor : "transparent",
        borderRadius: showCase ? outerRadius : 0,
        width: "fit-content",
      }}
    >
      <div
        className="keyboard-layout"
        style={{
          width: placed.width * PITCH + inset,
          height: placed.height * PITCH + inset,
          background: plateColor,
          borderRadius: innerRadius,
        }}
      >
        {placed.keys
          .filter(({ key }) => !key.decal)
          .map(({ key, shiftX, shiftY }) => {
            const qmkId = keyboard.getKey(layer, key.row, key.col);
            const isSelected =
              selected?.kind === "key" && selected.row === key.row && selected.col === key.col;
            return (
              <button
                key={`${key.row},${key.col}@${key.x},${key.y}`}
                className={isSelected ? "key selected" : "key"}
                title={qmkId}
                onClick={() => onKeySelect(key.row, key.col)}
                style={shapeStyle(key, shiftX, shiftY, PITCH, inset, inset)}
              >
                {hasSecondRect(key) && (
                  <span
                    className="key-part2"
                    style={{
                      left: key.x2 * PITCH,
                      top: key.y2 * PITCH,
                      width: key.width2 * PITCH - inset,
                      height: key.height2 * PITCH - inset,
                    }}
                  />
                )}
                <span className="key-label">{kcLabel(qmkId)}</span>
              </button>
            );
          })}
        {placed.encoders.map(({ encoder, shiftX, shiftY }) => {
          const qmkId = keyboard.getEncoder(layer, encoder.index, encoder.direction);
          const isSelected =
            selected?.kind === "encoder" &&
            selected.index === encoder.index &&
            selected.direction === encoder.direction;
          return (
            <button
              key={`e${encoder.index},${encoder.direction}@${encoder.x},${encoder.y}`}
              className={isSelected ? "encoder selected" : "encoder"}
              title={`Encoder ${encoder.index} ${encoder.direction === 1 ? "CW" : "CCW"}: ${qmkId}`}
              onClick={() => onEncoderSelect(encoder.index, encoder.direction)}
              style={shapeStyle(encoder, shiftX, shiftY, PITCH, inset, inset)}
            >
              <span className="encoder-dir">{encoder.direction === 1 ? "↻" : "↺"}</span>
              <span className="key-label">{kcLabel(qmkId)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
