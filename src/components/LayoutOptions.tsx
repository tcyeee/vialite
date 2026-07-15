import type { Keyboard } from "../protocol/keyboard.ts";

interface Props {
  keyboard: Keyboard;
  /** Called after an option was written to the device, so the parent re-renders. */
  onChange: () => void;
}

/**
 * Layout-option switches from vial.json `layouts.labels`: a bare string is a
 * boolean toggle, an array is a label followed by its choices.
 */
export function LayoutOptions({ keyboard, onChange }: Props) {
  const labels = keyboard.layoutLabels;
  if (!labels || labels.length === 0 || keyboard.layoutOptions < 0) {
    return null;
  }
  const choices = keyboard.layoutChoices;

  const update = async (index: number, value: number) => {
    const next = [...choices];
    next[index] = value;
    try {
      await keyboard.setLayoutOptions(next);
    } finally {
      onChange();
    }
  };

  return (
    <div className="layout-options">
      {labels.map((item, i) =>
        typeof item === "string" ? (
          <label key={i}>
            <input
              type="checkbox"
              checked={choices[i] === 1}
              onChange={(e) => void update(i, e.target.checked ? 1 : 0)}
            />
            {item}
          </label>
        ) : (
          <label key={i}>
            {item[0]}
            <select value={choices[i] ?? 0} onChange={(e) => void update(i, Number(e.target.value))}>
              {item.slice(1).map((opt, j) => (
                <option key={j} value={j}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ),
      )}
    </div>
  );
}
