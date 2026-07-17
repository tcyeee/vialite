import type { Keyboard } from "../../protocol/keyboard.ts";
import { KeycodeCascadeSelector } from "../keymap/KeycodeCascadeSelector.tsx";

interface Props {
  qmkId: string;
  onChange: (qmkId: string) => void;
  /** Connected device, for the picker's macro / tap-dance info previews. */
  keyboard?: Keyboard;
  className?: string;
}

/** A single keycode slot (tap dance / combo entry field): shows the current
 *  keycode and opens the cascade selector to reassign it. */
export function KeySlot({ qmkId, onChange, keyboard, className }: Props) {
  return (
    <KeycodeCascadeSelector
      value={qmkId}
      keyboard={keyboard}
      compact
      triggerClassName={
        className ?? "btn btn-outline min-h-12 min-w-24 justify-between py-1 text-xs"
      }
      onPick={(entry) => onChange(entry.qmkId)}
    />
  );
}
