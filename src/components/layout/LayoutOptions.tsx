import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";
import { useWriteError } from "../../hooks/useWriteError.ts";

interface Props {
  keyboard: Keyboard;
  /**
   * Extra rows appended after the device-defined options (e.g. the 全屏预览
   * trigger), which aren't tied to `vial.json` layout labels at all. Kept
   * `LayoutOptions` rendering even when the device exposes no layout choices,
   * so these still show up under the same 布局选项 heading.
   */
  children?: ReactNode;
}

/**
 * Layout-option switches from vial.json `layouts.labels`: a bare string is a
 * boolean toggle, an array is a label followed by its choices.
 */
export function LayoutOptions({ keyboard, children }: Props) {
  const onWriteError = useWriteError();
  const labels = keyboard.layoutLabels;
  const hasDeviceOptions = !!labels && labels.length > 0 && keyboard.layoutOptions >= 0;
  if (!hasDeviceOptions && !children) {
    return null;
  }
  const choices = keyboard.layoutChoices;

  const update = async (index: number, value: number) => {
    const next = [...choices];
    next[index] = value;
    try {
      await keyboard.setLayoutOptions(next);
    } catch (err) {
      // Every caller here is a `void update(...)` from an input handler, so an uncaught
      // rejection would be swallowed by the runtime and the switch would just sit there
      // showing a value the device never took.
      onWriteError(err);
    }
  };

  return (
    <ul className="list rounded-box border border-brand-outline/30">
      {hasDeviceOptions &&
        labels!.map((item, i) =>
          typeof item === "string" ? (
            <SettingsRow
              key={i}
              icon={<Icon icon="mdi:view-list-outline" className="h-4.5 w-4.5" />}
              label={item}
              control={
                <input
                  type="checkbox"
                  className="toggle mr-2"
                  checked={choices[i] === 1}
                  onChange={(e) => void update(i, e.target.checked ? 1 : 0)}
                  aria-label={item}
                />
              }
            />
          ) : (
            <SettingsRow
              key={i}
              icon={<Icon icon="mdi:view-list-outline" className="h-4.5 w-4.5" />}
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
      {children}
    </ul>
  );
}

