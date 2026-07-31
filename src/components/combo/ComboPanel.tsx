import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import type { ComboEntry, Keyboard } from "../../protocol/keyboard.ts";
import { useToast } from "../../contexts/toast.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { RenumberPicker } from "../common/RenumberPicker.tsx";
import { ConfirmDialog } from "../common/ConfirmDialog.tsx";
import { startViewTransition } from "../common/viewTransition.ts";
import { useKeyInfoHover } from "../common/useKeyInfoHover.tsx";
import {
  ConfiguredFieldRow,
  FieldConfirmButton,
  fieldKeyValid,
  FieldValueDisplay,
  ModifierFieldSlot,
} from "../common/ModifierFieldSlot.tsx";

/** Label line above a field. `placeholder` renders an invisible one, keeping a field that needs
 *  no label of its own (the output key — its column header already names it) on the same
 *  baseline as the labelled trigger fields beside it. */
function FieldLabel({ text }: { text?: string }) {
  return (
    <div
      className={`mb-1 text-[0.65rem] tracking-wide uppercase ${text ? "opacity-50" : "opacity-0"}`}
      aria-hidden={text ? undefined : true}
    >
      {text ?? "."}
    </div>
  );
}

/** Read-only counterpart of the editor's dashed "add" button, for a half-filled entry (trigger
 *  keys but no output, or the reverse) — the same dashed box with nothing to add. */
const FIELD_KEY_BOX_EMPTY = "btn btn-sm min-h-9 w-full py-0.5 text-xs opacity-50 btn-dash";

/** Width of one field inside a cell, applied in both states: an editable field (key box plus its
 *  role tags) and its read-only counterpart line up column for column. The trigger cell lays
 *  several out side by side and wraps when the viewport is narrow. */
const FIELD_COL = "w-44 shrink-0";

interface RowProps {
  index: number;
  entry: ComboEntry;
  /** Total number of combo slots on the device, for the renumber picker. */
  comboCount: number;
  /** Slot indices already occupied by another entry — greyed out in the renumber picker. */
  usedIndices: Set<number>;
  onSave: (patch: Partial<ComboEntry>) => void;
  onDelete: () => void;
  /** Moves this entry to a different (free) slot number, from the renumber picker. */
  onMove: (toIdx: number) => void;
  /** Whether this row is the single one currently switched to its editable cells (parent-owned). */
  editing: boolean;
  /** Enter edit mode — the parent makes this the one editing row, closing any other. */
  onEdit: () => void;
  /** Leave edit mode (the "done" button); the parent also drops the slot if it's still unused. */
  onCloseEdit: () => void;
  /** Discard edits (the "cancel" button) — restores the entry to its value from when editing began. */
  onCancel: () => void;
  /** Panel-level hover-card wiring, spread on each read-only keycap so resting on one explains
   *  what it does (see {@link useKeyInfoHover}). */
  hoverProps: ReturnType<typeof useKeyInfoHover>["hoverProps"];
}

/**
 * One combo slot as a table row. In its display state the cells are read-only keycap faces; in
 * edit mode the same cells turn into the shared {@link ModifierFieldSlot} editors in place, so
 * editing never leaves the table.
 */
