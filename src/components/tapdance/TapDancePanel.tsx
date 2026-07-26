import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@iconify/react";
import { type MessageKey, useI18n } from "../../contexts/i18n.tsx";
import { KeycapFace } from "../keymap/layout/KeycapFace.tsx";
import type { Keyboard, TapDanceEntry } from "../../protocol/keyboard.ts";
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

const PREVIEW_STATES: { labelKey: MessageKey; field: keyof TapDanceEntry }[] = [
  { labelKey: "tapDanceOnTap", field: "onTap" },
  { labelKey: "tapDanceOnHold", field: "onHold" },
  { labelKey: "tapDanceOnDoubleTap", field: "onDoubleTap" },
  { labelKey: "tapDanceOnTapHold", field: "onTapHold" },
];

/** Shared keycap-box treatment for the front (display-state) card face — same border weight,
 *  radius, and minimum footprint for every state key shown there, so the border reads as one
 *  consistent size regardless of each slot's font size or how long its label is. Mirrors
 *  ComboPanel's `CARD_KEY_BOX`, palette-swapped to tap dance's own card tones. */
const CARD_KEY_BOX =
  "flex min-h-9 w-full items-center justify-center rounded-lg border border-[#5b434b]/25 px-2 dark:border-[#e7d8dd]/25";

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
  /** True while a page-level View Transition (e.g. App.tsx's `navigateSlide` push) is in flight and
   *  this card isn't the one it's meant to morph — drops `tdcard-${index}` for that window so the
   *  card isn't pulled out of the page's own root snapshot into its own static cross-fade group.
   *  Same workaround as NewHomePage's `suppressHeroName`. */
  suppressCardName?: boolean;
}

