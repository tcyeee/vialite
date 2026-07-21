import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { KeycapFace } from "../keymap/KeycapFace.tsx";
import type { ComboEntry, Keyboard } from "../../protocol/keyboard.ts";
import { useToast } from "../../contexts/toast.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { RenumberPicker } from "../common/RenumberPicker.tsx";
import { ConfirmDialog } from "../common/ConfirmDialog.tsx";
import { startViewTransition } from "../common/viewTransition.ts";
import {
  ConfiguredFieldRow,
  FieldConfirmButton,
  fieldKeyValid,
  ModifierFieldSlot,
} from "../common/ModifierFieldSlot.tsx";

/** Shared keycap-box treatment for the front (display-state) card face — same border weight,
 *  radius, and minimum footprint for every key shown there (the 4 trigger keys and the output
 *  key), so the border reads as one consistent size regardless of each slot's font size or how
 *  long its label is. Stretches to fill whatever width its container gives it (a grid cell for
 *  the 4 keys, the remaining row width next to the arrow for the output key) rather than
 *  shrink-wrapping to the label. */
const CARD_KEY_BOX =
  "flex min-h-9 w-full items-center justify-center rounded-lg border border-[#434b5b]/25 px-2 dark:border-[#d7dfeb]/25";

interface PreviewCardProps {
  index: number;
  entry: ComboEntry;
  /** Total number of combo slots on the device, for the renumber picker. */
  comboCount: number;
  /** Slot indices already occupied by another entry — greyed out in the renumber picker. */
  usedIndices: Set<number>;
  /** Present only for already-configured entries — enables the hover toolbar + flip-to-edit. */
  onSave?: (patch: Partial<ComboEntry>) => void;
  onDelete?: () => void;
  /** Moves this entry to a different (free) slot number, from the edit-face CB picker. */
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
 * Summary of one combo entry. When `onSave`/`onDelete` are given, hovering reveals an
 * Edit/Delete toolbar; Edit flips the card (CSS 3D transform) to reveal an inline editor on
 * the back face, so editing happens in place instead of in a separate form.
 */
function ComboPreviewCard({
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
}: PreviewCardProps) {
  const { t } = useI18n();
  const flipped = !!editing;
  const editable = !!onSave;
  const cardBodyRef = useRef<HTMLDivElement>(null);

  /**
   * Each field on the edit face (the output key and every trigger key) is either "being
   * configured" (the {@link ModifierFieldSlot} picker plus a confirm button) or, once it holds a real
   * value, "configured" (collapsed to a compact modifier+key display with modify/delete buttons).
   * Only one field may be under configuration at a time — `activeField` names it ("output" or a
   * key index), and setting it to a different field implicitly collapses whichever one it was
   * pointing at back to its display row, since that row's own "is this the active field" check
   * simply stops matching. Reset to null whenever the card (re-)enters edit mode.
   */
  const [activeField, setActiveField] = useState<"output" | number | null>(null);
  useEffect(() => {
    if (!editing) return;
    setActiveField(null);
    // Only re-seed when a card newly enters edit mode, not on every entry edit within the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /**
   * Chromium has a known bug where a scroller that becomes visible purely through a CSS
   * transform — no layout change, which is exactly what flipping this card is: only the
   * ancestor's `transform` changes, the scroller's own box never moves or resizes — doesn't get
   * its wheel-scrollable region registered with the compositor. The element is genuinely
   * overflowing (dragging the scrollbar or a keyboard PageDown still works), but the mouse
   * wheel / trackpad silently does nothing, which read as "the edit face can't be scrolled
   * down". Forcing a synchronous reflow on the scroller right as the flip settles makes Blink
   * re-register its scrollable region. See https://issues.chromium.org/issues/40394725.
   */
  const handleFlipSettled = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform" || !flipped) return;
    const el = cardBodyRef.current;
    if (!el) return;
    el.style.display = "none";
    void el.offsetHeight;
    el.style.display = "";
  };

  const setKeyAt = (i: number, id: string) => {
    const keys = [...entry.keys] as ComboEntry["keys"];
    keys[i] = id;
    onSave?.({ keys });
  };

  // Slots to render in the edit face's trigger-key row: every already-set key,
  // plus (only while at least one slot is still free) the next empty one as an
  // "add key" trigger — rather than always showing all 4 regardless of use.
  const nextEmptyKeyIndex = entry.keys.findIndex((k) => k === "KC_NO");
  const visibleKeyIndices = entry.keys.flatMap((k, i) => (k !== "KC_NO" ? [i] : []));
  if (nextEmptyKeyIndex !== -1) visibleKeyIndices.push(nextEmptyKeyIndex);

  return (
    <div
      className="group/card relative my-2 w-80"
      style={{ perspective: "1200px", viewTransitionName: `cbcard-${index}` }}
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
        className="grid transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}
        onTransitionEnd={handleFlipSettled}
      >
        <div
          style={{ backfaceVisibility: "hidden", gridArea: "1 / 1" }}
          className="card relative h-[26rem] overflow-hidden bg-[radial-gradient(circle_at_bottom_left,#57637314_35%,transparent_36%),radial-gradient(circle_at_top_right,#57637314_35%,transparent_36%)] bg-[#eaeff7] bg-size-[4.95em_4.95em] text-[#434b5b] shadow-lg shadow-slate-900/10 transition-shadow duration-200 group-hover/card:shadow-xl group-hover/card:shadow-slate-900/15 dark:bg-[radial-gradient(circle_at_bottom_left,#ffffff12_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff12_35%,transparent_36%)] dark:bg-[#1f242e] dark:text-[#d7dfeb] dark:shadow-black/40 dark:group-hover/card:shadow-black/55"
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
            <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
              COMBO
            </span>
          </div>
          <div className="badge badge-sm absolute top-3 right-3 z-10 border-none bg-emerald-600 font-medium text-white">
            {t("comboActive")}
          </div>
          <div className="card-body relative flex flex-col pb-3">
            <div className="mb-4 flex items-center gap-2 font-mono text-4xl font-bold tracking-tight">
              <Icon icon="mdi:vector-combine" className="h-9 w-9" />
              {index}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
              {entry.keys.map((qmkId, i) => (
                <div key={i}>
                  <div className="text-xs opacity-45 uppercase">{t("comboKeyN", { n: i + 1 })}</div>
                  <div className={`${CARD_KEY_BOX} bg-white/60 text-xl font-bold dark:bg-white/10`}>
                    <KeycapFace qmkId={qmkId} className="whitespace-nowrap" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center gap-2 border-t border-[#434b5b]/15 pt-3 text-sm tracking-widest opacity-55 dark:border-[#d7dfeb]/15">
              →
              <span className={`${CARD_KEY_BOX} flex-1 bg-[#434b5b]/10 dark:bg-black/20`}>
                <KeycapFace qmkId={entry.output} className="whitespace-nowrap" />
              </span>
            </div>
          </div>
        </div>

        {editable && (
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", gridArea: "1 / 1" }}
            className="card relative h-[26rem] overflow-hidden border-2 border-dashed border-[#576373]/50 bg-white shadow-lg shadow-slate-900/10 dark:border-[#d7dfeb]/30 dark:bg-[#232326] dark:shadow-black/40"
          >
            {/* Absolutely positioned (rather than sized by normal flex flow) so its
                height is pinned to the card's own fixed 21rem box regardless of how
                tall the fields inside grow — a flex child's default min-height:auto
                would otherwise let it grow past the card and get silently clipped by
                the card's overflow-hidden instead of scrolling. `translateZ(0)` gives
                it its own compositing layer, and `handleFlipSettled` (attached to the
                flip container above) forces a reflow once the flip transition ends —
                see the comment on that handler for why both are needed for mouse-wheel
                scrolling to actually work here. */}
            <div
              ref={cardBodyRef}
              className="card-body scrollbar-hide absolute inset-0 gap-1.5 overflow-y-auto px-4 pt-4 pb-2"
              style={{ transform: "translateZ(0)" }}
            >
              <div className="mb-1 flex items-center justify-between">
                <RenumberPicker
                  index={index}
                  count={comboCount}
                  usedIndices={usedIndices}
                  icon="mdi:vector-combine"
                  title={t("comboRenumber")}
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

              <div className="flex flex-col gap-2">
                {/* Only the keys the user has actually set, plus (while a slot is
                    still free) one more trigger for the next one — instead of
                    always showing all 4 slots regardless of how many are in use.
                    One per row: a ModifierFieldSlot's modifier chips + key button
                    don't fit two across in the card's 20rem width. */}
                {visibleKeyIndices.map((i) => (
                  <div key={i}>
                    <label className="fieldset-label text-xs text-neutral-400">{t("comboKeyN", { n: i + 1 })}</label>
                    {activeField === i ? (
                      <ModifierFieldSlot
                        qmkId={entry.keys[i]}
                        onChange={(id) => setKeyAt(i, id)}
                        className="btn btn-sm min-h-9 flex-wrap py-0.5 text-xs whitespace-pre-line btn-soft"
                        trailing={
                          <FieldConfirmButton
                            disabled={!fieldKeyValid(entry.keys[i]) || entry.keys[i] === "KC_NO"}
                            onClick={() => setActiveField(null)}
                          />
                        }
                      />
                    ) : entry.keys[i] === "KC_NO" ? (
                      <button
                        type="button"
                        onClick={() => setActiveField(i)}
                        className="btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line btn-dash"
                      >
                        {t("fieldAddRegularKey")}
                      </button>
                    ) : (
                      <ConfiguredFieldRow
                        qmkId={entry.keys[i]}
                        onEdit={() => setActiveField(i)}
                        onDelete={() => setKeyAt(i, "KC_NO")}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="my-1 border-t border-base-300 dark:border-neutral-700" />

              <label className="fieldset-label text-xs text-neutral-400">{t("comboOutput")}</label>
              <div className="mb-1.5">
                {activeField === "output" ? (
                  <ModifierFieldSlot
                    qmkId={entry.output}
                    onChange={(id) => onSave?.({ output: id })}
                    className="btn btn-sm min-h-9 flex-wrap py-0.5 text-xs whitespace-pre-line btn-soft"
                    trailing={
                      <FieldConfirmButton
                        disabled={!fieldKeyValid(entry.output) || entry.output === "KC_NO"}
                        onClick={() => setActiveField(null)}
                      />
                    }
                  />
                ) : entry.output === "KC_NO" ? (
                  // Untouched slot: switches this field to the editor above instead of popping the
                  // picker directly, and (being the new active field) collapses whichever other
                  // field was mid-edit back to its display row.
                  <button
                    type="button"
                    onClick={() => setActiveField("output")}
                    className="btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line btn-dash"
                  >
                    {t("fieldAddRegularKey")}
                  </button>
                ) : (
                  <ConfiguredFieldRow
                    qmkId={entry.output}
                    onEdit={() => setActiveField("output")}
                    onDelete={() => onSave?.({ output: "KC_NO" })}
                  />
                )}
              </div>

              {/* Bottom breathing room so the last field doesn't sit flush against the
                  card edge when scrolled all the way down. */}
              <div className="h-5 shrink-0" aria-hidden="true" />
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

const isUsed = (e: ComboEntry) => e.output !== "KC_NO" || e.keys.some((k) => k !== "KC_NO");

export function ComboPanel({ keyboard, onChange }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  /**
   * The single slot currently flipped to its editor face. Parent-owned so only one card edits at a
   * time, and it doubles as the "freshly added, still-unused slot" marker (shown even when empty).
   */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /**
   * A freshly added, still-unused slot that's visible but not yet flipped — set for the two
   * animation frames between "新增 Combo" being clicked and {@link editingIndex} taking over, so
   * the new card mounts showing its front face first and then flips into the editor face exactly
   * like clicking the pencil icon on an existing card, instead of popping directly into the
   * editor face with no transition.
   */
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  /**
   * When set, overrides the natural (ascending) card order so a just-renumbered card stays put for
   * a beat before it animates to its sorted position. Cleared inside a View Transition.
   */
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  /** Slot awaiting delete confirmation, or null when the confirm dialog is closed. */
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const reorderTimer = useRef<number | null>(null);
  /** The entry's value captured when editing began, restored verbatim if the user clicks Cancel. */
  const editSnapshot = useRef<ComboEntry | null>(null);
  /** Pending `requestAnimationFrame` id(s) for the add-flow's delayed flip, cancelled on unmount
   *  or if another action pre-empts it before the two frames elapse. */
  const addRaf = useRef<number[]>([]);

  const cancelPendingAddFlip = () => {
    addRaf.current.forEach((id) => cancelAnimationFrame(id));
    addRaf.current = [];
  };

  useEffect(() => () => {
    if (reorderTimer.current) clearTimeout(reorderTimer.current);
    cancelPendingAddFlip();
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

  const snapshotOf = (i: number): ComboEntry => {
    const e = keyboard.comboEntries[i];
    return { ...e, keys: [...e.keys] as ComboEntry["keys"] };
  };

  const handleEdit = (i: number) => {
    // Switching to another card settles the previous card's pending re-sort first.
    if (pendingOrder) settlePendingReorder(0);
    cancelPendingAddFlip();
    setAddingIndex(null);
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
    cancelPendingAddFlip();
    setAddingIndex(null);
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
    cancelPendingAddFlip();
    setAddingIndex(null);
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
    } finally {
      onChange();
    }
  };

  const clearAt = (idx: number) =>
    void updateAt(idx, { keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"], output: "KC_NO" });

  const usedIndices = new Set(keyboard.comboEntries.flatMap((e, i) => (isUsed(e) ? [i] : [])));

  /** Cards to show, in the order to show them — `pendingOrder` while a renumber is settling. */
  const sortedVisible = keyboard.comboEntries
    .map((_, i) => i)
    .filter((i) => isUsed(keyboard.comboEntries[i]) || i === editingIndex || i === addingIndex);
  const displayOrder = pendingOrder
    ? pendingOrder.filter((i) => sortedVisible.includes(i))
    : sortedVisible;

  /** Move an entry to a different (free) slot number: write it to the new slot, clear the old one. */
  const moveTo = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const src = keyboard.comboEntries[fromIdx];
    // Hold the current visual order, with the moved card renamed in place, until the timer fires.
    const heldOrder = displayOrder.map((i) => (i === fromIdx ? toIdx : i));
    try {
      await keyboard.setCombo(toIdx, { ...src, keys: [...src.keys] as ComboEntry["keys"] });
      if (isUsed(src)) {
        await keyboard.setCombo(fromIdx, { keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"], output: "KC_NO" });
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
    const freeIdx = keyboard.comboEntries.findIndex((e) => !isUsed(e));
    if (freeIdx === -1) {
      showToast(t("comboFull"));
      return;
    }
    cancelPendingReorder();
    cancelPendingAddFlip();
    // Show the freshly added card at the front of the row while it's being edited; the natural
    // (ascending) order animates back into place only when the user clicks Done or Cancel.
    const used = keyboard.comboEntries.flatMap((e, i) => (isUsed(e) ? [i] : []));
    setPendingOrder([freeIdx, ...used]);
    editSnapshot.current = snapshotOf(freeIdx);
    // Mount the new card showing its front face first, then flip it into the editor face on the
    // next paint — the same entrance the pencil-icon edit path gets — instead of popping directly
    // into the editor face with no transition. Two rAFs so the un-flipped frame actually commits
    // before the transform change that the flip's CSS transition needs to animate from.
    setAddingIndex(freeIdx);
    addRaf.current = [
      requestAnimationFrame(() => {
        addRaf.current = [
          requestAnimationFrame(() => {
            addRaf.current = [];
            setEditingIndex(freeIdx);
            setAddingIndex(null);
          }),
        ];
      }),
    ];
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-3">
          <progress className="progress h-3 w-80" value={usedCount} max={Math.max(keyboard.comboCount, 1)} />
          <span className="text-xs text-brand-on-surface-variant">
            {t("comboUsed", { used: usedCount, total: keyboard.comboCount })}
          </span>
          <HelpIcon text={t("comboUsedHelp")} />
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>
          {t("comboAdd")}
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        {displayOrder.length === 0 ? (
          <p className="text-sm text-brand-on-surface-variant">{t("comboEmpty")}</p>
        ) : (
          displayOrder.map((i) => (
            <ComboPreviewCard
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
            />
          ))
        )}
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
    </div>
  );
}
