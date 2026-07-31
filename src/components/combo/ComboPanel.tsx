import { useEffect, useRef, useState, type ReactNode } from "react";
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
  FIELD_ROLE_ROW,
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

/**
 * Wraps a field state that has no role tags of its own (the "add key" button) in the same
 * box-over-tag-line stack a valued field wears, with the tag line left blank. Every field in the
 * table is then exactly one height tall, so a row doesn't grow or shrink as a field flips between
 * empty, being configured and configured.
 */
function FieldStack({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {children}
      <div className={FIELD_ROLE_ROW} aria-hidden />
    </div>
  );
}

/** Width of one field inside a cell. The trigger cell lays several out side by side and wraps
 *  when the viewport is narrow. */
const FIELD_COL = "w-44 shrink-0";

/** Fixed width of the slot column, shared by the header and the {@link RenumberPicker} cell, so
 *  the trigger's width (1- vs 2-digit slot numbers) can't shift the columns beside it. */
const SLOT_COL = "w-24";

/**
 * Trigger fields to render, in slot order: every already-set key, plus (only while at least one
 * slot is still free) the next empty one as an "add key" trigger — rather than always showing all
 * 4 regardless of use.
 */
function keyFieldOrder(keys: ComboEntry["keys"]): number[] {
  const shown = keys.flatMap((k, i) => (k !== "KC_NO" ? [i] : []));
  const nextEmpty = keys.findIndex((k) => k === "KC_NO");
  if (nextEmpty !== -1) shown.push(nextEmpty);
  return shown;
}

const sameOrder = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** How long a trigger field stays where it is before animating into slot order — long enough that
 *  a field doesn't slide out from under the cursor the instant a key is picked or cleared. */
const KEY_REORDER_SETTLE_MS = 500;

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
  /** Panel-level hover-card wiring, spread on each keycap so resting on one explains what it
   *  does (see {@link useKeyInfoHover}). */
  hoverProps: ReturnType<typeof useKeyInfoHover>["hoverProps"];
  /** Closes that hover card — called by the actions that replace the hovered field. */
  hideInfo: () => void;
}

/**
 * One combo slot as a table row. Every row is permanently editable — there's no display/edit
 * flip, so no row-level edit/done/cancel buttons: each cell is the shared
 * {@link ModifierFieldSlot} editor, and every change is written through to the device as it's
 * made.
 */
