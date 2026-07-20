import type { Keyboard } from "../../protocol/keyboard.ts";
import { label, type KeycodeDef } from "../../protocol/keycodes.ts";
import { KeycodeCascadeSelector } from "../keymap/KeycodeCascadeSelector.tsx";

interface Props {
  qmkId: string;
  onChange: (qmkId: string) => void;
  /** Connected device, for the picker's macro / tap-dance info previews. */
  keyboard?: Keyboard;
  className?: string;
  /** Restricts the picker's catalogue — see {@link KeycodeCascadeSelector}'s prop
   *  of the same name. */
  entryFilter?: (entry: KeycodeDef) => boolean;
  /** Trigger text shown while unset (`KC_NO`), overriding the default blank
   *  face — e.g. a "+ Add regular key" placeholder for a field whose empty
   *  state should read as an action rather than a plain empty slot. */
  emptyLabel?: string;
}

/** A single keycode slot (tap dance / combo entry field): shows the current
 *  keycode and opens the cascade selector to reassign it.
 *
 *  The two "clear" keycodes don't get the selector's usual "基础按键 / 清空按键"
 *  trigger text, which reads as a configured key:
 *  - KC_NO is these fields' "unset" sentinel (it's what the dashed empty-slot
 *    styling keys off), so the slot renders blank — an emptied key.
 *  - KC_TRNS keeps its keycap glyph "▽", the same face the keymap shows for a
 *    transparent key.
 *  Both are driven off the parent's `qmkId` rather than the selector's own
 *  picked-id, which would otherwise go stale for KC_NO (it maps to `value`
 *  undefined, so the selector's value-sync effect never re-fires). */
export function KeySlot({ qmkId, onChange, keyboard, className, entryFilter, emptyLabel = "" }: Props) {
  const unset = qmkId === "KC_NO";
  return (
    <KeycodeCascadeSelector
      value={unset ? undefined : qmkId}
      placeholder=""
      triggerLabel={unset ? emptyLabel : qmkId === "KC_TRNS" ? label(qmkId) : undefined}
      keyboard={keyboard}
      compact
      fullWidth
      hideCaret
      entryFilter={entryFilter}
      triggerClassName={
        className ?? "btn btn-outline min-h-12 w-full justify-between py-1 text-xs"
      }
      onPick={(entry) => onChange(entry.qmkId)}
    />
  );
}
