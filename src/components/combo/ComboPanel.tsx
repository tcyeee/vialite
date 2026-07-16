import { useEffect, useRef, useState, type SVGProps } from "react";
import { flushSync } from "react-dom";
import { useI18n } from "../../contexts/i18n.tsx";
import { KeycapFace } from "../keymap/KeycapFace.tsx";
import type { ComboEntry, Keyboard } from "../../protocol/keyboard.ts";
import { useToast } from "../../contexts/toast.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { KeySlot } from "../common/KeySlot.tsx";
import { RenumberPicker } from "../common/RenumberPicker.tsx";
import { startViewTransition } from "../common/viewTransition.ts";

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
}: PreviewCardProps) {
  const { t } = useI18n();
  const flipped = !!editing;
  const editable = !!onSave;

  const setKeyAt = (i: number, id: string) => {
    const keys = [...entry.keys] as ComboEntry["keys"];
    keys[i] = id;
    onSave?.({ keys });
  };

  return (
    <div
      className="group/card relative my-2 w-80"
      style={{ perspective: "1200px", viewTransitionName: `cbcard-${index}` }}
    >
      {editable && !flipped && (
        <div className="absolute -top-3 left-1/2 z-10 flex origin-top -translate-x-1/2 gap-1 rounded-full bg-neutral-900 px-2 py-1 opacity-0 shadow-lg transition-all duration-200 group-hover/card:-translate-y-2.5 group-hover/card:scale-[1.6] group-hover/card:opacity-100">
          <button
            type="button"
            className="btn btn-ghost btn-xs px-2 text-white hover:bg-white/20 hover:text-white"
            title={t("edit")}
            onClick={() => onEdit?.()}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs px-2 text-white hover:bg-white/20 hover:text-white"
            title={t("delete")}
            onClick={() => {
              if (window.confirm(t("comboDeleteConfirm"))) {
                onDelete?.();
              }
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div
        className="grid h-[16.5rem] transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}
      >
        <div
          style={{ backfaceVisibility: "hidden", gridArea: "1 / 1" }}
          className="card relative overflow-hidden bg-[radial-gradient(circle_at_bottom_left,#ffffff08_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff08_35%,transparent_36%)] bg-[#73575E] bg-size-[4.95em_4.95em] text-brand-background"
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
            <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
              COMBO
            </span>
          </div>
          <div className="card-body relative flex flex-col pb-3">
            <div className="mb-4 font-mono text-4xl font-bold tracking-tight">CB-{index}</div>
            <div className="grid grid-cols-2 gap-y-3">
              {entry.keys.map((qmkId, i) => (
                <div key={i}>
                  <div className="text-xs opacity-20 uppercase">{t("comboKeyN", { n: i + 1 })}</div>
                  <div className="text-xl font-bold">
                    <KeycapFace qmkId={qmkId} className="whitespace-pre-line" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-3 text-center text-sm tracking-widest opacity-40">
              → <KeycapFace qmkId={entry.output} className="whitespace-pre-line" />
            </div>
          </div>
        </div>

        {editable && (
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", gridArea: "1 / 1" }}
            className="card overflow-hidden border-2 border-dashed border-brand-outline/50 bg-white"
          >
            <div className="card-body gap-1.5 px-4 pt-4 pb-2">
              <div className="mb-1 flex items-center justify-between">
                <RenumberPicker
                  index={index}
                  count={comboCount}
                  usedIndices={usedIndices}
                  prefix="CB"
                  title={t("comboRenumber")}
                  onMove={(toIdx) => onMove?.(toIdx)}
                />
                <button type="button" className="btn btn-ghost btn-sm text-neutral-500" onClick={() => onCloseEdit?.()}>
                  {t("done")}
                </button>
              </div>

              <label className="fieldset-label text-xs text-neutral-400">{t("comboOutput")}</label>
              <div className="mb-1.5">
                <KeySlot
                  qmkId={entry.output}
                  onChange={(id) => onSave?.({ output: id })}
                  className={`btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line ${
                    entry.output !== "KC_NO" ? "btn-soft" : "btn-dash"
                  }`}
                />
              </div>

              {/* Same 2x2 arrangement as the front face's grid, so a field's position doesn't
                  move when the card flips between display and edit state. */}
              <div className="grid grid-cols-2 gap-2">
                {entry.keys.map((qmkId, i) => (
                  <div key={i}>
                    <label className="fieldset-label text-xs text-neutral-400">{t("comboKeyN", { n: i + 1 })}</label>
                    <KeySlot
                      qmkId={qmkId}
                      onChange={(id) => setKeyAt(i, id)}
                      className={`btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line ${
                        qmkId !== "KC_NO" ? "btn-soft" : "btn-dash"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 3.5 4 4L7 21l-4.5 1L3.5 17.5 16.5 3.5Z" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4h6v3m-8 0 .8 12.4A2 2 0 0 0 9.8 21h4.4a2 2 0 0 0 2-1.6L17 7" />
    </svg>
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
   * When set, overrides the natural (ascending) card order so a just-renumbered card stays put for
   * a beat before it animates to its sorted position. Cleared inside a View Transition.
   */
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
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
    setEditingIndex(i);
  };

  const handleCloseEdit = () => {
    setEditingIndex(null);
    // Only now (on "done") does the card animate into its sorted position — after a beat that lets
    // it flip back to its front face first.
    if (pendingOrder) settlePendingReorder(500);
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
    .filter((i) => isUsed(keyboard.comboEntries[i]) || i === editingIndex);
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
    setEditingIndex(freeIdx);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <progress className="progress h-3 w-80" value={usedCount} max={Math.max(keyboard.comboCount, 1)} />
        <span className="text-xs text-brand-on-surface-variant">
          {t("comboUsed", { used: usedCount, total: keyboard.comboCount })}
        </span>
        <HelpIcon text={t("comboUsedHelp")} />
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
              onDelete={() => clearAt(i)}
              onMove={(toIdx) => void moveTo(i, toIdx)}
              editing={i === editingIndex}
              onEdit={() => handleEdit(i)}
              onCloseEdit={handleCloseEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}
