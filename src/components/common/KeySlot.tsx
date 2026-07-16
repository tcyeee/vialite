import { useState } from "react";
import { label as kcLabel } from "../../protocol/keycodes.ts";
import { KeycodePicker } from "./KeycodePicker.tsx";

interface Props {
  qmkId: string;
  onChange: (qmkId: string) => void;
  className?: string;
}

/** A single keycode slot (tap dance / combo entry field): shows the current label, opens a KeycodePicker on click. */
export function KeySlot({ qmkId, onChange, className }: Props) {
  const [picking, setPicking] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className ?? "btn btn-outline min-h-12 min-w-24 flex-wrap py-1 text-xs whitespace-pre-line"}
        title={qmkId}
        onClick={() => setPicking(true)}
      >
        {kcLabel(qmkId)}
      </button>
      {picking && (
        <KeycodePicker
          onPick={(id) => {
            setPicking(false);
            onChange(id);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
