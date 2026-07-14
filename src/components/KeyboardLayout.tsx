import type { Keyboard } from "../protocol/keyboard.ts";
import { label as kcLabel } from "../protocol/keycodes.ts";

const UNIT = 54;

interface Props {
  keyboard: Keyboard;
  layer: number;
  onKeySelect: (row: number, col: number) => void;
}

export function KeyboardLayout({ keyboard, layer, onKeySelect }: Props) {
  const rightEdges = [
    ...keyboard.keys.map((k) => k.x + k.width),
    ...keyboard.encoders.map((e) => e.x + e.width),
    0,
  ];
  const bottomEdges = [
    ...keyboard.keys.map((k) => k.y + k.height),
    ...keyboard.encoders.map((e) => e.y + e.height),
    0,
  ];

  return (
    <div
      className="keyboard-layout"
      style={{ width: Math.max(...rightEdges) * UNIT, height: Math.max(...bottomEdges) * UNIT }}
    >
      {keyboard.keys.map((key) => {
        const qmkId = keyboard.getKey(layer, key.row, key.col);
        return (
          <button
            key={`${key.row},${key.col}`}
            className="key"
            title={qmkId}
            onClick={() => onKeySelect(key.row, key.col)}
            style={{
              left: key.x * UNIT,
              top: key.y * UNIT,
              width: key.width * UNIT - 4,
              height: key.height * UNIT - 4,
            }}
          >
            {kcLabel(qmkId)}
          </button>
        );
      })}
      {keyboard.encoders.map((encoder) => (
        <div
          key={`encoder-${encoder.index}`}
          className="encoder"
          title={`Encoder ${encoder.index}`}
          style={{
            left: encoder.x * UNIT,
            top: encoder.y * UNIT,
            width: encoder.width * UNIT - 4,
            height: encoder.height * UNIT - 4,
          }}
        />
      ))}
    </div>
  );
}