function ComboRow({
  index,
  entry,
  comboCount,
  usedIndices,
  onSave,
  onDelete,
  onMove,
  editing,
  onEdit,
  onCloseEdit,
  onCancel,
  hoverProps,
}: RowProps) {
  const { t } = useI18n();

  /**
   * Each field in the row (the output key and every trigger key) is either "being configured"
   * (the {@link ModifierFieldSlot} picker plus a confirm button) or, once it holds a real value,
   * "configured" (collapsed to a compact modifier+key display with modify/delete buttons). Only
   * one field may be under configuration at a time — `activeField` names it ("output" or a key
   * index), and setting it to a different field implicitly collapses whichever one it was
   * pointing at, since that field's own "am I active" check simply stops matching. Reset to null
   * whenever the row (re-)enters edit mode.
   */
  const [activeField, setActiveField] = useState<"output" | number | null>(null);
  useEffect(() => {
    if (!editing) return;
    setActiveField(null);
    // Only re-seed when a row newly enters edit mode, not on every entry edit within the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const setKeyAt = (i: number, id: string) => {
    const keys = [...entry.keys] as ComboEntry["keys"];
    keys[i] = id;
    onSave({ keys });
  };

  // Slots to render in the trigger cell: every already-set key, plus (only while at least one
  // slot is still free) the next empty one as an "add key" trigger — rather than always showing
  // all 4 regardless of use.
  const nextEmptyKeyIndex = entry.keys.findIndex((k) => k === "KC_NO");
  const visibleKeyIndices = entry.keys.flatMap((k, i) => (k !== "KC_NO" ? [i] : []));
  if (nextEmptyKeyIndex !== -1) visibleKeyIndices.push(nextEmptyKeyIndex);
  const setKeyIndices = entry.keys.flatMap((k, i) => (k !== "KC_NO" ? [i] : []));

  /** One editable field: the picker while it's the active one, an "add" button while empty,
   *  otherwise the compact configured summary. Shared by the trigger keys and the output key. */
  const field = (
    id: "output" | number,
    qmkId: string,
    onChange: (next: string) => void,
    onClear: () => void,
  ) =>
    activeField === id ? (
      <ModifierFieldSlot
        qmkId={qmkId}
        onChange={onChange}
        trailing={
          <FieldConfirmButton
            disabled={!fieldKeyValid(qmkId) || qmkId === "KC_NO"}
            onClick={() => setActiveField(null)}
          />
        }
      />
    ) : qmkId === "KC_NO" ? (
      // Untouched slot: switches this field to the editor instead of popping the picker directly,
      // and (being the new active field) collapses whichever other field was mid-edit.
      <button
        type="button"
        onClick={() => setActiveField(id)}
        className="btn btn-sm min-h-9 w-full gap-1 py-0.5 text-xs btn-dash"
      >
        <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
        {t("fieldAddRegularKey")}
      </button>
    ) : (
      <ConfiguredFieldRow qmkId={qmkId} onEdit={() => setActiveField(id)} onDelete={onClear} />
    );

  if (!editing) {
    return (
      <tr className="group/row hover:bg-base-200/60">
        <td className="font-mono text-base font-bold whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            <Icon icon="mdi:vector-combine" className="h-4 w-4 opacity-60" />
            {index}
          </span>
        </td>
        <td>
          {/* Same wrapping row of labelled, fixed-width fields the edit state lays out — only
              the picker affordances are missing — so the row keeps its shape when it flips. */}
          <div className="flex flex-wrap items-start gap-2">
            {setKeyIndices.length === 0 ? (
              <div className={FIELD_COL}>
                <FieldLabel text={t("comboKeyN", { n: 1 })} />
                <div className={FIELD_KEY_BOX_EMPTY}>—</div>
              </div>
            ) : (
              setKeyIndices.map((i) => (
                <div key={i} className={FIELD_COL}>
                  <FieldLabel text={t("comboKeyN", { n: i + 1 })} />
                  <FieldValueDisplay qmkId={entry.keys[i]} {...hoverProps(entry.keys[i])} />
                </div>
              ))
            )}
          </div>
        </td>
        <td>
          <div className={FIELD_COL}>
            <FieldLabel />
            {entry.output === "KC_NO" ? (
              <div className={FIELD_KEY_BOX_EMPTY}>—</div>
            ) : (
              <FieldValueDisplay qmkId={entry.output} {...hoverProps(entry.output)} />
            )}
          </div>
        </td>
        <td className="text-right">
          <div className="inline-flex gap-1 opacity-50 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
            <button type="button" className="btn btn-ghost btn-sm px-2" title={t("edit")} onClick={onEdit}>
              <Icon icon="mdi:pencil" className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm px-2 hover:text-error"
              title={t("delete")}
              onClick={onDelete}
            >
              <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-base-200/50">
      <td className="align-top">
        <RenumberPicker
          index={index}
          count={comboCount}
          usedIndices={usedIndices}
          icon="mdi:vector-combine"
          title={t("comboRenumber")}
          onMove={onMove}
        />
      </td>
      <td className="align-top">
        <div className="flex flex-wrap items-start gap-2">
          {visibleKeyIndices.map((i) => (
            <div key={i} className={FIELD_COL}>
              <FieldLabel text={t("comboKeyN", { n: i + 1 })} />
              {field(i, entry.keys[i], (id) => setKeyAt(i, id), () => setKeyAt(i, "KC_NO"))}
            </div>
          ))}
        </div>
      </td>
      <td className="align-top">
        <div className={FIELD_COL}>
          <FieldLabel />
          {field(
            "output",
            entry.output,
            (id) => onSave({ output: id }),
            () => onSave({ output: "KC_NO" }),
          )}
        </div>
      </td>
      <td className="text-right align-top">
        <div className="inline-flex gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onCloseEdit}>
            {t("done")}
          </button>
        </div>
      </td>
    </tr>
  );
}

interface Props {
  keyboard: Keyboard;
}

const isUsed = (e: ComboEntry) => e.output !== "KC_NO" || e.keys.some((k) => k !== "KC_NO");

export function ComboPanel({ keyboard }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { hoverProps, infoCard } = useKeyInfoHover();
  /**
   * The single slot currently switched to its editable cells. Parent-owned so only one row edits
   * at a time, and it doubles as the "freshly added, still-unused slot" marker (listed even while
   * the entry is still empty).
   */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /**
   * When set, overrides the natural (ascending) row order so a just-renumbered row stays put for
   * the rest of the edit session instead of jumping to its new position mid-edit. Cleared inside
   * a View Transition once editing ends.
   */
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  /** Slot awaiting delete confirmation, or null when the confirm dialog is closed. */
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const reorderTimer = useRef<number | null>(null);
  /** The entry's value captured when editing began, restored verbatim if the user clicks Cancel. */
  const editSnapshot = useRef<ComboEntry | null>(null);

  useEffect(() => () => {
    if (reorderTimer.current) clearTimeout(reorderTimer.current);
  }, []);

  const cancelPendingReorder = () => {
    if (reorderTimer.current) {
      clearTimeout(reorderTimer.current);
      reorderTimer.current = null;
    }
    setPendingOrder(null);
  };

  /** Play the deferred re-sort (a row was renumbered while editing) as an animated View Transition. */
  const settlePendingReorder = () => {
    if (reorderTimer.current) {
      clearTimeout(reorderTimer.current);
      reorderTimer.current = null;
    }
    startViewTransition(() => flushSync(() => setPendingOrder(null)));
  };

  const snapshotOf = (i: number): ComboEntry => {
    const e = keyboard.comboEntries[i];
    return { ...e, keys: [...e.keys] as ComboEntry["keys"] };
  };

  const handleEdit = (i: number) => {
    // Switching to another row settles the previous row's pending re-sort first.
    if (pendingOrder) settlePendingReorder();
    editSnapshot.current = snapshotOf(i);
    setEditingIndex(i);
  };

  const handleCloseEdit = () => {
    if (editingIndex !== null) {
      const e = keyboard.comboEntries[editingIndex];
      const invalid = !fieldKeyValid(e.output) || e.keys.some((k) => !fieldKeyValid(k));
      if (invalid) {
        showToast(t("fieldInvalidKeycode"));
        return;
      }
    }
    editSnapshot.current = null;
    setEditingIndex(null);
    // Only now does the row animate into its sorted position.
    if (pendingOrder) settlePendingReorder();
  };

  /** Discard edits: restore the entry to its pre-edit value, then leave edit mode with no animation. */
  const handleCancel = () => {
    const idx = editingIndex;
    const snap = editSnapshot.current;
    editSnapshot.current = null;
    cancelPendingReorder();
    setEditingIndex(null);
    if (idx !== null && snap) void updateAt(idx, snap);
  };

  if (keyboard.comboCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("comboNone")}</p>;
  }

  const usedCount = keyboard.comboEntries.filter(isUsed).length;

  const updateAt = async (idx: number, patch: Partial<ComboEntry>) => {
    try {
      await keyboard.setCombo(idx, { ...keyboard.comboEntries[idx], ...patch });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  const clearAt = (idx: number) =>
    void updateAt(idx, { keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"], output: "KC_NO" });

  const usedIndices = new Set(keyboard.comboEntries.flatMap((e, i) => (isUsed(e) ? [i] : [])));

  /** Rows to show, in the order to show them — `pendingOrder` while a renumber is settling. */
  const sortedVisible = keyboard.comboEntries
    .map((_, i) => i)
    .filter((i) => isUsed(keyboard.comboEntries[i]) || i === editingIndex);
  const displayOrder = pendingOrder
    ? pendingOrder.filter((i) => sortedVisible.includes(i))
    : sortedVisible;

  /** Move an entry to a different (free) slot number: write it to the new slot, clear the old one. */
  const moveTo = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const src = keyboard.comboEntries[fromIdx];
    // Hold the current visual order, with the moved row renumbered in place, until editing ends.
    const heldOrder = displayOrder.map((i) => (i === fromIdx ? toIdx : i));
    try {
      await keyboard.setCombo(toIdx, { ...src, keys: [...src.keys] as ComboEntry["keys"] });
      if (isUsed(src)) {
        await keyboard.setCombo(fromIdx, { keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"], output: "KC_NO" });
      }
      // Keep the row in place, still in edit mode; the re-sort waits until "done" is clicked.
      if (reorderTimer.current) {
        clearTimeout(reorderTimer.current);
        reorderTimer.current = null;
      }
      setEditingIndex(toIdx);
      setPendingOrder(heldOrder);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAdd = () => {
    const freeIdx = keyboard.comboEntries.findIndex((e) => !isUsed(e));
    if (freeIdx === -1) {
      showToast(t("comboFull"));
      return;
    }
    cancelPendingReorder();
    editSnapshot.current = snapshotOf(freeIdx);
    setEditingIndex(freeIdx);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <progress className="progress h-3 w-64" value={usedCount} max={Math.max(keyboard.comboCount, 1)} />
        <span className="text-xs text-brand-on-surface-variant">
          {t("comboUsed", { used: usedCount, total: keyboard.comboCount })}
        </span>
        <HelpIcon text={t("comboUsedHelp")} />
        <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={handleAdd}>
          <Icon icon="mdi:plus" className="h-4 w-4" />
          {t("comboAdd")}
        </button>
      </div>
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table">
          <thead>
            <tr>
              <th className="w-16">{t("comboColSlot")}</th>
              <th>
                {/* The keys are listed side by side rather than joined by a "+", which would
                    break their alignment with the edit state's fields — the help icon carries
                    the "press them together" part instead. */}
                <span className="inline-flex items-center gap-1.5">
                  {t("comboColTriggers")}
                  <HelpIcon text={t("comboHint")} />
                </span>
              </th>
              <th>{t("comboOutput")}</th>
              <th className="w-40 text-right">{t("comboColActions")}</th>
            </tr>
          </thead>
          <tbody>
            {displayOrder.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-brand-on-surface-variant">
                  {t("comboEmpty")}
                </td>
              </tr>
            ) : (
              displayOrder.map((i) => (
                <ComboRow
                  key={i}
                  index={i}
                  entry={keyboard.comboEntries[i]}
                  comboCount={keyboard.comboCount}
                  usedIndices={usedIndices}
                  onSave={(patch) => void updateAt(i, patch)}
                  onDelete={() => setPendingDelete(i)}
                  onMove={(toIdx) => void moveTo(i, toIdx)}
                  editing={i === editingIndex}
                  onEdit={() => handleEdit(i)}
                  onCloseEdit={handleCloseEdit}
                  onCancel={handleCancel}
                  hoverProps={hoverProps}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {pendingDelete !== null && (
        <ConfirmDialog
          message={t("comboDeleteConfirm")}
          onConfirm={() => {
            clearAt(pendingDelete);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {infoCard}
    </div>
  );
}
