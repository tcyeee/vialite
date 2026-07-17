import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@iconify/react";
import { type MessageKey, useI18n } from "../../contexts/i18n.tsx";
import { KeycapFace } from "../keymap/KeycapFace.tsx";
import type { Keyboard, TapDanceEntry } from "../../protocol/keyboard.ts";
import { useToast } from "../../contexts/toast.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { KeySlot } from "../common/KeySlot.tsx";
import { RenumberPicker } from "../common/RenumberPicker.tsx";
import { ConfirmDialog } from "../common/ConfirmDialog.tsx";
import { startViewTransition } from "../common/viewTransition.ts";

const PREVIEW_STATES: { labelKey: MessageKey; field: keyof TapDanceEntry }[] = [
  { labelKey: "tapDanceOnTap", field: "onTap" },
  { labelKey: "tapDanceOnHold", field: "onHold" },
  { labelKey: "tapDanceOnDoubleTap", field: "onDoubleTap" },
  { labelKey: "tapDanceOnTapHold", field: "onTapHold" },
];

interface PreviewCardProps {
  index: number;
  entry: TapDanceEntry;
  /** Total number of tap dance slots on the device, for the renumber picker. */
  tapDanceCount: number;
  /** Whether TD(index) is placed on a key in the keymap (drives the used/unused tag). */
  assigned: boolean;
  /** Slot indices already occupied by another entry — greyed out in the renumber picker. */
  usedIndices: Set<number>;
  /** Present only for already-configured entries — enables the hover toolbar + flip-to-edit. */
  onSave?: (patch: Partial<TapDanceEntry>) => void;
  onDelete?: () => void;
  /** Moves this entry to a different (free) slot number, from the edit-face TD picker. */
  onMove?: (toIdx: number) => void;
  /** Whether this card is the single one currently flipped to its editor face (parent-owned). */
  editing?: boolean;
  /** Enter edit mode — the parent makes this the one editing card, un-flipping any other. */
  onEdit?: () => void;
  /** Leave edit mode (the "done" button); the parent also drops the slot if it's still unused. */
  onCloseEdit?: () => void;
  /** Discard edits (the "cancel" button) — restores the entry to its value from when editing began. */
  onCancel?: () => void;
}

/**
 * Summary of one tap dance entry. When `onSave`/`onDelete` are given, hovering reveals an
 * Edit/Delete toolbar; Edit flips the card (CSS 3D transform) to reveal an inline editor on
 * the back face, so editing happens in place instead of in a separate form.
 */
