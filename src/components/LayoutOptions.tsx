import type { SVGProps } from "react";
import type { Keyboard } from "../protocol/keyboard.ts";
import { SettingsRow } from "./QmkSettingsPanel.tsx";

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
    <ul className="list rounded-box border border-brand-outline/30">
      {labels.map((item, i) =>
        typeof item === "string" ? (
          <SettingsRow
            key={i}
            icon={<LayoutOptionIcon className="h-4.5 w-4.5" />}
            label={item}
            control={
              <input
                type="checkbox"
                className="toggle"
                checked={choices[i] === 1}
                onChange={(e) => void update(i, e.target.checked ? 1 : 0)}
                aria-label={item}
              />
            }
          />
        ) : (
          <SettingsRow
            key={i}
            icon={<LayoutOptionIcon className="h-4.5 w-4.5" />}
            label={item[0]}
            control={
              <select
                className="select select-sm select-bordered"
                value={choices[i] ?? 0}
                onChange={(e) => void update(i, Number(e.target.value))}
                aria-label={item[0]}
              >
                {item.slice(1).map((opt, j) => (
                  <option key={j} value={j}>
                    {opt}
                  </option>
                ))}
              </select>
            }
          />
        ),
      )}
    </ul>
  );
}

function LayoutOptionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path strokeLinecap="round" d="M7.5 10h3M7.5 14h9" />
    </svg>
  );
}
