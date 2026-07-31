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
import { useEscapeKey } from "../../hooks/useEscapeKey.ts";
import {
  FieldCancelButton,
  FieldConfirmButton,
  fieldKeyValid,
  FieldValueDisplay,
  FIELD_ACTION_BTN,
  FIELD_BOX,
  FIELD_BOX_INSET,
  FIELD_ROLE_ROW,
  ModifierFieldSlot,
} from "../common/ModifierFieldSlot.tsx";

/** The label text of a field's header line. Passing no `text` renders an invisible placeholder,
 *  keeping a field that needs no label of its own (the output key — its column header already
 *  names it) on the same baseline as the labelled trigger fields beside it. */
function FieldLabel({ text }: { text?: string }) {
  return (
    <span
      className={`truncate text-[0.65rem] tracking-wide uppercase ${text ? "opacity-50" : "opacity-0"}`}
      aria-hidden={text ? undefined : true}
    >
      {text ?? "."}
    </span>
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

/** Width of one field's box inside a cell, {@link FIELD_BOX}'s padding included. The trigger cell
 *  lays several out side by side and wraps when the viewport is narrow. (11rem widened by 15%,
 *  for longer key labels, plus the padding.) */
const FIELD_COL = "w-[13.4rem] shrink-0";

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
  /** The field on *this* row under configuration, or null when the open one (if any) belongs to
   *  another row. Owned by the panel — see {@link ComboPanel}'s `editing`. */
  activeField: "output" | number | null;
  /** That field's pending value, or null when nothing on this row is open. */
  draft: string | null;
  /** Open a field for configuration, seeded with its stored value. */
  onOpenField: (field: "output" | number, qmkId: string) => void;
  /** Record a keystroke of the open field's draft, without touching the device. */
  onDraftChange: (next: string) => void;
  /** Close the open field, discarding its draft (whatever needed writing is written first). */
  onCloseField: () => void;
}

/**
 * One combo slot as a table row. Every row is permanently editable — there's no display/edit
 * flip, so no row-level edit/done/cancel buttons: each cell is the shared
 * {@link ModifierFieldSlot} editor. Edits made inside a field are held as a draft and only
 * written to the device when that field's confirm button is pressed; leaving a field (by opening
 * another one) throws the draft away.
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
  activeField,
  draft,
  onOpenField,
  onDraftChange,
  onCloseField,
}: RowProps) {
  const { t } = useI18n();

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
   *
   * `held` is what {@link setKeyAt} just pinned: a confirm writes and settles in the same handler,
   * so the `heldOrder` state this render closed over is a step behind and can't be trusted.
   */
  const scheduleSettle = (held: number[] | null = heldOrder) => {
    if (held === null) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settleOrder, KEY_REORDER_SETTLE_MS);
  };

  /** Write a trigger key through to the device, returning the field order it pinned (if any) for
   *  {@link scheduleSettle}. */
  const setKeyAt = (i: number, id: string): number[] | null => {
    const keys = [...entry.keys] as ComboEntry["keys"];
    keys[i] = id;
    // Would this reshuffle the fields already on screen? If so, pin their current order; the timer
    // that eventually releases it is armed by whoever ends the edit, not here.
    const next = keyFieldOrder(keys);
    const held = fieldOrder.filter((k) => next.includes(k));
    let pinned = heldOrder;
    if (!sameOrder(held, next.filter((k) => fieldOrder.includes(k)))) {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      setHeldOrder(held);
      pinned = held;
      // A clear ends the edit by itself — nothing follows it to arm the settle, so do it here.
      if (id === "KC_NO") settleTimer.current = window.setTimeout(settleOrder, KEY_REORDER_SETTLE_MS);
    }
    onSave({ keys });
    return pinned;
  };

  /**
   * The line above a field: its label, with that field's buttons pushed to the far end of the
   * same line — confirm/cancel while it's the one being configured, modify/delete (revealed on
   * hover) once it holds a value. The line keeps its height in every state, so a field never
   * reflows under the pointer.
   *
   * `commit` writes the confirmed draft to the device and returns the pinned field order, so the
   * deferred re-sort can be armed off the same click.
   */
  const fieldHeader = (
    id: "output" | number,
    qmkId: string,
    onClear: () => void,
    commit: (next: string) => number[] | null,
    label?: string,
  ) => {
    const value = draft ?? qmkId;
    return (
      <div className="mb-1 flex h-5 items-center justify-between gap-1">
        <FieldLabel text={label} />
        {activeField === id ? (
          <div className="flex shrink-0 gap-1">
            {/* `KC_NO` is a confirmable draft, not an invalid one: the selector's 清空按键 puts the
                field back to empty, and confirming that clears the key exactly like the delete
                button. Only a half-built value (a mask with no key) blocks confirming. */}
            <FieldConfirmButton
              dirty={value !== qmkId}
              disabled={!fieldKeyValid(value)}
              onClick={() => {
                onCloseField();
                // An unchanged field has nothing to write — confirm just closes the editor.
                scheduleSettle(value === qmkId ? heldOrder : commit(value));
              }}
            />
            <FieldCancelButton onClick={onCloseField} />
          </div>
        ) : (
          qmkId !== "KC_NO" && (
            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/field:opacity-100 group-focus-within/field:opacity-100">
              {/* Both actions swap the field below for something else, so the card describing it
                  has to go with it — the pointer stays put and no `mouseleave` ever fires. */}
              <button
                type="button"
                className={`${FIELD_ACTION_BTN} btn-ghost`}
                title={t("edit")}
                onClick={() => {
                  hideInfo();
                  onOpenField(id, qmkId);
                }}
              >
                <Icon icon="mdi:pencil" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={`${FIELD_ACTION_BTN} btn-ghost hover:text-error`}
                title={t("delete")}
                onClick={() => {
                  hideInfo();
                  onClear();
                }}
              >
                <Icon icon="mdi:trash-can-outline" className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        )}
      </div>
    );
  };

  /**
   * One field: the picker while it's the active one, an "add" button while empty, otherwise the
   * read-only value (its actions live in {@link fieldHeader} above it). Shared by the trigger keys
   * and the output key.
   *
   * While active, the field edits {@link draft}; nothing reaches the device until the header's
   * confirm button.
   */
  const field = (id: "output" | number, qmkId: string) => {
    if (activeField === id) return <ModifierFieldSlot qmkId={draft ?? qmkId} onChange={onDraftChange} />;
    if (qmkId === "KC_NO") {
      // Untouched slot: switches this field to the editor, which (being the new active field)
      // discards whichever other field was mid-edit and opens the picker with itself.
      return (
        <FieldStack>
          <button
            type="button"
            onClick={() => onOpenField(id, qmkId)}
            className="btn btn-sm min-h-9 w-full gap-1 py-0.5 text-xs btn-dash"
          >
            <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
            {t("fieldAddRegularKey")}
          </button>
        </FieldStack>
      );
    }
    // The key itself is the way back into the editor, so changing one takes a single click on it
    // rather than a detour through the header's modify button.
    return (
      <FieldValueDisplay
        qmkId={qmkId}
        reserveRoleRow
        {...hoverProps(qmkId)}
        onActivate={() => {
          hideInfo();
          onOpenField(id, qmkId);
        }}
      />
    );
  };

  /** Classes of one field's box: the padded frame around its header and key, ringed while it's
   *  the field under configuration. */
  const fieldBox = (id: "output" | number) =>
    `group/field ${FIELD_COL} ${FIELD_BOX} ${activeField === id ? "field-selected" : ""}`;

  return (
    <tr className="group/row hover:bg-base-200/40">
      <td className={`align-top whitespace-nowrap ${SLOT_COL}`}>
        <div className={FIELD_BOX_INSET}>
          <RenumberPicker
            index={index}
            count={comboCount}
            usedIndices={usedIndices}
            icon="mdi:vector-combine"
            title={t("comboRenumber")}
            onMove={onMove}
          />
        </div>
      </td>
      <td className="align-top">
        <div className="flex flex-wrap items-start gap-2">
          {fieldOrder.map((i) => (
            <div
              key={i}
              className={fieldBox(i)}
              style={{ viewTransitionName: reordering ? `combo-key-${index}-${i}` : undefined }}
            >
              {fieldHeader(
                i,
                entry.keys[i],
                () => setKeyAt(i, "KC_NO"),
                (id) => setKeyAt(i, id),
                t("comboKeyN", { n: i + 1 }),
              )}
              {field(i, entry.keys[i])}
            </div>
          ))}
        </div>
      </td>
      <td className="align-top">
        <div className={fieldBox("output")}>
          {/* The output field isn't part of the trigger row, so writing it pins no order. */}
          {fieldHeader("output", entry.output, () => onSave({ output: "KC_NO" }), (id) => {
            onSave({ output: id });
            return heldOrder;
          })}
          {field("output", entry.output)}
        </div>
      </td>
      <td className="text-right align-top">
        <div
          className={`${FIELD_BOX_INSET} inline-flex gap-1 opacity-50 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100`}
        >
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
   * The one field being configured anywhere on the page: which row, which of its fields (the
   * output key or a trigger index), and that field's pending value. Held here rather than per row
   * so opening a field closes whichever one was open *on any row* — with a page of rows each
   * keeping its own open field, several half-finished pickers could sit around at once, and only
   * one of them would ever be the one the confirm button in front of you belongs to.
   *
   * `draft` is why nothing reaches the device until confirm: abandoning a field — by opening
   * another, here or on a different row — simply drops this record and leaves the slot as it was.
   */
  const [editing, setEditing] = useState<
    { row: number; field: "output" | number; draft: string } | null
  >(null);
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

  // Escape backs out of the selected field. Same effect as opening another one: the draft is
  // dropped and nothing reaches the device, so the slot is left exactly as it was.
  useEscapeKey(editing !== null, () => setEditing(null));

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

  /** Drop the open field if it belongs to row `i` — whose entry is about to move or disappear,
   *  taking the draft's meaning with it. */
  const closeEditingOn = (i: number) => setEditing((e) => (e?.row === i ? null : e));

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
      closeEditingOn(fromIdx);
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
    closeEditingOn(i);
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
                  activeField={editing?.row === i ? editing.field : null}
                  draft={editing?.row === i ? editing.draft : null}
                  onOpenField={(field, qmkId) => setEditing({ row: i, field, draft: qmkId })}
                  onDraftChange={(next) =>
                    setEditing((e) => (e?.row === i ? { ...e, draft: next } : e))
                  }
                  onCloseField={() => setEditing(null)}
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
