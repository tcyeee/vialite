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
 *  keycode and opens the cascade selector to reassign it.
 *
 *  KC_NO is these fields' "unset" sentinel (it's what the dashed empty-slot
 *  styling keys off), so it reads as an empty slot rather than as the selector's
 *  "基础按键 / 清空按键" entry it technically resolves to. */
export function KeySlot({ qmkId, onChange, keyboard, className }: Props) {
  return (
    <KeycodeCascadeSelector
      value={qmkId === "KC_NO" ? undefined : qmkId}
      placeholder=""
      keyboard={keyboard}
      compact
      fullWidth
      triggerClassName={
        className ?? "btn btn-outline min-h-12 w-full justify-between py-1 text-xs"
      }
      onPick={(entry) => onChange(entry.qmkId)}
    />
  );
}
