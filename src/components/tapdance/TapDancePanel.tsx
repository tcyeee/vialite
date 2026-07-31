import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@iconify/react";
import { type MessageKey, useI18n } from "../../contexts/i18n.tsx";
import type { Keyboard, TapDanceEntry } from "../../protocol/keyboard.ts";
import { useToast } from "../../contexts/toast.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { RenumberPicker } from "../common/RenumberPicker.tsx";
import { ConfirmDialog } from "../common/ConfirmDialog.tsx";
import { startViewTransition } from "../common/viewTransition.ts";
import { useKeyInfoHover } from "../common/useKeyInfoHover.tsx";
import { useEscapeKey } from "../../hooks/useEscapeKey.ts";
import { useWriteError } from "../../hooks/useWriteError.ts";
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

/** The four tap dance states, in the fixed left-to-right order they occupy as table columns —
 *  unlike the combo table's trigger keys, a state never moves out of its own column, so the
 *  columns stay readable against their headers whether or not each one holds a key. */
type StateField = "onTap" | "onHold" | "onDoubleTap" | "onTapHold";
const STATES: { labelKey: MessageKey; field: StateField }[] = [
  { labelKey: "tapDanceOnTap", field: "onTap" },
  { labelKey: "tapDanceOnHold", field: "onHold" },
  { labelKey: "tapDanceOnDoubleTap", field: "onDoubleTap" },
  { labelKey: "tapDanceOnTapHold", field: "onTapHold" },
];

/**
 * The tapping term, as a fifth editable field of the row. It holds a number rather than a
 * keycode, but it's configured exactly like the four states — one at a time, drafted, confirmed —
 * so it joins them in {@link TapDancePanel}'s `editing` instead of writing through on every
 * keystroke.
 */
const TERM_FIELD = "tappingTerm";
type EditField = StateField | typeof TERM_FIELD;

/** Largest tapping term the box accepts, matching the input's own `max`. */
const TERM_MAX = 10000;

/** Height of the header line above every field, reserved in the cells that have no field of their
 *  own (slot / status) so their content sits on the key boxes' baseline. */
const FIELD_HEADER_ROW = "mb-1 h-5";

/** Width of one state field's box, {@link FIELD_BOX}'s padding included. Every state gets its own
 *  column, so the four are always the same width and always in the same place. */
const FIELD_COL = "w-[11.75rem]";

/** Fixed width of the slot column, shared by the header and the {@link RenumberPicker} cell, so a
 *  1- vs 2-digit slot number can't shift the columns beside it. */
const SLOT_COL = "w-24";

interface RowProps {
  index: number;
  entry: TapDanceEntry;
  /** Total number of tap dance slots on the device, for the renumber picker. */
  tapDanceCount: number;
  /** Whether TD(index) is placed on a key in the keymap (drives the in-use/not-in-use tag). */
  assigned: boolean;
  /** Slot indices already occupied by another entry — greyed out in the renumber picker. */
  usedIndices: Set<number>;
  onSave: (patch: Partial<TapDanceEntry>) => void;
  onDelete: () => void;
  /** Moves this entry to a different (free) slot number, from the renumber picker. */
  onMove: (toIdx: number) => void;
  /** Panel-level hover-card wiring, spread on each keycap so resting on one explains what it
   *  does (see {@link useKeyInfoHover}). */
  hoverProps: ReturnType<typeof useKeyInfoHover>["hoverProps"];
  /** Closes that hover card — called by the actions that replace the hovered field. */
  hideInfo: () => void;
  /** The field on *this* row under configuration (a state, or the tapping term), or null when the
   *  open one (if any) belongs to another row. Owned by the panel — see
   *  {@link TapDancePanel}'s `editing`. */
  activeField: EditField | null;
  /** That field's pending value, or null when nothing on this row is open. */
  draft: string | null;
  /** Open a field for configuration, seeded with its stored value. */
  onOpenField: (field: EditField, value: string) => void;
  /** Record a keystroke of the open field's draft, without touching the device. */
  onDraftChange: (next: string) => void;
  /** Close the open field, discarding its draft (whatever needed writing is written first). */
  onCloseField: () => void;
}

/**
 * One tap dance slot as a table row. Every row is permanently editable — there's no display/edit
 * flip, so no row-level edit/done/cancel buttons: each state cell is the shared
 * {@link ModifierFieldSlot} editor. Edits made inside a field are held as a draft and only
 * written to the device when that field's confirm button is pressed; cancelling it (or opening
 * another field) throws the draft away. Structurally mirrors {@link ../combo/ComboPanel}'s
 * `ComboRow`.
 */