function TapDancePreviewCard({
  index,
  entry,
  tapDanceCount,
  assigned,
  usedIndices,
  onSave,
  onDelete,
  onMove,
  editing,
  onEdit,
  onCloseEdit,
  onCancel,
}: PreviewCardProps) {
  const { t } = useI18n();
  const flipped = !!editing;
  const editable = !!onSave;

  return (
    <div
      className="group/card relative my-2 w-80"
      style={{ perspective: "1200px", viewTransitionName: `tdcard-${index}` }}
    >
      {editable && !flipped && (
        <div className="absolute -top-3 left-1/2 z-10 flex origin-top -translate-x-1/2 gap-1 rounded-full bg-neutral-900 px-2 py-1 opacity-0 shadow-lg transition-all duration-200 group-hover/card:-translate-y-2.5 group-hover/card:scale-[1.6] group-hover/card:opacity-100 dark:bg-neutral-700">
          <button
            type="button"
            className="btn btn-ghost btn-xs px-2 text-white hover:bg-white/20 hover:text-white"
            title={t("edit")}
            onClick={() => onEdit?.()}
          >
            <Icon icon="mdi:pencil" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs px-2 text-white hover:bg-white/20 hover:text-white"
            title={t("delete")}
            onClick={() => onDelete?.()}
          >
            <Icon icon="mdi:trash-can-outline" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div
        className="grid h-[16.5rem] transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}
      >
        <div
          style={{ backfaceVisibility: "hidden", gridArea: "1 / 1" }}
          className="card relative overflow-hidden bg-[radial-gradient(circle_at_bottom_left,#73575e14_35%,transparent_36%),radial-gradient(circle_at_top_right,#73575e14_35%,transparent_36%)] bg-[#f5ecef] bg-size-[4.95em_4.95em] text-[#5b434b] shadow-lg shadow-stone-900/10 transition-shadow duration-200 group-hover/card:shadow-xl group-hover/card:shadow-stone-900/15 dark:bg-[radial-gradient(circle_at_bottom_left,#ffffff12_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff12_35%,transparent_36%)] dark:bg-[#2a2125] dark:text-[#e7d8dd] dark:shadow-black/40 dark:group-hover/card:shadow-black/55"
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
            <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
              TAP DANCE
            </span>
          </div>
          <div
            className={`badge badge-sm absolute top-3 right-3 z-10 border-none font-medium text-white ${
              assigned ? "bg-emerald-600" : "bg-rose-600"
            }`}
            title={t(assigned ? "tapDanceAssignedHelp" : "tapDanceUnassignedHelp", { n: index })}
          >
            {t(assigned ? "tapDanceAssigned" : "tapDanceUnassigned")}
          </div>
          <div className="card-body relative flex flex-col pb-3">
            <div className="mb-4 font-mono text-4xl font-bold tracking-tight">TD-{index}</div>
            <div className="grid grid-cols-2 gap-y-3">
              {PREVIEW_STATES.map(({ labelKey, field }) => (
                <div key={field}>
                  <div className="text-xs opacity-45 uppercase">{t(labelKey)}</div>
                  <div className="text-xl font-bold">
                    <KeycapFace qmkId={entry[field] as string} className="whitespace-pre-line" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-3 text-center text-xs tracking-widest opacity-55">
              {t("tapDanceTermMs", { ms: entry.tappingTerm })}
            </div>
          </div>
        </div>

        {editable && (
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", gridArea: "1 / 1" }}
            className="card overflow-hidden border-2 border-dashed border-[#73575e]/50 bg-white shadow-lg shadow-stone-900/10 dark:border-[#e7d8dd]/30 dark:bg-[#232326] dark:shadow-black/40"
          >
            <div className="card-body gap-1.5 px-4 pt-4 pb-2">
              <div className="mb-1 flex items-center justify-between">
                <RenumberPicker
                  index={index}
                  count={tapDanceCount}
                  usedIndices={usedIndices}
                  prefix="TD"
                  title={t("tapDanceRenumber")}
                  onMove={(toIdx) => onMove?.(toIdx)}
                />
                <div className="flex items-center gap-1">
                  <button type="button" className="btn btn-ghost btn-sm text-neutral-400" onClick={() => onCancel?.()}>
                    {t("cancel")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm text-neutral-700 dark:text-neutral-200" onClick={() => onCloseEdit?.()}>
                    {t("done")}
                  </button>
                </div>
              </div>

              <label className="fieldset-label text-xs text-neutral-400">{t("tapDanceTappingTerm")}</label>
              <div className="mb-1.5 flex items-center gap-1.5">
                <input
                  type="number"
                  className="input input-sm w-28"
                  min={0}
                  max={10000}
                  value={entry.tappingTerm}
                  onChange={(e) => onSave?.({ tappingTerm: Number(e.target.value) })}
                />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{t("msUnit")}</span>
              </div>

              {/* Same 2x2 arrangement as the front face's grid, so a field's position doesn't
                  move when the card flips between display and edit state. */}
              <div className="grid grid-cols-2 gap-2">
                {PREVIEW_STATES.map(({ labelKey, field }) => {
                  const configured = (entry[field] as string) !== "KC_NO";
                  return (
                    <div key={field}>
                      <label className="fieldset-label text-xs text-neutral-400">{t(labelKey)}</label>
                      <KeySlot
                        qmkId={entry[field] as string}
                        onChange={(id) => onSave?.({ [field]: id } as Partial<TapDanceEntry>)}
                        className={`btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line ${
                          configured ? "btn-soft" : "btn-dash"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


interface Props {
  keyboard: Keyboard;
  /** Called after an entry was written to the device, so the parent re-renders. */
  onChange: () => void;
}

const isUsed = (e: TapDanceEntry) =>
  e.onTap !== "KC_NO" || e.onHold !== "KC_NO" || e.onDoubleTap !== "KC_NO" || e.onTapHold !== "KC_NO";

export function TapDancePanel({ keyboard, onChange }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  /**
   * The single slot currently flipped to its editor face. Parent-owned so only one card edits at a
   * time, and it doubles as the "freshly added, still-unused slot" marker (shown even when empty).
   */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /**
   * When set, overrides the natural (ascending) card order so a just-renumbered card stays put for
   * a beat before it animates to its sorted position. Cleared inside a View Transition.
   */
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  /** Slot awaiting delete confirmation, or null when the confirm dialog is closed. */
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const reorderTimer = useRef<number | null>(null);
  /** The entry's value captured when editing began, restored verbatim if the user clicks Cancel. */
  const editSnapshot = useRef<TapDanceEntry | null>(null);

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

  /** Play the deferred re-sort (a card was renumbered while editing) as an animated View Transition. */
  const settlePendingReorder = (delayMs: number) => {
    if (reorderTimer.current) clearTimeout(reorderTimer.current);
    reorderTimer.current = window.setTimeout(() => {
      reorderTimer.current = null;
      startViewTransition(() => flushSync(() => setPendingOrder(null)));
    }, delayMs);
  };

  const handleEdit = (i: number) => {
    // Switching to another card settles the previous card's pending re-sort first.
    if (pendingOrder) settlePendingReorder(0);
    editSnapshot.current = { ...keyboard.tapDanceEntries[i] };
    setEditingIndex(i);
  };

  const handleCloseEdit = () => {
    editSnapshot.current = null;
    setEditingIndex(null);
    // Only now (on "done") does the card animate into its sorted position — after a beat that lets
    // it flip back to its front face first.
    if (pendingOrder) settlePendingReorder(500);
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

  if (keyboard.tapDanceCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("tapDanceNone")}</p>;
  }

  const usedCount = keyboard.tapDanceEntries.filter(isUsed).length;

  const updateAt = async (idx: number, patch: Partial<TapDanceEntry>) => {
    try {
      await keyboard.setTapDance(idx, { ...keyboard.tapDanceEntries[idx], ...patch });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      onChange();
    }
  };

  const clearAt = (idx: number) =>
    void updateAt(idx, { onTap: "KC_NO", onHold: "KC_NO", onDoubleTap: "KC_NO", onTapHold: "KC_NO", tappingTerm: 200 });

  const usedIndices = new Set(
    keyboard.tapDanceEntries.flatMap((e, i) => (isUsed(e) ? [i] : [])),
  );

  /** Cards to show, in the order to show them — `pendingOrder` while a renumber is settling. */
  const sortedVisible = keyboard.tapDanceEntries
    .map((_, i) => i)
    .filter((i) => isUsed(keyboard.tapDanceEntries[i]) || i === editingIndex);
  const displayOrder = pendingOrder
    ? pendingOrder.filter((i) => sortedVisible.includes(i))
    : sortedVisible;

  /** Move an entry to a different (free) slot number: write it to the new slot, clear the old one. */
  const moveTo = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const src = keyboard.tapDanceEntries[fromIdx];
    // Hold the current visual order, with the moved card renamed in place, until the timer fires.
    const heldOrder = displayOrder.map((i) => (i === fromIdx ? toIdx : i));
    try {
      await keyboard.setTapDance(toIdx, { ...src });
      if (isUsed(src)) {
        await keyboard.setTapDance(fromIdx, {
          onTap: "KC_NO",
          onHold: "KC_NO",
          onDoubleTap: "KC_NO",
          onTapHold: "KC_NO",
          tappingTerm: 200,
        });
      }
      // Hold the card in place, still in edit mode; the re-sort waits until "done" is clicked.
      if (reorderTimer.current) {
        clearTimeout(reorderTimer.current);
        reorderTimer.current = null;
      }
      setEditingIndex(toIdx);
      setPendingOrder(heldOrder);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      onChange();
    }
  };

  const handleAdd = () => {
    const freeIdx = keyboard.tapDanceEntries.findIndex((e) => !isUsed(e));
    if (freeIdx === -1) {
      showToast(t("tapDanceFull"));
      return;
    }
    cancelPendingReorder();
    // Show the freshly added card at the front of the row while it's being edited; the natural
    // (ascending) order animates back into place only when the user clicks Done or Cancel.
    const used = keyboard.tapDanceEntries.flatMap((e, i) => (isUsed(e) ? [i] : []));
    setPendingOrder([freeIdx, ...used]);
    editSnapshot.current = { ...keyboard.tapDanceEntries[freeIdx] };
    setEditingIndex(freeIdx);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-3">
          <progress className="progress h-3 w-80" value={usedCount} max={Math.max(keyboard.tapDanceCount, 1)} />
          <span className="text-xs text-brand-on-surface-variant">
            {t("tapDanceUsed", { used: usedCount, total: keyboard.tapDanceCount })}
          </span>
          <HelpIcon text={t("tapDanceUsedHelp")} />
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>
          {t("tapDanceAdd")}
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        {displayOrder.length === 0 ? (
          <p className="text-sm text-brand-on-surface-variant">{t("tapDanceEmpty")}</p>
        ) : (
          displayOrder.map((i) => (
            <TapDancePreviewCard
              key={i}
              index={i}
              entry={keyboard.tapDanceEntries[i]}
              tapDanceCount={keyboard.tapDanceCount}
              assigned={keyboard.isKeycodeAssigned(`TD(${i})`)}
              usedIndices={usedIndices}
              onSave={(patch) => void updateAt(i, patch)}
              onDelete={() => setPendingDelete(i)}
              onMove={(toIdx) => void moveTo(i, toIdx)}
              editing={i === editingIndex}
              onEdit={() => handleEdit(i)}
              onCloseEdit={handleCloseEdit}
              onCancel={handleCancel}
            />
          ))
        )}
      </div>
      {pendingDelete !== null && (
        <ConfirmDialog
          message={t("tapDanceDeleteConfirm")}
          onConfirm={() => {
            clearAt(pendingDelete);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
