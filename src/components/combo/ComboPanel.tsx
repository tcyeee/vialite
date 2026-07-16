import { useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import type { ComboEntry, Keyboard } from "../../protocol/keyboard.ts";
import { useToast } from "../../contexts/toast.tsx";
import { KeySlot } from "../common/KeySlot.tsx";

interface Props {
  keyboard: Keyboard;
  /** Called after an entry was written to the device, so the parent re-renders. */
  onChange: () => void;
}

export function ComboPanel({ keyboard, onChange }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [active, setActive] = useState(0);

  if (keyboard.comboCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("comboNone")}</p>;
  }

  const entry = keyboard.comboEntries[active];
  const usedCount = keyboard.comboEntries.filter((e) => e.output !== "KC_NO").length;

  const update = async (patch: Partial<ComboEntry>) => {
    try {
      await keyboard.setCombo(active, { ...entry, ...patch });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      onChange();
    }
  };

  const setKeyAt = (index: number, qmkId: string) => {
    const keys = [...entry.keys] as ComboEntry["keys"];
    keys[index] = qmkId;
    void update({ keys });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <progress className="progress w-40" value={usedCount} max={Math.max(keyboard.comboCount, 1)} />
        <span className="text-xs text-brand-on-surface-variant">
          {t("comboUsed", { used: usedCount, total: keyboard.comboCount })}
        </span>
      </div>
      <div className="tabs tabs-box w-fit">
        {keyboard.comboEntries.map((_, i) => (
          <button
            key={i}
            type="button"
            className={i === active ? "tab tab-active" : "tab"}
            onClick={() => setActive(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <fieldset className="fieldset w-fit rounded-box border border-brand-outline/30 p-4">
        <legend className="fieldset-legend">{t("comboLegend", { n: active + 1 })}</legend>

        {entry.keys.map((qmkId, i) => (
          <div key={i}>
            <label className="fieldset-label">{t("comboKeyN", { n: i + 1 })}</label>
            <KeySlot qmkId={qmkId} onChange={(id) => setKeyAt(i, id)} />
          </div>
        ))}

        <label className="fieldset-label">{t("comboOutput")}</label>
        <KeySlot qmkId={entry.output} onChange={(id) => void update({ output: id })} />
      </fieldset>
      <p className="max-w-md text-xs text-brand-on-surface-variant">{t("comboHint")}</p>
    </div>
  );
}