/**
 * Summary of one tap dance entry. When `onSave`/`onDelete` are given, hovering reveals an
 * Edit/Delete toolbar; Edit flips the card (CSS 3D transform) to reveal an inline editor on
 * the back face, so editing happens in place instead of in a separate form. Structurally mirrors
 * {@link ../combo/ComboPanel}'s `ComboPreviewCard` (fixed card height, absolutely-positioned
 * scrollable edit body, add-flow flip-in) — only the card's background palette and field set
 * stay tap-dance-specific.
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
  suppressCardName,
}: PreviewCardProps) {
  const { t } = useI18n();
  const flipped = !!editing;
  const editable = !!onSave;
  const cardBodyRef = useRef<HTMLDivElement>(null);

  /**
   * Each of the four state fields is either "being configured" (the {@link ModifierFieldSlot}
   * picker plus a confirm button) or, once it holds a real value, "configured" (collapsed to a
   * compact modifier+key display with modify/delete buttons). Only one field may be under
   * configuration at a time — `activeField` names it, and setting it to a different field
   * implicitly collapses whichever one it was pointing at back to its display row, since that
   * row's own "is this the active field" check simply stops matching. Reset to null whenever the
   * card (re-)enters edit mode. Mirrors {@link ../combo/ComboPanel}'s `ComboPreviewCard`.
   */
  const [activeField, setActiveField] = useState<keyof TapDanceEntry | null>(null);
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
   * its wheel-scrollable region registered with the compositor. Forcing a synchronous reflow on
   * the scroller right as the flip settles makes Blink re-register its scrollable region. See
   * https://issues.chromium.org/issues/40394725.
   */
  const handleFlipSettled = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform" || !flipped) return;
    const el = cardBodyRef.current;
    if (!el) return;
    el.style.display = "none";
    void el.offsetHeight;
    el.style.display = "";
  };

  return (
    <div
      className="group/card relative my-2 w-80"
      style={{
        perspective: "1200px",
        viewTransitionName: suppressCardName ? undefined : `tdcard-${index}`,
      }}
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
          className="card relative h-[26rem] overflow-hidden bg-[radial-gradient(circle_at_bottom_left,#73575e14_35%,transparent_36%),radial-gradient(circle_at_top_right,#73575e14_35%,transparent_36%)] bg-[#f5ecef] bg-size-[4.95em_4.95em] text-[#5b434b] shadow-lg shadow-stone-900/10 transition-shadow duration-200 group-hover/card:shadow-xl group-hover/card:shadow-stone-900/15 dark:bg-[radial-gradient(circle_at_bottom_left,#ffffff12_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff12_35%,transparent_36%)] dark:bg-[#2a2125] dark:text-[#e7d8dd] dark:shadow-black/40 dark:group-hover/card:shadow-black/55"
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
            <div className="mb-4 flex items-center gap-2 font-mono text-4xl font-bold tracking-tight">
              <Icon icon="mdi:animation" className="h-9 w-9" />
              {index}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
              {PREVIEW_STATES.map(({ labelKey, field }) => (
                <div key={field}>
                  <div className="text-xs opacity-45 uppercase">{t(labelKey)}</div>
                  <div className={`${CARD_KEY_BOX} bg-white/60 text-xl font-bold dark:bg-white/10`}>
                    <KeycapFace qmkId={entry[field] as string} className="whitespace-nowrap" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-center gap-2 border-t border-[#5b434b]/15 pt-3 text-sm tracking-widest opacity-55 dark:border-[#e7d8dd]/15">
              {t("tapDanceTermMs", { ms: entry.tappingTerm })}
            </div>
          </div>
        </div>

        {editable && (
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", gridArea: "1 / 1" }}
            className="card relative h-[26rem] overflow-hidden border-2 border-dashed border-[#73575e]/50 bg-white shadow-lg shadow-stone-900/10 dark:border-[#e7d8dd]/30 dark:bg-[#232326] dark:shadow-black/40"
          >
            {/* Absolutely positioned (rather than sized by normal flex flow) so its height is
                pinned to the card's own fixed height box regardless of how tall the fields
                inside grow — see `handleFlipSettled` above for why this plus `translateZ(0)`
                is needed for mouse-wheel scrolling to actually work here once flipped in. */}
            <div
              ref={cardBodyRef}
              className="card-body scrollbar-hide absolute inset-0 gap-1.5 overflow-y-auto px-4 pt-4 pb-2"
              style={{ transform: "translateZ(0)" }}
            >
              <div className="mb-1 flex items-center justify-between">
                <RenumberPicker
                  index={index}
                  count={tapDanceCount}
                  usedIndices={usedIndices}
                  icon="mdi:animation"
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

              {/* One field per row: a ModifierFieldSlot's modifier chips + key button don't fit
                  two across in the card's 20rem width — see ComboPanel's edit face. */}
              <div className="flex flex-col gap-2">
                {PREVIEW_STATES.map(({ labelKey, field }) => {
                  const qmkId = entry[field] as string;
                  return (
                    <div key={field}>
                      <label className="fieldset-label text-xs text-neutral-400">{t(labelKey)}</label>
                      {activeField === field ? (
                        <ModifierFieldSlot
                          qmkId={qmkId}
                          onChange={(id) => onSave?.({ [field]: id } as Partial<TapDanceEntry>)}
                          className="btn btn-sm min-h-9 flex-wrap py-0.5 text-xs whitespace-pre-line btn-soft"
                          trailing={
                            <FieldConfirmButton
                              disabled={!fieldKeyValid(qmkId) || qmkId === "KC_NO"}
                              onClick={() => setActiveField(null)}
                            />
                          }
                        />
                      ) : qmkId === "KC_NO" ? (
                        <button
                          type="button"
                          onClick={() => setActiveField(field)}
                          className="btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line btn-dash"
                        >
                          {t("fieldAddRegularKey")}
                        </button>
                      ) : (
                        <ConfiguredFieldRow
                          qmkId={qmkId}
                          onEdit={() => setActiveField(field)}
                          onDelete={() => onSave?.({ [field]: "KC_NO" } as Partial<TapDanceEntry>)}
                        />
                      )}
                    </div>
                  );
                })}
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
  /** Forwarded to every card — see `PreviewCardProps.suppressCardName`. */
  suppressCardNames?: boolean;
}

const isUsed = (e: TapDanceEntry) =>
  e.onTap !== "KC_NO" || e.onHold !== "KC_NO" || e.onDoubleTap !== "KC_NO" || e.onTapHold !== "KC_NO";

export function TapDancePanel({ keyboard, suppressCardNames }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  /**
   * The single slot currently flipped to its editor face. Parent-owned so only one card edits at a
   * time, and it doubles as the "freshly added, still-unused slot" marker (shown even when empty).
   */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /**
   * A freshly added, still-unused slot that's visible but not yet flipped — set for the two
   * animation frames between "新增" being clicked and {@link editingIndex} taking over, so the
   * new card mounts showing its front face first and then flips into the editor face exactly
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
  const editSnapshot = useRef<TapDanceEntry | null>(null);
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

  const handleEdit = (i: number) => {
    // Switching to another card settles the previous card's pending re-sort first.
    if (pendingOrder) settlePendingReorder(0);
    cancelPendingAddFlip();
    setAddingIndex(null);
    editSnapshot.current = { ...keyboard.tapDanceEntries[i] };
    setEditingIndex(i);
  };

  const handleCloseEdit = () => {
    if (editingIndex !== null) {
      const e = keyboard.tapDanceEntries[editingIndex];
      const invalid =
        !fieldKeyValid(e.onTap) ||
        !fieldKeyValid(e.onHold) ||
        !fieldKeyValid(e.onDoubleTap) ||
        !fieldKeyValid(e.onTapHold);
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

  if (keyboard.tapDanceCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("tapDanceNone")}</p>;
  }

  const usedCount = keyboard.tapDanceEntries.filter(isUsed).length;

  const updateAt = async (idx: number, patch: Partial<TapDanceEntry>) => {
    try {
      await keyboard.setTapDance(idx, { ...keyboard.tapDanceEntries[idx], ...patch });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
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
    .filter((i) => isUsed(keyboard.tapDanceEntries[i]) || i === editingIndex || i === addingIndex);
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
    }
  };

  const handleAdd = () => {
    const freeIdx = keyboard.tapDanceEntries.findIndex((e) => !isUsed(e));
    if (freeIdx === -1) {
      showToast(t("tapDanceFull"));
      return;
    }
    cancelPendingReorder();
    cancelPendingAddFlip();
    // Show the freshly added card at the front of the row while it's being edited; the natural
    // (ascending) order animates back into place only when the user clicks Done or Cancel.
    const used = keyboard.tapDanceEntries.flatMap((e, i) => (isUsed(e) ? [i] : []));
    setPendingOrder([freeIdx, ...used]);
    editSnapshot.current = { ...keyboard.tapDanceEntries[freeIdx] };
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
              suppressCardName={suppressCardNames}
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