function TapDanceRow({
  index,
  entry,
  tapDanceCount,
  assigned,
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
   * The line above a field: that field's buttons — confirm/cancel while it's the one being
   * configured, modify/delete (revealed on hover) once it holds a value. There's no label — the
   * column header already names the state — but the line keeps its height in every state, so a
   * field never reflows under the pointer.
   */
  const fieldHeader = (field: StateField, qmkId: string) => {
    const value = draft ?? qmkId;
    return (
      <div className={`${FIELD_HEADER_ROW} flex items-center justify-end gap-1`}>
        {activeField === field ? (
          <div className="flex shrink-0 gap-1">
            {/* Unlike a combo trigger, a state left empty isn't a meaningful value — clearing one
                is what the delete button is for — so an emptied draft can't be confirmed. */}
            <FieldConfirmButton
              dirty={value !== qmkId}
              disabled={!fieldKeyValid(value) || value === "KC_NO"}
              onClick={() => {
                onCloseField();
                // An unchanged field has nothing to write — confirm just closes the editor.
                if (value !== qmkId) onSave({ [field]: value } as Partial<TapDanceEntry>);
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
                  onOpenField(field, qmkId);
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
                  onSave({ [field]: "KC_NO" } as Partial<TapDanceEntry>);
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

  /** One state field: the picker while it's the active one, an "add" button while empty,
   *  otherwise the read-only value (its actions live in {@link fieldHeader} above it). */
  const field = (fieldName: StateField, qmkId: string) =>
    activeField === fieldName ? (
      <ModifierFieldSlot qmkId={draft ?? qmkId} onChange={onDraftChange} />
    ) : qmkId === "KC_NO" ? (
      // Untouched state: switches this field to the editor, which (being the new active field)
      // collapses whichever other field was mid-edit and opens the picker with itself.
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onOpenField(fieldName, qmkId)}
          className="btn btn-sm min-h-9 w-full gap-1 py-0.5 text-xs btn-dash"
        >
          <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
          {t("fieldAddRegularKey")}
        </button>
        {/* Blank stand-in for the role-tag line, so an empty field is exactly as tall as a
            configured one and the row doesn't grow as states are filled in. */}
        <div className={FIELD_ROLE_ROW} aria-hidden />
      </div>
    ) : (
      // The key itself is the way back into the editor, so changing one takes a single click on
      // it rather than a detour through the header's modify button.
      <FieldValueDisplay
        qmkId={qmkId}
        reserveRoleRow
        {...hoverProps(qmkId)}
        onActivate={() => {
          hideInfo();
          onOpenField(fieldName, qmkId);
        }}
      />
    );

  /**
   * The tapping term's editor state. Its draft is the raw text of the box, not a number, so a
   * half-typed or momentarily empty value is something the editor can sit in — it simply can't be
   * confirmed until it reads as a whole number in range.
   */
  const termActive = activeField === TERM_FIELD;
  const termDraft = termActive ? (draft ?? String(entry.tappingTerm)) : String(entry.tappingTerm);
  const termValue = Number(termDraft);
  const termValid =
    termDraft.trim() !== "" && Number.isInteger(termValue) && termValue >= 0 && termValue <= TERM_MAX;
  const openTerm = () => {
    if (!termActive) onOpenField(TERM_FIELD, String(entry.tappingTerm));
  };
  const commitTerm = () => {
    onCloseField();
    // An unchanged box has nothing to write — confirm just closes the editor.
    if (termValid && termValue !== entry.tappingTerm) onSave({ tappingTerm: termValue });
  };

  return (
    <tr className="group/row hover:bg-base-200/40">
      <td className={`align-top whitespace-nowrap ${SLOT_COL}`}>
        <div className={FIELD_BOX_INSET}>
          <div className={FIELD_HEADER_ROW} aria-hidden />
          <RenumberPicker
            index={index}
            count={tapDanceCount}
            usedIndices={usedIndices}
            icon="mdi:animation"
            title={t("tapDanceRenumber")}
            onMove={onMove}
          />
        </div>
      </td>
      <td className="align-top whitespace-nowrap">
        <div className={FIELD_BOX_INSET}>
          <div className={FIELD_HEADER_ROW} aria-hidden />
          <span
            className={`badge badge-sm badge-soft ${assigned ? "badge-success" : "badge-warning"}`}
            title={t(assigned ? "tapDanceAssignedHelp" : "tapDanceUnassignedHelp", { n: index })}
          >
            {t(assigned ? "tapDanceAssigned" : "tapDanceUnassigned")}
          </span>
        </div>
      </td>
      {STATES.map(({ field: name }) => (
        <td key={name} className="align-top">
          <div
            className={`group/field ${FIELD_COL} ${FIELD_BOX} ${
              activeField === name ? "field-selected" : ""
            }`}
          >
            {fieldHeader(name, entry[name])}
            {field(name, entry[name])}
          </div>
        </td>
      ))}
      <td className="align-top">
        {/* Built like a state field so it behaves like one: its own box, the same confirm/cancel
            pair in the top-right header line, and the same selection ring while it's the field
            under configuration. `w-fit` keeps that ring hugging the box instead of stretching
            across the whole cell. */}
        <div className={`${FIELD_BOX} w-fit ${termActive ? "field-selected" : ""}`}>
          <div className={`${FIELD_HEADER_ROW} flex items-center justify-end gap-1`}>
            {termActive && (
              <div className="flex shrink-0 gap-1">
                <FieldConfirmButton
                  dirty={termValid && termValue !== entry.tappingTerm}
                  disabled={!termValid}
                  onClick={commitTerm}
                />
                <FieldCancelButton onClick={onCloseField} />
              </div>
            )}
          </div>
          {/* Wide enough for the largest term plus its spin buttons *and* the unit suffix: the
              suffix is a flex sibling that won't shrink, so anything narrower squeezes the box
              itself down to the digits. `flex-1 min-w-0` is what makes the input take all of
              what's left rather than shrinking to its content. */}
          <label className="input input-sm min-h-9 w-36">
            <input
              type="number"
              className="min-w-0 flex-1"
              min={0}
              max={TERM_MAX}
              value={termDraft}
              // Until it's the field under configuration the box only displays: every keystroke
              // then edits the draft, and nothing reaches the device before confirm.
              readOnly={!termActive}
              // Clicking into the box is what opens it — `onClick` as well as `onFocus` because a
              // box that never lost focus (right after confirming into it) fires no second focus
              // event, and clicking it again would otherwise do nothing.
              onFocus={openTerm}
              onClick={openTerm}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && termActive && termValid) commitTerm();
              }}
            />
            <span className="label">{t("msUnit")}</span>
          </label>
        </div>
      </td>
      <td className="text-right align-top">
        <div className={FIELD_BOX_INSET}>
          <div className={FIELD_HEADER_ROW} aria-hidden />
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
        </div>
      </td>
    </tr>
  );
}

interface Props {
  keyboard: Keyboard;
}

const isUsed = (e: TapDanceEntry) =>
  e.onTap !== "KC_NO" || e.onHold !== "KC_NO" || e.onDoubleTap !== "KC_NO" || e.onTapHold !== "KC_NO";

const EMPTY_ENTRY: TapDanceEntry = {
  onTap: "KC_NO",
  onHold: "KC_NO",
  onDoubleTap: "KC_NO",
  onTapHold: "KC_NO",
  tappingTerm: 200,
};

/** How long a just-renumbered row stays put before animating into its sorted position — long
 *  enough that the row doesn't slide out from under the cursor right after the pick. */
const REORDER_SETTLE_MS = 1500;

export function TapDancePanel({ keyboard }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const onWriteError = useWriteError();
  const { hoverProps, hideInfo, infoCard } = useKeyInfoHover();
  /**
   * A freshly added, still-empty slot. Unused entries are normally hidden, so this is what keeps
   * the new row listed until it's given a value (or deleted again).
   */
  const [draftIndex, setDraftIndex] = useState<number | null>(null);
  /**
   * The one field being configured anywhere on the page: which row, which of its four states (or
   * its tapping term), and that field's pending value. Held here rather than per row so opening a
   * field closes whichever
   * one was open *on any row* — with a page of rows each keeping its own open field, several
   * half-finished pickers could sit around at once, and only one of them would ever be the one
   * the confirm button in front of you belongs to.
   *
   * `draft` is why nothing reaches the device until confirm: abandoning a field — by cancelling,
   * or by opening another one here or on a different row — simply drops this record and leaves
   * the state as it was.
   */
  const [editing, setEditing] = useState<
    { row: number; field: EditField; draft: string } | null
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

  // Escape backs out of the selected field. Same effect as cancelling it: the draft is dropped
  // and nothing reaches the device, so the state is left exactly as it was.
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

  if (keyboard.tapDanceCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("tapDanceNone")}</p>;
  }

  const usedCount = keyboard.tapDanceEntries.filter(isUsed).length;

  const updateAt = async (idx: number, patch: Partial<TapDanceEntry>) => {
    try {
      await keyboard.setTapDance(idx, { ...keyboard.tapDanceEntries[idx], ...patch });
    } catch (err) {
      onWriteError(err);
    }
  };

  const clearAt = (idx: number) => void updateAt(idx, EMPTY_ENTRY);

  const usedIndices = new Set(keyboard.tapDanceEntries.flatMap((e, i) => (isUsed(e) ? [i] : [])));

  /** Rows to show, in the order to show them — `pendingOrder` while a renumber is settling. */
  const sortedVisible = keyboard.tapDanceEntries
    .map((_, i) => i)
    .filter((i) => isUsed(keyboard.tapDanceEntries[i]) || i === draftIndex);
  const displayOrder = pendingOrder
    ? pendingOrder.filter((i) => sortedVisible.includes(i))
    : sortedVisible;

  /** Drop the open field if it belongs to row `i` — whose entry is about to move or disappear,
   *  taking the draft's meaning with it. */
  const closeEditingOn = (i: number) => setEditing((e) => (e?.row === i ? null : e));

  /** Move an entry to a different (free) slot number: write it to the new slot, clear the old one. */
  const moveTo = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const src = keyboard.tapDanceEntries[fromIdx];
    // Hold the current visual order, with the moved row renumbered in place, for a beat.
    const heldOrder = displayOrder.map((i) => (i === fromIdx ? toIdx : i));
    try {
      await keyboard.setTapDance(toIdx, { ...src });
      if (isUsed(src)) await keyboard.setTapDance(fromIdx, { ...EMPTY_ENTRY });
      if (draftIndex === fromIdx) setDraftIndex(toIdx);
      closeEditingOn(fromIdx);
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      setPendingOrder(heldOrder);
      reorderTimer.current = window.setTimeout(settlePendingReorder, REORDER_SETTLE_MS);
    } catch (err) {
      onWriteError(err);
    }
  };

  const handleAdd = () => {
    const freeIdx = keyboard.tapDanceEntries.findIndex((e) => !isUsed(e));
    if (freeIdx === -1) {
      showToast(t("tapDanceFull"));
      return;
    }
    cancelPendingReorder();
    setDraftIndex(freeIdx);
  };

  /** Delete a row. An empty draft row has nothing on the device to erase and nothing to confirm —
   *  it just stops being listed. */
  const handleDelete = (i: number) => {
    closeEditingOn(i);
    if (!isUsed(keyboard.tapDanceEntries[i])) {
      setDraftIndex((d) => (d === i ? null : d));
      return;
    }
    setPendingDelete(i);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <progress className="progress h-3 w-64" value={usedCount} max={Math.max(keyboard.tapDanceCount, 1)} />
        <span className="text-xs text-brand-on-surface-variant">
          {t("tapDanceUsed", { used: usedCount, total: keyboard.tapDanceCount })}
        </span>
        <HelpIcon text={t("tapDanceUsedHelp")} />
        <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={handleAdd}>
          <Icon icon="mdi:plus" className="h-4 w-4" />
          {t("tapDanceAdd")}
        </button>
      </div>
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table">
          <thead>
            <tr>
              <th className={SLOT_COL}>{t("tapDanceColSlot")}</th>
              <th>
                {/* `floating` because the table's `overflow-x-auto` wrapper is a scroll container:
                    a normal CSS tooltip above the header row gets cropped at its top edge whatever
                    its z-index. */}
                <span className="inline-flex items-center gap-1.5">
                  {t("tapDanceColStatus")}
                  <HelpIcon text={t("tapDanceHint")} floating />
                </span>
              </th>
              {STATES.map(({ labelKey, field }) => (
                <th key={field} className={FIELD_COL}>
                  {t(labelKey)}
                </th>
              ))}
              <th>{t("tapDanceTappingTerm")}</th>
              <th className="w-20 text-right">{t("tapDanceColActions")}</th>
            </tr>
          </thead>
          <tbody>
            {displayOrder.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-brand-on-surface-variant">
                  {t("tapDanceEmpty")}
                </td>
              </tr>
            ) : (
              displayOrder.map((i) => (
                <TapDanceRow
                  key={i}
                  index={i}
                  entry={keyboard.tapDanceEntries[i]}
                  tapDanceCount={keyboard.tapDanceCount}
                  assigned={keyboard.isKeycodeAssigned(`TD(${i})`)}
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
          message={t("tapDanceDeleteConfirm")}
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
