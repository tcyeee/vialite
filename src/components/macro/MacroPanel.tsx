import { Fragment, useEffect, useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { VIAL_PROTOCOL_ADVANCED_MACROS } from "../../protocol/constants.ts";
import type { Keyboard, MacroAction } from "../../protocol/keyboard.ts";
import { serializeMacro, serializeMacros } from "../../protocol/macro.ts";
import { useToast } from "../../contexts/toast.tsx";
import { KeySlot } from "../common/KeySlot.tsx";
import { KeycodePicker } from "../common/KeycodePicker.tsx";
import { UnlockDialog } from "../common/UnlockDialog.tsx";

interface Props {
  keyboard: Keyboard;
  /** Called after macros were written to the device, so the parent re-renders. */
  onChange: () => void;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function RowControls({
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="ml-auto flex shrink-0 gap-1">
      <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={onMoveUp} aria-label="up">
        ↑
      </button>
      <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={onMoveDown} aria-label="down">
        ↓
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle text-error"
        onClick={onRemove}
        aria-label="remove"
      >
        ✕
      </button>
    </div>
  );
}

function AddKeycodeButton({ onPick }: { onPick: (qmkId: string) => void }) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-dash btn-xs" onClick={() => setPicking(true)}>
        +
      </button>
      {picking && (
        <KeycodePicker
          onPick={(id) => {
            setPicking(false);
            onPick(id);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function AddActionButton({
  kind,
  label,
  onAdd,
}: {
  kind: "tap" | "down" | "up";
  label: string;
  onAdd: (action: MacroAction) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-sm btn-outline" onClick={() => setPicking(true)}>
        {label}
      </button>
      {picking && (
        <KeycodePicker
          onPick={(id) => {
            setPicking(false);
            onAdd({ kind, keycodes: [id] });
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function MacroActionRow({
  action,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  action: MacroAction;
  onChange: (next: MacroAction) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { t } = useI18n();

  if (action.kind === "text") {
    return (
      <div className="flex items-center gap-2 rounded-box border border-brand-outline/20 p-2">
        <span className="badge badge-neutral">{t("macroActionText")}</span>
        <input
          type="text"
          className="input input-sm flex-1"
          value={action.text}
          onChange={(e) => onChange({ ...action, text: e.target.value })}
        />
        <RowControls onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      </div>
    );
  }

  if (action.kind === "delay") {
    return (
      <div className="flex items-center gap-2 rounded-box border border-brand-outline/20 p-2">
        <span className="badge badge-neutral">{t("macroActionDelay")}</span>
        <input
          type="number"
          className="input input-sm w-28"
          min={0}
          value={action.ms}
          onChange={(e) => onChange({ ...action, ms: Number(e.target.value) })}
        />
        <span className="text-xs text-brand-on-surface-variant">ms</span>
        <RowControls onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      </div>
    );
  }

  const kindLabel = { tap: t("macroActionTap"), down: t("macroActionDown"), up: t("macroActionUp") }[action.kind];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-box border border-brand-outline/20 p-2">
      <span className="badge badge-neutral">{kindLabel}</span>
      {action.keycodes.map((qmkId, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          <KeySlot
            qmkId={qmkId}
            className="btn btn-outline btn-xs min-h-8 whitespace-pre-line"
            onChange={(id) => {
              const next = [...action.keycodes];
              next[i] = id;
              onChange({ ...action, keycodes: next });
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            aria-label="remove keycode"
            onClick={() => onChange({ ...action, keycodes: action.keycodes.filter((_, idx) => idx !== i) })}
          >
            ✕
          </button>
        </span>
      ))}
      <AddKeycodeButton onPick={(id) => onChange({ ...action, keycodes: [...action.keycodes, id] })} />
      <RowControls onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
    </div>
  );
}

export function MacroPanel({ keyboard, onChange }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [active, setActive] = useState(0);
  const [edited, setEdited] = useState<MacroAction[][]>(() => keyboard.macros);
  const [savedMacros, setSavedMacros] = useState<MacroAction[][]>(() => keyboard.macros);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    setEdited(keyboard.macros);
    setSavedMacros(keyboard.macros);
    setActive(0);
  }, [keyboard]);

  if (keyboard.macroCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("macroNone")}</p>;
  }

  const supportsDelay = keyboard.vialProtocol >= VIAL_PROTOCOL_ADVANCED_MACROS;
  const actions = edited[active] ?? [];

  let currentBuffer: Uint8Array | null = null;
  let currentSlotBytes: Uint8Array | null = null;
  try {
    currentBuffer = serializeMacros(edited, keyboard.vialProtocol);
    currentSlotBytes = serializeMacro(actions, keyboard.vialProtocol);
  } catch {
    // e.g. a delay action left over on a protocol that doesn't support it.
  }
  const memoryUsed = currentBuffer?.length ?? 0;
  const overBudget = currentBuffer !== null && memoryUsed > keyboard.macroMemory;
  const hasChanges = currentBuffer !== null && !bytesEqual(currentBuffer, serializeMacros(savedMacros, keyboard.vialProtocol));
  const slotChanged =
    currentSlotBytes !== null &&
    !bytesEqual(currentSlotBytes, serializeMacro(savedMacros[active] ?? [], keyboard.vialProtocol));

  const updateActive = (next: MacroAction[]) => {
    setEdited((prev) => prev.map((m, i) => (i === active ? next : m)));
  };
  const addAction = (action: MacroAction) => updateActive([...actions, action]);
  const removeAction = (i: number) => updateActive(actions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, next: MacroAction) => updateActive(actions.map((a, idx) => (idx === i ? next : a)));
  const moveAction = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= actions.length) return;
    const next = [...actions];
    [next[i], next[j]] = [next[j], next[i]];
    updateActive(next);
  };

  const commitSave = async () => {
    setSaving(true);
    try {
      await keyboard.saveMacros(edited);
      setSavedMacros(edited);
      await keyboard.lock().catch(() => {});
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
      onChange();
    }
  };

  const handleSaveClick = async () => {
    try {
      const status = await keyboard.getUnlockStatus();
      if (status.unlocked) {
        await commitSave();
      } else {
        setUnlocking(true);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  const revert = () => {
    setEdited(savedMacros);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center gap-3">
          <progress
            className={overBudget ? "progress progress-error w-40" : "progress w-40"}
            value={Math.min(memoryUsed, keyboard.macroMemory)}
            max={Math.max(keyboard.macroMemory, 1)}
          />
          <span className={overBudget ? "text-xs text-error" : "text-xs text-brand-on-surface-variant"}>
            {t("macroMemoryUsed", { used: memoryUsed, total: keyboard.macroMemory })}
          </span>
        </div>
        <p className="max-w-md text-xs text-brand-on-surface-variant">{t("macroHint", { n: active })}</p>
      </div>
      <div className="tabs tabs-lift">
        {edited.map((_, i) => (
          <Fragment key={i}>
            <input
              type="radio"
              name="macro_tabs"
              className="tab"
              aria-label={`M${i}${slotChanged && i === active ? "*" : ""}`}
              checked={i === active}
              onChange={() => setActive(i)}
            />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              {i === active && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    {actions.length === 0 && (
                      <p className="text-xs text-brand-on-surface-variant">{t("macroEmpty")}</p>
                    )}
                    {actions.map((action, idx) => (
                      <MacroActionRow
                        key={idx}
                        action={action}
                        onChange={(next) => updateAction(idx, next)}
                        onRemove={() => removeAction(idx)}
                        onMoveUp={() => moveAction(idx, -1)}
                        onMoveDown={() => moveAction(idx, 1)}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => addAction({ kind: "text", text: "" })}
                    >
                      {t("macroAddText")}
                    </button>
                    <AddActionButton kind="tap" label={t("macroAddTap")} onAdd={addAction} />
                    <AddActionButton kind="down" label={t("macroAddDown")} onAdd={addAction} />
                    <AddActionButton kind="up" label={t("macroAddUp")} onAdd={addAction} />
                    {supportsDelay && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => addAction({ kind: "delay", ms: 0 })}
                      >
                        {t("macroAddDelay")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Fragment>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={!hasChanges || overBudget || saving || currentBuffer === null}
          onClick={() => void handleSaveClick()}
        >
          {saving ? t("macroSaving") : t("save")}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" disabled={!hasChanges || saving} onClick={revert}>
          {t("revert")}
        </button>
      </div>

      {unlocking && (
        <UnlockDialog
          keyboard={keyboard}
          onUnlocked={() => {
            setUnlocking(false);
            void commitSave();
          }}
          onCancel={() => setUnlocking(false)}
        />
      )}
    </div>
  );
}