function ComboRow({
  index,
  entry,
  comboCount,
  usedIndices,
  onSave,
  onDelete,
  onMove,
  hoverProps,
  hideInfo,
}: RowProps) {
  const { t } = useI18n();

  /**
   * Each field in the row (the output key and every trigger key) is either "being configured"
   * (the {@link ModifierFieldSlot} picker plus a confirm button) or, once it holds a real value,
   * "configured" (collapsed to a compact modifier+key display with modify/delete buttons). Only
   * one field may be under configuration at a time — `activeField` names it ("output" or a key
   * index), and setting it to a different field implicitly collapses whichever one it was
   * pointing at, since that field's own "am I active" check simply stops matching.
   */
  const [activeField, setActiveField] = useState<"output" | number | null>(null);

  /**
   * Freezes the trigger fields in the order they're currently on screen, overriding slot order.
   * Slots are refilled lowest-first, so clearing key 1 while key 2 is set leaves the free slot —
   * and with it the "add key" button — sitting *after* key 2; giving it a value would then snap it
   * back in front. The order is held instead until the field is done being edited, and only then
   * (after {@link KEY_REORDER_SETTLE_MS}) is the re-sort played as an animated View Transition.
   */
  const [heldOrder, setHeldOrder] = useState<number[] | null>(null);
  /** True only while that transition runs. The fields carry a `view-transition-name` for exactly
   *  that window, so no other (page-level, theme) transition pulls them into their own groups. */
  const [reordering, setReordering] = useState(false);
  const settleTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const slotOrder = keyFieldOrder(entry.keys);
  // A held order only pins the fields it was captured with: anything since removed drops out, and
  // a newly shown slot (the next "add key" button) joins at the end.
  const fieldOrder = heldOrder
    ? [
        ...heldOrder.filter((i) => slotOrder.includes(i)),
        ...slotOrder.filter((i) => !heldOrder.includes(i)),
      ]
    : slotOrder;

  /** Play the deferred re-sort. The names have to be on the fields *before* the transition
   *  captures the old state, hence the separate `flushSync` ahead of it. */
  const settleOrder = () => {
    settleTimer.current = null;
    flushSync(() => setReordering(true));
    const transition = startViewTransition(() => flushSync(() => setHeldOrder(null)));
    void transition.finished.then(() => setReordering(false));
  };

  /**
   * Arm the re-sort, if one is being held back. Called once the field is finished with — the
   * confirm button, or a clear (which has no confirm step) — never while the picker is still open:
   * the fields must not shuffle around under a pointer that's still working inside one of them.
   */
  const scheduleSettle = () => {
    if (heldOrder === null) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settleOrder, KEY_REORDER_SETTLE_MS);
  };

  const setKeyAt = (i: number, id: string) => {
    const keys = [...entry.keys] as ComboEntry["keys"];
    keys[i] = id;
    // Would this reshuffle the fields already on screen? If so, pin their current order; the timer
    // that eventually releases it is armed by whoever ends the edit, not here.
    const next = keyFieldOrder(keys);
    const held = fieldOrder.filter((k) => next.includes(k));
    if (!sameOrder(held, next.filter((k) => fieldOrder.includes(k)))) {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      setHeldOrder(held);
      // A clear ends the edit by itself — nothing follows it to arm the settle, so do it here.
      if (id === "KC_NO") settleTimer.current = window.setTimeout(settleOrder, KEY_REORDER_SETTLE_MS);
    }
    onSave({ keys });
  };

  /** One field: the picker while it's the active one, an "add" button while empty, otherwise the
   *  compact configured summary. Shared by the trigger keys and the output key. */
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
            onClick={() => {
              setActiveField(null);
              scheduleSettle();
            }}
          />
        }
      />
    ) : qmkId === "KC_NO" ? (
      // Untouched slot: switches this field to the editor instead of popping the picker directly,
      // and (being the new active field) collapses whichever other field was mid-edit.
      <FieldStack>
        <button
          type="button"
          onClick={() => setActiveField(id)}
          className="btn btn-sm min-h-9 w-full gap-1 py-0.5 text-xs btn-dash"
        >
          <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
          {t("fieldAddRegularKey")}
        </button>
      </FieldStack>
    ) : (
      <ConfiguredFieldRow
        qmkId={qmkId}
        // Both actions swap this field for something else, so the card describing it has to go
        // with it — the pointer stays put and no `mouseleave` ever fires.
        onEdit={() => {
          hideInfo();
          setActiveField(id);
        }}
        onDelete={() => {
          hideInfo();
          onClear();
        }}
        reserveRoleRow
        hoverProps={hoverProps(qmkId)}
      />
    );

  return (
    <tr className="group/row hover:bg-base-200/40">
      <td className={`align-top whitespace-nowrap ${SLOT_COL}`}>
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
          {fieldOrder.map((i) => (
            <div
              key={i}
              className={FIELD_COL}
              style={{ viewTransitionName: reordering ? `combo-key-${index}-${i}` : undefined }}
            >
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
        <div className="inline-flex gap-1 opacity-50 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
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

interface Props {
  keyboard: Keyboard;
}

const isUsed = (e: ComboEntry) => e.output !== "KC_NO" || e.keys.some((k) => k !== "KC_NO");

/** How long a just-renumbered row stays put before animating into its sorted position — long
 *  enough that the row doesn't slide out from under the cursor right after the pick. */
const REORDER_SETTLE_MS = 1500;

export function ComboPanel({ keyboard }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { hoverProps, hideInfo, infoCard } = useKeyInfoHover();
  /**
   * A freshly added, still-empty slot. Unused entries are normally hidden, so this is what keeps
   * the new row listed until it's given a value (or deleted again).
   */
  const [draftIndex, setDraftIndex] = useState<number | null>(null);
  /**
   * When set, overrides the natural (ascending) row order so a just-renumbered row stays put for
   * a moment instead of jumping to its new position under the cursor. Cleared inside a View
   * Transition once {@link REORDER_SETTLE_MS} elapses.
   */
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  /** Slot awaiting delete confirmation, or null when the confirm dialog is closed. */
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const reorderTimer = useRef<number | null>(null);

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

  /** Play the deferred re-sort (a row was renumbered) as an animated View Transition. */
  const settlePendingReorder = () => {
    if (reorderTimer.current) {
      clearTimeout(reorderTimer.current);
      reorderTimer.current = null;
    }
    startViewTransition(() => flushSync(() => setPendingOrder(null)));
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
    .filter((i) => isUsed(keyboard.comboEntries[i]) || i === draftIndex);
  const displayOrder = pendingOrder
    ? pendingOrder.filter((i) => sortedVisible.includes(i))
    : sortedVisible;

  /** Move an entry to a different (free) slot number: write it to the new slot, clear the old one. */
  const moveTo = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const src = keyboard.comboEntries[fromIdx];
    // Hold the current visual order, with the moved row renumbered in place, for a beat.
    const heldOrder = displayOrder.map((i) => (i === fromIdx ? toIdx : i));
    try {
      await keyboard.setCombo(toIdx, { ...src, keys: [...src.keys] as ComboEntry["keys"] });
      if (isUsed(src)) {
        await keyboard.setCombo(fromIdx, { keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"], output: "KC_NO" });
      }
      if (draftIndex === fromIdx) setDraftIndex(toIdx);
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      setPendingOrder(heldOrder);
      reorderTimer.current = window.setTimeout(settlePendingReorder, REORDER_SETTLE_MS);
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
    setDraftIndex(freeIdx);
  };

  /** Delete a row. An empty draft row has nothing on the device to erase and nothing to confirm —
   *  it just stops being listed. */
  const handleDelete = (i: number) => {
    if (!isUsed(keyboard.comboEntries[i])) {
      setDraftIndex((d) => (d === i ? null : d));
      return;
    }
    setPendingDelete(i);
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
              <th className={SLOT_COL}>{t("comboColSlot")}</th>
              <th>
                {/* The keys are listed side by side rather than joined by a "+", which would
                    break their alignment with the fields below — the help icon carries the
                    "press them together" part instead. `floating` because the table's
                    `overflow-x-auto` wrapper is a scroll container: a normal CSS tooltip above
                    the header row gets cropped at its top edge whatever its z-index. */}
                <span className="inline-flex items-center gap-1.5">
                  {t("comboColTriggers")}
                  <HelpIcon text={t("comboHint")} floating />
                </span>
              </th>
              <th>{t("comboOutput")}</th>
              <th className="w-20 text-right">{t("comboColActions")}</th>
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
                  onDelete={() => handleDelete(i)}
                  onMove={(toIdx) => void moveTo(i, toIdx)}
                  hoverProps={hoverProps}
                  hideInfo={hideInfo}
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
            setDraftIndex((d) => (d === pendingDelete ? null : d));
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {infoCard}
    </div>
  );
}
